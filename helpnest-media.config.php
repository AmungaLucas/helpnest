<?php
/**
 * HelpNest media — configuration (media host side).
 *
 * PLACE THIS FILE IN THE ACCOUNT HOME DIRECTORY (recommended), e.g.
 *   /home/USER/helpnest-media.config.php
 *
 * Both stream.php and receive.php (and disk-report.php) search for it ONE and
 * TWO levels above their own folder, so this works for both cPanel docroot
 * layouts:
 *   - standalone docroot /home/USER/media.jobready.co.ke     (home = 1 above)
 *   - nested docroot     /home/USER/public_html/media        (home = 2 above)
 * Keeping it in the HOME guarantees it can never be served by the web server
 * (a nested docroot's parent, public_html, is itself a webroot — avoid it).
 *
 * The secret MUST be the exact same value as MEDIA_SIGNING_SECRET and
 * MEDIA_REMOTE_SECRET in the API's .env on gateway.jobready.co.ke.
 * A mismatch surfaces in the app as:
 *   "Media host rejected the upload: bad signature"
 */

// 64-hex shared secret — identical to MEDIA_SIGNING_SECRET / MEDIA_REMOTE_SECRET
// in the API's .env (this package's .env already carries the same value).
$hnSecret = 'CHANGE_ME_secret_from_gateway_.env_MEDIA_REMOTE_SECRET';

// Storage root (OUTSIDE any webroot). Files land at
// <root>/<group>/<k1>/<k2>/<key>_<t|d>.webp — created automatically.
//
// AUTO-DERIVED: this config file sits in the account's home directory (one
// level above the docroot), so __DIR__ is /home/USER — no manual editing
// needed. Override with an absolute path only if you want the media stored
// elsewhere (e.g. a second disk: '/media/helpnest-data').
$hnRoot = __DIR__ . '/helpnest-media';

// Hard cap for the whole media library, in bytes. The account plan is 30 GB,
// of which up to 20 GB should go to media — leaving room for the Node app,
// node_modules, logs, email and the database.
//
// receive.php refuses NEW uploads that would push stored bytes past this cap
// (HTTP 507 "storage quota exceeded"); deletes and the nightly purge are
// NEVER blocked, so cleanup can always free space. Set 0 to disable the cap.
$hnQuota = 20 * 1024 * 1024 * 1024; // 20 GiB

// Optional: monthly disk usage report (disk-report.php, run via cPanel cron).
//   log   – where the report is appended (keep OUTSIDE the webroot)
//   warn  – alert threshold in bytes (report subject/exits with ALERT above this;
//           16 GiB = 80% of the quota — tune together with 'quota' above)
//   email – set to your address to also receive the report by mail each run
$hnReport = [
    'log'   => __DIR__ . '/helpnest-media-usage.log',
    'warn'  => 16 * 1024 * 1024 * 1024,
    'email' => '',
];

return [
    'secret' => $hnSecret,
    'root'   => $hnRoot,
    'quota'  => $hnQuota,
    'report' => $hnReport,
];
