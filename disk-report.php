<?php
/**
 * HelpNest media — disk usage report (media host side).
 *
 * A simple scheduled script that sums filesize() across the storage root and
 * tells you how much disk the media library is using BEFORE you run out.
 * Designed for cPanel's cron (CLI PHP), e.g. monthly:
 *
 *   /usr/local/bin/php /home/YOURUSER/media.jobready.co.ke/disk-report.php
 *
 * (cPanel → Cron Jobs → add the command above; pick "Once per month" or a
 * custom schedule. Cron output is emailed to you automatically if you set an
 * email address in cPanel's "Send email when cron runs", or configure
 * 'email' in helpnest-media.config.php below.)
 *
 * What it reports
 *   - total files + bytes under the storage root
 *   - how much of the configured 'quota' that represents (default cap 20 GiB)
 *   - breakdown per group (profile / kyc)
 *   - the five largest shard folders (spot runaway growth)
 *   - ALERT prefix when total bytes exceed the 'warn' threshold or reach 95%
 *     of the quota
 *
 * It also prunes EMPTY shard directories left behind by deletes (safe: rmdir
 * only succeeds on empty folders, and the root itself is never touched).
 *
 * NOTE ON PER-USER TOTALS: files here are deliberately user-anonymous — they
 * live in UUID shard folders with no database on this host. The accurate
 * "per user" accounting lives on the API server (the media registry table):
 *   GET https://gateway.jobready.co.ke/api/media/admin/usage   (admin token)
 * This script answers "how much disk, which group, is anything exploding".
 *
 * This file is CLI-only and must NOT be reachable from the web (the .htaccess
 * deny-all already keeps it unreachable — do not whitelist it).
 *
 * Requires PHP 7.2+. No extensions beyond SPL.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'CLI only.']);
    exit;
}

// Config lookup that survives BOTH cPanel docroot layouts (standalone
// subdomain docroot or one nested inside public_html — see receive.php).
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
$root = rtrim((string) ($config['root'] ?? ''), '/');

if ($root === '' || !is_dir($root)) {
    fwrite(STDERR, "disk-report: storage root is not configured or missing ({$root})\n");
    exit(1);
}

// --- Options (config file may override; sane defaults otherwise) ------------

$reportCfg = isset($config['report']) && is_array($config['report']) ? $config['report'] : [];
$defaultLog = dirname($root) . '/helpnest-media-usage.log';
$logPath   = isset($reportCfg['log']) && $reportCfg['log'] !== '' ? (string) $reportCfg['log'] : $defaultLog;
$warnBytes = isset($reportCfg['warn']) && (int) $reportCfg['warn'] > 0 ? (int) $reportCfg['warn'] : 1073741824; // 1 GiB
$emailTo   = isset($reportCfg['email']) ? (string) $reportCfg['email'] : '';
$quotaBytes = isset($config['quota']) && (int) $config['quota'] > 0 ? (int) $config['quota'] : 0; // 0 = no cap

// --- Walk the storage root ---------------------------------------------------

$totalBytes = 0;
$totalFiles = 0;
$perGroup   = [];   // top-level dir (profile|kyc) => ['files' => n, 'bytes' => n]
$perShard   = [];   // "<group>/<k1>/<k2>" => bytes (for the top-5 hotspots)
$largest    = ['path' => '', 'bytes' => 0];
$emptyDirs  = [];

$flags = FilesystemIterator::SKIP_DOTS | FilesystemIterator::CURRENT_AS_FILEINFO;
$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($root, $flags),
    RecursiveIteratorIterator::SELF_FIRST
);

foreach ($iterator as $path => $info) {
    $realPath = $info->getPathname();

    if ($info->isDir()) {
        $emptyDirs[] = $realPath;
        continue;
    }

    if (!$info->isFile()) {
        continue; // skip links and anything odd
    }

    $size = $info->getSize();
    $totalBytes += $size;
    $totalFiles++;

    if ($size > $largest['bytes']) {
        $largest = ['path' => $realPath, 'bytes' => $size];
    }

    // Relative structure: <group>/<k1>/<k2>/<key>_<t|d>.webp
    $rel   = ltrim(substr($realPath, strlen($root)), '/');
    $parts = explode('/', $rel);

    if (count($parts) >= 4) {
        $group = $parts[0];
        $shard = $parts[0] . '/' . $parts[1] . '/' . $parts[2];

        if (!isset($perGroup[$group])) {
            $perGroup[$group] = ['files' => 0, 'bytes' => 0];
        }
        $perGroup[$group]['files']++;
        $perGroup[$group]['bytes'] += $size;

        if (!isset($perShard[$shard])) {
            $perShard[$shard] = 0;
        }
        $perShard[$shard] += $size;
    }
}

arsort($perShard);
$hotspots = array_slice($perShard, 0, 5, true);

// --- Prune empty shard directories (never the root itself) ------------------

$vacuumed = 0;

// CHILD_FIRST so innermost dirs are tested before their parents; sort deepest
// first as a belt-and-braces so a fully emptied subtree collapses too.
usort($emptyDirs, function ($a, $b) {
    $depthA = substr_count($a, '/');
    $depthB = substr_count($b, '/');

    return $depthB - $depthA;
});

foreach ($emptyDirs as $dir) {
    if ($dir === $root) {
        continue;
    }

    if (@rmdir($dir)) {
        $vacuumed++;
    }
}

// --- Human helpers ------------------------------------------------------------

function humanBytes(float $bytes): string
{
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $i = 0;

    while ($bytes >= 1024 && $i < count($units) - 1) {
        $bytes /= 1024;
        $i++;
    }

    return round($bytes, $i === 0 ? 0 : 1) . ' ' . $units[$i];
}

// --- Build the report ----------------------------------------------------------

$now      = date('c');
$quotaPct = $quotaBytes > 0 ? ($totalBytes / $quotaBytes) * 100 : 0.0;
$alert    = $totalBytes > $warnBytes || ($quotaBytes > 0 && $quotaPct >= 95.0);
$lines    = [];
$lines[]  = 'HelpNest media disk report — ' . $now;
$lines[]  = str_repeat('=', 60);
$lines[]  = ($alert ? 'ALERT: ' : 'Status: ') . humanBytes((float) $totalBytes) . ' used by '
    . number_format((float) $totalFiles) . ' files'
    . ($alert ? ' (over the ' . humanBytes((float) $warnBytes) . ' threshold!)' : ' (within threshold)');

if ($quotaBytes > 0) {
    $lines[] = sprintf(
        'Quota: %s of %s (%.1f%%) — %s of headroom left before uploads are refused (HTTP 507).',
        humanBytes((float) $totalBytes),
        humanBytes((float) $quotaBytes),
        $quotaPct,
        humanBytes((float) max(0, $quotaBytes - $totalBytes))
    );
}

if (empty($perGroup)) {
    $lines[] = 'Storage root is empty (no media uploaded yet).';
} else {
    $lines[] = 'Per group:';

    foreach ($perGroup as $group => $stats) {
        $lines[] = sprintf(
            '  %-10s %6d files  %10s',
            $group,
            (float) $stats['files'],
            humanBytes((float) $stats['bytes'])
        );
    }
}

if (!empty($hotspots)) {
    $lines[] = 'Largest shard folders:';

    foreach ($hotspots as $shard => $bytes) {
        $lines[] = sprintf('  %-24s %10s', $shard, humanBytes((float) $bytes));
    }
}

if ($largest['path'] !== '') {
    $lines[] = 'Largest single file: ' . humanBytes((float) $largest['bytes']) . '  '
        . str_replace($root . '/', '', $largest['path']);
}

$lines[] = 'Empty shard dirs removed: ' . $vacuumed;
$lines[] = '';

$report = implode("\n", $lines);

// --- Deliver: stdout (cron email), log file, optional explicit email ----------

echo $report;

if ($logPath !== '') {
    // One file, appended monthly — rotate manually if it ever grows.
    @file_put_contents($logPath, $report, FILE_APPEND | LOCK_EX);
}

if ($emailTo !== '') {
    $subject = ($alert ? '[HELPNEST MEDIA ALERT] ' : '[HelpNest] ')
        . 'media disk report: ' . humanBytes((float) $totalBytes);
    @mail($emailTo, $subject, $report, 'From: disk-report@media.jobready.co.ke');
}

exit($alert ? 2 : 0);
