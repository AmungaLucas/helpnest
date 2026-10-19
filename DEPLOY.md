> **TRANSFER BUILD — THE SECRET IS A PLACEHOLDER.**
> Before uploading, inject the real value from the gateway's `.env`
> (MEDIA_REMOTE_SECRET) into `helpnest-media.config.php` — one `sed` command,
> see the chat instructions. Uploads fail with `bad signature` until then.

# HelpNest Media — Single-Host deploy: media subdomain (webexpert cPanel)

**This zip goes to the SAME cPanel account that runs `gateway.jobready.co.ke`**
(webexpert, user `cgqcqobh`). It fills the `media.jobready.co.ke` subdomain
created at docroot `/home/cgqcqobh/public_html/media`: 4 files into that
docroot + 1 config file into the account home `/home/cgqcqobh/`. Files are
stored outside the webroot (in `/home/cgqcqobh/helpnest-media`) and streamed
only through signed URLs, with a hard 20 GB cap on the media library.

The API half needs NO redeploy — its `.env` already points at
`https://media.jobready.co.ke/...`; only the DNS record changes. This guide
covers everything: subdomain creation, DNS, AutoSSL, crons, verification and
teardown of the old telahosting copy.

## What's in this zip

```
media.jobready.co.ke/
├── DEPLOY.md                    ← this guide (full: Part A + Part B + checks)
├── helpnest-media.config.php    ← upload to /home/cgqcqobh/ (account home,
│                                   NOT the docroot's parent — step A4)
└── public_html/                 ← upload CONTENTS into the subdomain
    │                              document root (step A3)
    ├── stream.php
    ├── receive.php
    ├── disk-report.php
    └── htaccess                 ← rename to .htaccess after upload
```

---

This edition **moves media storage onto the same webexpert cPanel account that
already runs `gateway.jobready.co.ke`**, replacing the old split with the
DirectAdmin box (198.251.84.236, "telahosting") that kept challenging uploads
with bot verification and served the wrong signing secret ("bad signature").

| Server | Domain | Role |
|---|---|---|
| webexpert cPanel account | `gateway.jobready.co.ke` + `media.jobready.co.ke` | API (Node/Passenger) **and** media storage/streaming on one disk |

**Why one host:** one account means one secret in one place (no more deployed
config drift), no cross-host firewall to negotiate, no LiteSpeed bot filter in
the API→media path, one panel, one bill, and AutoSSL covers the subdomain.
The API still encodes every upload to WebP and **ships** the small variants to
`media.jobready.co.ke` over HTTPS with an HMAC signature — the PHP media stack
is unchanged, only its home changes.

**Plan fit:** the cPanel plan gives 30 GB. The media library is now **hard-capped
at 20 GB** (enforced in `receive.php` — new uploads are refused with HTTP 507
once the cap is reached; deletes and the nightly purge always stay allowed).
That leaves ~10 GB for the Node app, `node_modules`, logs, email and the DB.

**What you get after this update**

- `POST /api/media/upload` — authenticated image upload (JPG/PNG/WebP in)
- Everything re-encoded to WebP in two sizes **at upload time** (thumb 320px for
  lists, display for profiles — nothing is resized on request), stripping all
  EXIF metadata (GPS, device info); originals discarded
- KYC documents are encoded at higher quality (85) and larger max size (2000px)
  than profile pictures (80 / 1600px) so IDs stay readable for review
- **Last-2-versions lifecycle**: replacing a profile picture keeps the previous
  one for a grace window (in-flight signed links keep working), then the nightly
  cron purge frees it — disk tracks the current photo, not the whole history
- `POST /api/media/admin/purge` — cron-driven cleanup + daily disk ledger
- `GET /api/media/admin/usage` — per-user / per-kind disk accounting (admin)
- Monthly disk report (`disk-report.php`, cPanel cron) with a **quota line**:
  GB used of the 20 GB cap, % used, headroom left, ALERT at 16 GB or ≥95%
- **20 GB hard cap** on the media library (507 past the cap; cleanup unblocked)
- Files stored in `~/helpnest-media/` — **outside any webroot**. No browser
  link can open a file directly; a correct URL returns 404.
- Viewing requires a signed URL valid for 5 minutes, issued only after a
  permission check. Shared links die; forged links fail the HMAC check.
- Worker cards / profile pages / drawer show real avatars once uploaded.

**Nothing to migrate:** the old media root never received a single successful
upload (every ship failed before storage), so there is no data to copy. Deploy
**in this order**: Part A (media subdomain on cPanel) first, then Part B —
which is verification only, because the API's `.env` already points at the same
hostname.

---

---

## PART A — media subdomain (webexpert cPanel — same host as the API)

