<?php
/**
 * HelpNest media — private receiver (media host side).
 *
 * The API (gateway.jobready.co.ke) pushes encoded WebP variants here. This
 * endpoint is NOT for browsers or the mobile app: every request must carry
 * an HMAC signature computed with the shared secret, over the exact body:
 *
 *   payload = "hn.media.ship.v1|<action>|<group>|<key>|<variant>|<ts>|<sha256(rawBody)>"
 *   sig     = HMAC-SHA256(secret, payload) as full 64-char hex
 *
 * Headers: X-Media-Action (store|delete), X-Media-Group, X-Media-Key,
 *          X-Media-Variant ("-" for delete), X-Media-Ts, X-Media-Sig.
 *
 * store:  raw body = one WebP file. Validated (magic bytes + size) then
 *         written atomically (tmp name + rename) to
 *         <root>/<group>/<k1>/<k2>/<key>_<t|d>.webp — outside the webroot.
 * delete: empty body. Removes both variants of <key>, best effort.
 *
 * Timestamp window is ±300 s; TLS carries the rest. Replays within the
 * window only rewrite identical bytes to the identical path (idempotent).
 *
 * Storage quota: if 'quota' > 0 in the config, a NEW store is refused with
 * HTTP 507 (Insufficient Storage) when the bytes already on disk plus this
 * body would exceed the cap. Deletes are NEVER quota-blocked — the nightly
 * purge and avatar replacement always stay able to free space.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function reply(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

/**
 * Config lookup that survives BOTH cPanel docroot layouts:
 *   - standalone subdomain docroot  /home/USER/media.jobready.co.ke
 *     -> config one level above (the account home)
 *   - nested docroot                /home/USER/public_html/media
 *     -> config in the account home, TWO levels above the docroot (one
 *        level above would be inside the main domain's webroot)
 * First existing file wins; home-dir placement is the recommended default.
 */
function loadMediaConfig(): array
{
    foreach ([
        __DIR__ . '/../helpnest-media.config.php',
        __DIR__ . '/../../helpnest-media.config.php',
    ] as $candidate) {
        if (is_file($candidate)) {
            return require $candidate;
        }
    }

    return [];
}

$config = loadMediaConfig();
$secret = (string) ($config['secret'] ?? '');
$root   = rtrim((string) ($config['root'] ?? ''), '/');

if ($secret === '' || $root === '') {
    reply(500, ['ok' => false, 'error' => 'not configured']);
}

$action  = isset($_SERVER['HTTP_X_MEDIA_ACTION'])  ? (string) $_SERVER['HTTP_X_MEDIA_ACTION']  : '';
$group   = isset($_SERVER['HTTP_X_MEDIA_GROUP'])   ? (string) $_SERVER['HTTP_X_MEDIA_GROUP']   : '';
$key     = isset($_SERVER['HTTP_X_MEDIA_KEY'])     ? (string) $_SERVER['HTTP_X_MEDIA_KEY']     : '';
$variant = isset($_SERVER['HTTP_X_MEDIA_VARIANT']) ? (string) $_SERVER['HTTP_X_MEDIA_VARIANT'] : '-';
$ts      = isset($_SERVER['HTTP_X_MEDIA_TS'])      ? (string) $_SERVER['HTTP_X_MEDIA_TS']      : '';
$sig     = isset($_SERVER['HTTP_X_MEDIA_SIG'])     ? (string) $_SERVER['HTTP_X_MEDIA_SIG']     : '';

// --- Request freshness ------------------------------------------------------

if (!ctype_digit($ts) || abs(time() - (int) $ts) > 300) {
    reply(403, ['ok' => false, 'error' => 'stale timestamp']);
}

// --- Read the raw body (capped) ---------------------------------------------

$body = '';
{
    $stream = fopen('php://input', 'rb');

    if ($stream === false) {
        reply(400, ['ok' => false, 'error' => 'unreadable body']);
    }

    $body = (string) stream_get_contents($stream, 2 * 1024 * 1024 + 1, 0);
    fclose($stream);
}

if (strlen($body) > 2 * 1024 * 1024) {
    reply(413, ['ok' => false, 'error' => 'payload too large']);
}

// --- Signature over the exact bytes received --------------------------------

if (strlen($sig) !== 64 || !ctype_xdigit($sig)) {
    reply(403, ['ok' => false, 'error' => 'malformed signature']);
}

$bodyHash = hash('sha256', $body);
$payload  = "hn.media.ship.v1|{$action}|{$group}|{$key}|{$variant}|{$ts}|{$bodyHash}";
$expected = hash_hmac('sha256', $payload, $secret);

if (!hash_equals($expected, $sig)) {
    reply(403, ['ok' => false, 'error' => 'bad signature']);
}

// --- Shared input validation -------------------------------------------------

if (!in_array($group, ['profile', 'kyc'], true)) {
    reply(400, ['ok' => false, 'error' => 'unknown group']);
}

