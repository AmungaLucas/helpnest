<?php
/**
 * HelpNest media — signed streaming endpoint (media host side).
 *
 * Files stored by receive.php live OUTSIDE this webroot. The ONLY way a byte
 * reaches a browser is through here, and only with a valid signature:
 *
 *   URL:  /s/<group>/<key>?v=thumb|display&exp=<unix>&sig=<32 hex>
 *         (the .htaccess rewrites /s/... onto this file)
 *
 *   sig   = first 32 hex chars of HMAC-SHA256(
 *             secret, "hn.media.v1|<group>|<key>|<variant>|<exp>" )
 *
 * Signatures are issued by the API (gateway.jobready.co.ke) only after its
 * JWT + permission check, and expire in 5 minutes. This script never talks
 * to a database — the URL itself carries everything needed to locate the
 * file on disk, and the HMAC proves the API authorized it.
 *
 * Requires PHP 7.2+ (any cPanel default). No extensions beyond SPL.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

/**
 * Config lookup that survives BOTH cPanel docroot layouts (standalone
 * subdomain docroot or one nested inside public_html — see receive.php).
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
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Media storage is not configured.']);
    exit;
}

function deny(int $code, string $message): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

$group   = isset($_GET['group'])   ? (string) $_GET['group']   : '';
$key     = isset($_GET['key'])     ? (string) $_GET['key']     : '';
$variant = isset($_GET['v'])       ? (string) $_GET['v']       : 'display';
$exp     = isset($_GET['exp'])     ? (string) $_GET['exp']     : '';
$sig     = isset($_GET['sig'])     ? (string) $_GET['sig']     : '';

$denyMsg = 'This media link is invalid or has expired.';

// --- Validate every input against a whitelist before touching the disk ------

if (!in_array($group, ['profile', 'kyc'], true)) {
    deny(403, $denyMsg);
}

// Storage keys are UUIDv4 strings minted by the API.
if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $key) !== 1) {
    deny(403, $denyMsg);
}

if (!in_array($variant, ['thumb', 'display'], true)) {
    deny(403, $denyMsg);
}

if (!ctype_digit($exp) || (int) $exp < time()) {
    deny(403, $denyMsg); // covers forged and merely expired links alike
}

if (strlen($sig) !== 32 || !ctype_xdigit($sig)) {
    deny(403, $denyMsg);
}

// --- Signature (constant-time compare) --------------------------------------

$payload  = "hn.media.v1|{$group}|{$key}|{$variant}|{$exp}";
$expected = substr(hash_hmac('sha256', $payload, $secret), 0, 32);

if (!hash_equals($expected, $sig)) {
    deny(403, $denyMsg);
}

// --- Locate the file: <root>/<group>/<k1>/<k2>/<key>_<t|d>.webp -------------

$suffix = $variant === 'thumb' ? 't' : 'd';
$k1     = substr($key, 0, 2);
$k2     = substr($key, 2, 2);
$path   = $root . '/' . $group . '/' . $k1 . '/' . $k2 . '/' . $key . '_' . $suffix . '.webp';

// realpath() resolves symlinks and any '..' trickery; require the result to
// stay inside the storage root.
$real = realpath($path);

if ($real === false || strpos($real, $root . DIRECTORY_SEPARATOR) !== 0 || !is_file($real)) {
    deny(404, 'Media not found.');
}

// --- Stream -----------------------------------------------------------------

$size = @filesize($real);

if ($size === false) {
    deny(404, 'Media not found.');
}

header_remove('Content-Type');
header('Content-Type: image/webp');
header('Content-Length: ' . (string) $size);
// URIs are unique per signature so client caches may keep them briefly;
// 'private' keeps shared proxies out of the loop.
header('Cache-Control: private, max-age=300');
http_response_code(200);

readfile($real);