> **Panel:** the webexpert cPanel that hosts `gateway.jobready.co.ke`.
> `YOURUSER` below = your cPanel username. You can see it — together with the
> **Shared IP Address** you'll need in A2 — in cPanel home → right sidebar →
> **Server Information**. Note both now.

### A1. Create the subdomain — DONE ✓

You already created it. cPanel reported:

```
Success: You have successfully created the new "media.jobready.co.ke" domain
with the document root of "/home/cgqcqobh/public_html/media"
```

Note the docroot is **nested inside the main domain's webroot**
(`public_html/media`) rather than the standalone default — that is fine: the
PHP stack below auto-detects both layouts (it searches for its config one AND
two levels above its own folder), and every path in this guide uses your real
docroot. No need to change anything in the panel.

If you ever recreate it, the steps are: cPanel → **Domains** → **Create A New
Domain** → domain `media.jobready.co.ke`, **untick "Share document root"**,
submit (older builds: Domains → Subdomains).

### A2. Point the DNS record at webexpert

Today `media.jobready.co.ke` resolves to `198.251.84.236` (the old host). It
must point at the **webexpert Shared IP** from Server Information.

- **Where to edit:** the `jobready.co.ke` DNS zone is currently served by the
  old host's nameservers → edit it there (DirectAdmin → Account Manager →
  DNS Management → the `media` A record). If you later move the domain's
  nameservers to the registrar or to webexpert, the record moves with it.
  (Creating the subdomain in A1 may have auto-created a zone on webexpert —
  harmless either way; the nameservers decide which zone is authoritative.)
- **Change:** `media  A  198.251.84.236  →  WEEXPERT-IP` — set TTL to 300 so
  the switch propagates in minutes.
- **Verify:** `nslookup media.jobready.co.ke` → the new IP. Until A3–A5 are
  done the URL may show a default page or certificate warning — expected.

Switching DNS first is safe: nothing is stored on either host yet, and the
API simply fails uploads cleanly until the files below are in place.

### A3. Upload the PHP endpoints

This host's package is `media.jobready.co.ke-cpanel-deploy-2026-10-19.zip`.
In cPanel → **File Manager**, from the zip's `public_html/` folder, upload
into the subdomain's document root (`/home/cgqcqobh/public_html/media/`):

| Package file | Upload as (in docroot) |
|---|---|
| `stream.php` | `stream.php` |
| `receive.php` | `receive.php` |
| `disk-report.php` | `disk-report.php` (CLI-only cron script; the web is still denied to it) |
| `htaccess` | rename to `.htaccess` (File Manager: Settings → Show Hidden Files, then Rename) |

The document root must contain **only** these four entries (three PHP files +
`.htaccess`). Never place images there.

### A4. Configure

Upload `helpnest-media.config.php` into the **account home directory** —
i.e. exactly:

```
/home/cgqcqobh/helpnest-media.config.php
```

(Because your docroot is nested inside `public_html`, the home directory is
the only placement that is guaranteed never to be web-served. Both PHP
endpoints search for the config one and two levels above their own folder,
so `/home/cgqcqobh/` — two levels above `/home/cgqcqobh/public_html/media/`
— is found automatically.)

What's already filled in — don't change it:

- `secret` — matches the API's `.env` (`MEDIA_SIGNING_SECRET` /
  `MEDIA_REMOTE_SECRET`). **This is the one file that ended the "bad
  signature" era: the secret now exists in exactly two files, on one account.**
- `root` — auto-derives to `/home/cgqcqobh/helpnest-media` (the config's own
  folder + `/helpnest-media`) — **outside both webroots**
  (`public_html` and `public_html/media`); shard folders are created
  automatically on first upload.

What's new — the quota block:

```php
$hnQuota = 20 * 1024 * 1024 * 1024; // 20 GiB
```

`receive.php` refuses NEW uploads that would push stored bytes past this cap
(HTTP 507, `storage quota exceeded`); deletes and the nightly purge are never
blocked. Set `0` to disable the cap. The `report` block below it controls the
monthly disk report: `log` (keep outside the webroot), `warn` — alert
threshold, preset to 16 GiB = 80% of the quota — and `email` (optional
address that receives the report each run).

### A5. SSL (AutoSSL) — required before uploads can work

cPanel → **SSL/TLS Status** → tick `media.jobready.co.ke` → **Run AutoSSL**,
and wait for a valid Let's Encrypt certificate on that exact subdomain.

This step is mandatory: the API ships media over `https://`, and Node rejects
invalid or self-signed certificates — until AutoSSL succeeds, every upload
fails with a connection error. (On the old host this was managed server-side;
here it is one click.) Confirm by browsing
`https://media.jobready.co.ke/receive.php` — padlock + JSON 403.

### A6. Verify (browser or curl)