if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $key) !== 1) {
    reply(400, ['ok' => false, 'error' => 'malformed key']);
}

function shardDir(string $root, string $group, string $key): string {
    return $root . '/' . $group . '/' . substr($key, 0, 2) . '/' . substr($key, 2, 2);
}

/**
 * Bytes currently stored under the root (files only; dotfiles such as this
 * function's own cache and in-flight .tmp writes are excluded).
 *
 * A full walk on every upload would be wasteful once the library grows, so
 * the result is cached in <root>/.usage-cache.json for $ttl seconds. After
 * each successful store the caller bumps the cached total by the body size,
 * which keeps the counter honest between TTL refreshes without rescanning.
 */
function storageUsage(string $root, int $ttl): int {
    if (!is_dir($root)) {
        return 0; // fresh install — nothing stored (or created) yet
    }

    $cacheFile = $root . '/.usage-cache.json';

    if ($ttl > 0 && is_file($cacheFile)) {
        $cache = json_decode((string) @file_get_contents($cacheFile), true);

        if (is_array($cache) && isset($cache['at'], $cache['bytes'])
            && (time() - (int) $cache['at']) < $ttl) {
            return (int) $cache['bytes'];
        }
    }

    $bytes = 0;
    $flags = FilesystemIterator::SKIP_DOTS | FilesystemIterator::CURRENT_AS_FILEINFO;
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, $flags),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($it as $info) {
        if ($info->isFile() && substr($info->getFilename(), 0, 1) !== '.') {
            $bytes += $info->getSize();
        }
    }

    if ($ttl > 0) {
        @file_put_contents($cacheFile, json_encode(['at' => time(), 'bytes' => $bytes]), LOCK_EX);
    }

    return $bytes;
}

// --- store -------------------------------------------------------------------

if ($action === 'store') {
    if (!in_array($variant, ['thumb', 'display'], true)) {
        reply(400, ['ok' => false, 'error' => 'unknown variant']);
    }

    // WebP magic bytes: "RIFF" ???? "WEBP". Belt and braces — the API only
    // ships freshly re-encoded WebP, but this endpoint trusts nothing.
    if (strlen($body) < 12 || substr($body, 0, 4) !== 'RIFF' || substr($body, 8, 4) !== 'WEBP') {
        reply(415, ['ok' => false, 'error' => 'not a webp payload']);
    }

    // --- Hard storage cap (see 'quota' in the config) -----------------------

    $quota = isset($config['quota']) ? (int) $config['quota'] : 0; // 0 = unlimited

    if ($quota > 0 && (storageUsage($root, 120) + strlen($body)) > $quota) {
        reply(507, ['ok' => false, 'error' => 'storage quota exceeded']);
    }

    $dir   = shardDir($root, $group, $key);

    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0755, true) && !is_dir($dir)) {
            reply(500, ['ok' => false, 'error' => 'cannot create storage directory']);
        }
    }

    $suffix = $variant === 'thumb' ? 't' : 'd';
    $final  = $dir . '/' . $key . '_' . $suffix . '.webp';
    $tmp    = $dir . '/.' . bin2hex(random_bytes(8)) . '.tmp';

    if (@file_put_contents($tmp, $body) !== strlen($body)) {
        @unlink($tmp);
        reply(500, ['ok' => false, 'error' => 'write failed']);
    }

    @chmod($tmp, 0644);

    // Same-directory rename = atomic on local filesystems.
    if (!@rename($tmp, $final)) {
        @unlink($tmp);
        reply(500, ['ok' => false, 'error' => 'finalize failed']);
    }

    // Keep the usage counter honest between TTL refreshes (cheap delta bump;
    // the next TTL expiry triggers a fresh full walk anyway).
    $cacheFile = $root . '/.usage-cache.json';

    if ($quota > 0 && is_file($cacheFile)) {
        $cache = json_decode((string) @file_get_contents($cacheFile), true);

        if (is_array($cache) && isset($cache['at'], $cache['bytes'])) {
            $cache['bytes'] = (int) $cache['bytes'] + strlen($body);
            @file_put_contents($cacheFile, json_encode($cache), LOCK_EX);
        }
    }

    reply(200, ['ok' => true, 'stored' => basename($final), 'bytes' => strlen($body)]);
}

// --- delete -------------------------------------------------------------------

if ($action === 'delete') {
    // Frees are always allowed — and they invalidate the usage cache so the
    // next store re-scans from a truthful baseline.
    @unlink($root . '/.usage-cache.json');

    $dir     = shardDir($root, $group, $key);
    $removed = [];

    foreach (['t', 'd'] as $suffix) {
        $final = $dir . '/' . $key . '_' . $suffix . '.webp';

        if (is_file($final) && @unlink($final)) {
            $removed[] = basename($final);
        }
    }

    reply(200, ['ok' => true, 'removed' => $removed]);
}

reply(400, ['ok' => false, 'error' => 'unknown action']);