```bash
# stream with no signature must be refused:
curl -i "https://media.jobready.co.ke/s/profile/11111111-2222-3333-4444-555555555555?v=display&exp=9999999999&sig=00000000000000000000000000000000"
# → {"success":false,"message":"This media link is invalid or has expired."}  (HTTP 403)

# receiver without signature must be refused:
curl -i -X POST "https://media.jobready.co.ke/receive.php" --data "x"
# → {"ok":false,"error":"bad signature"}  (HTTP 403)

# direct file access is impossible (files aren't in the webroot):
curl -i "https://media.jobready.co.ke/helpnest-media/profile/aa/bb/x_d.webp"
# → 403 (denied by .htaccess) — and after real uploads, the same URL 404s/403s
#   because files physically live one level above, outside the webroot
```

PHP version: cPanel → MultiPHP Manager — 7.2+ (any current default) is fine.

If `/s/...` returns 500 or a plain 404 instead of the JSON above, the rewrite
is blocked: make sure the file is named `.htaccess` (leading dot), and if it
still fails remove the `Options -Indexes` line and retest.

### A7. Schedule the monthly disk report (cPanel cron)

cPanel → **Cron Jobs** → add a **monthly** job (e.g. minute `0`, hour `2`,
day of month `1`):

```
/usr/local/bin/php /home/cgqcqobh/public_html/media/disk-report.php
```

(If `php` isn't at that path, cPanel → Terminal → `which php` tells you the
CLI binary.) Each run appends a report: total files + bytes, the **quota
line** (`Quota: 1.2 GB of 20 GB (6%) — …headroom left…`), breakdown per group,
five largest shard folders, largest single file, and an **ALERT** once usage
passes `warn` or 95% of the quota. It also silently removes empty shard
folders left behind by deletes. Set your address in cPanel → Cron Jobs →
"Send email when a cron job runs", or `'email'` in the config, to get it
mailed automatically; otherwise the log `~/helpnest-media-usage.log` keeps
the history.

> **Why this report has no per-user totals:** files here are deliberately
> anonymous (UUID shard folders, no database). True per-user accounting lives
> on the API — see B3.

### A8. Retire the old media host (after Part B verifies)

Keep the old DirectAdmin stack in place for a day or two after the switch —
until then, flipping the DNS A record back is your instant rollback. Once
uploads are verified on the new host:

- DirectAdmin (`d7.my-control-panel.com:2222`) → delete the
  `media.jobready.co.ke` domain files (or the subdomain itself),
  `/home/YOURUSER/helpnest-media/` and
  `/home/YOURUSER/domains/media.jobready.co.ke/helpnest-media.config.php`,
  plus any cron job referencing `disk-report.php` there.
- Leave the `jobready.co.ke` main site untouched.
- The old config carries the same shared secret — one more reason to delete
  it once the host is retired.

---

---

## PART B — API server (gateway.jobready.co.ke · cPanel) — no redeploy needed

The live API build already ships media to `https://media.jobready.co.ke/…` —
the **same hostname**, now resolving to the same machine. No `.env` change,
no `npm install`, no restart. This part is verification only.

### B1. Verify the API side

```bash
# API still healthy
curl https://gateway.jobready.co.ke/api/health

# Media probe (needs a login token — sign in via the app or take one from
# the app's network traffic):
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
     https://gateway.jobready.co.ke/api/media/health
# → {"success":true,"media":{"encoder":{"mode":"auto","active":"sharp"},
#    "storage":{"mode":"remote","remoteConfigured":true,
#               "signedUrlBase":"https://media.jobready.co.ke/s"}}}

# SECURITY CHECK — unsigned stream requests must never work:
curl -i https://gateway.jobready.co.ke/api/media/stream/profile/11111111-2222-3333-4444-555555555555
# → 403 {"success":false,"message":"This media link is invalid or has expired."}
```

### B2. Device test (end to end)

Log in → Profile → Overview → tap the avatar → pick a photo → square-crop →
wait for upload. The photo appears in the drawer header immediately; other
users' lists show it as a thumbnail. This exercises the full chain — including
the API→media ship, which now travels to the same box.

Disk check in cPanel → File Manager: `~/helpnest-media/` fills up as uploads
succeed (every avatar ≈ 30–80 KB total across both variants). If an upload
spins forever, A5's certificate is the usual suspect — see the pre-check
section below.

### B3. Cron purge + per-user accounting (unchanged, still required)

**Nightly purge (cPanel → Cron Jobs on the API host — keep/confirm):**

```
0 3 * * * curl -fsS -X POST -H "X-Media-Cron-Secret: 13bd2b74230fbf5f19a94030a961d237aa5109fc89b7ea8d0e7df4b935c3aa26" https://gateway.jobready.co.ke/api/media/admin/purge >> $HOME/media-purge.log 2>&1
```

(The secret is the package `.env`'s `MEDIA_CRON_SECRET` — if you generated
your own, use that. A wrong/missing secret gets a 403; an unset
`MEDIA_CRON_SECRET` env var keeps the endpoint disabled with 503.)

**Per-user disk accounting (run anytime, no cron):**

```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
     https://gateway.jobready.co.ke/api/media/admin/usage
# → { "success":true, "usage":{ "totals":{"files":N,"bytes":B},
#      "byKind":[{"kind":"profile",...},{"kind":"kyc_id_front",...}],
#      "topUsers":[{"ownerId":"…","files":N,"bytes":B}, ...] } }
```

**Lifecycle reminder:** a new profile picture immediately retires the old one
(`status='superseded'` — no longer linkable, files kept ~24h so recently
issued 5-minute links keep resolving), and only the current + one previous
version are ever on disk; anything older is deleted at upload time. The cron
purge frees the superseded files; KYC keeps every version until
`MEDIA_KYC_RETENTION_DAYS` says otherwise.

> **Note for future redeploys:** if you ever rebuild/redeploy the API from
> source, use the current `maid-app-gateway.zip` — its source now carries the
> Chrome User-Agent patch that the live box received as a hand-fix during the
> bot-protection saga.

---

---

## Connectivity pre-check (one command, anywhere with shell)

```bash
curl -sI https://media.jobready.co.ke/receive.php | head -1
# expect "HTTP/2 403" or "HTTP/1.1 403 Forbidden"
```

403 = reachable and correctly refusing unsigned calls (perfect). The
cross-host firewall class of problems is structurally gone — both domains are
now the same machine. In the rare case that this curl **run on the gateway
box itself** (cPanel → Terminal) times out, the server's loopback/self-HTTPS
access is restricted; ask webexpert to allow the account to query its own
443. Every other client (phone, browser, your PC) testing 403 here is
already proof enough.

---

---

## Security model summary

| Layer | Guarantee |
|---|---|
| Storage outside the webroot | Correct file URL in any browser → 403/404 |
| UUID filenames + shard dirs | Nothing guessable or enumerable |
| HMAC-SHA256 URL signatures (32 hex, 5-min TTL) | Forged/altered/expired links die |
| Permission check before signing | `profile` → any logged-in user; `kyc_*` → owner or admin only |
| Superseded (old) avatars not linkable | Old versions stop being signable immediately; files freed ≤24h later by cron |
| Cron purge behind a dedicated secret | Nobody can wipe media without the `MEDIA_CRON_SECRET` |
| Receiver auth: HMAC over exact body + freshness window | Only the API can write/delete; replays are idempotent |
| Receiver input whitelists | group ∈ {profile,kyc}, UUID key, variant, WebP magic bytes, 2 MB cap |
| **Hard quota (20 GiB)** | New uploads refused with 507 past the cap; deletes/purge never blocked; counter TTL-cached + delta-bumped, report shows % used |
| Decode→re-encode at the API | EXIF/GPS stripped; disguised scripts destroyed |
| Docroot deny-all except the PHP endpoints | Nothing accidentally dropped in the docroot is servable; `disk-report.php` is CLI-only |
| Atomic writes (tmp + rename) | No partially-written images ever served |
| Owner dedupe (sha256, at the API) | Re-uploads don't burn quota |

The one shared secret lives in exactly two files, now on the same account:
the API's `.env` (`MEDIA_SIGNING_SECRET` + `MEDIA_REMOTE_SECRET`) and
`helpnest-media.config.php` (`secret`). Rotating it means updating both files
and restarting the Node app.

### Rollback

- **DNS flip:** while the old DirectAdmin stack still exists (before A8),
  pointing `media` back at `198.251.84.236` restores the previous setup in
  minutes. Nothing was deleted from the old host until A8.
- **API:** untouched by this move — no redeploy, no restart, no `.env` change.
- **Database:** unchanged; the v3 schema (additive) stays as deployed.
- The PHP media stack is inert without signed requests, so a half-deployed
  Part A can never corrupt anything.

### Roll forward (if a step misbehaves)

- Uploads fail with a connection error → A5's AutoSSL hasn't issued a valid
  cert for `media.jobready.co.ke` yet (most common).
- Uploads fail with `bad signature` → the config landed in the wrong folder;
  it must be in the account home `/home/cgqcqobh/` (A4) — the endpoints
  search one and two levels above their own folder for it.
- Uploads fail with `storage quota exceeded` → the 20 GiB cap is doing its
  job; run the purge, check `/api/media/admin/usage`, or raise `quota` in the
  config.
- 404 on `/s/...` URLs → `.htaccess` missing or misnamed in the docroot (A3).

