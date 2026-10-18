# HelpNest — Build Plan & Delivery Checklist

**Version:** 1.0 · **Date:** 2026-10-18
**Source:** HelpNest Comprehensive Product & Technical Documentation v1.0 (Oct 2026)
**Code:** frontend `/` (Expo SDK 57) · backend deployed at `https://gateway.jobready.co.ke`

## How to use this file

- Tick a box `[x]` only when the work is **merged, deployed to production, and verified on a device**.
- Status markers: `[x]` done · `[~]` in progress · `[ ]` to do · `[!]` blocked / decision needed.
- Sizing: **S** < 1 day · **M** 1–3 days · **L** 3–5 days (one developer + AI pairing).
- Each wave ends with a **Gate** — device-verified acceptance criteria. Do not start the next wave's backend work until the previous gate passes (frontend polish may overlap).
- Task IDs (`W3-B2`, `P2-1`) are referenced in commits: `git commit -m "feat(jobs): W3-B2 job CRUD ..."`.

## Progress snapshot

| Wave | Scope | Tasks | Done | Status |
|---|---|---|---|---|
| 0 | Baseline shipped | 8 | 8 | ✅ complete |
| 1 | Stabilize & verify | 4 | 0 | 🔶 start here |
| 2 | Profiles & KYC | 13 | 0 | ⬜ |
| 3 | Jobs, applications & credits | 12 | 0 | ⬜ |
| 4 | Chat, anti-contact & unlock | 11 | 0 | ⬜ |
| 5 | Admin & moderation | 5 | 0 | ⬜ |
| 6 | Notifications | 4 | 0 | ⬜ |
| 7 | Legal & launch | 7 | 0 | ⬜ |
| P2 | Phase 2 | 9 | 0 | ⬜ |
| P3 | Phase 3 | 5 | 0 | ⬜ |

---

## Wave 0 — Baseline shipped ✅

Reference of what already exists in production (do not re-plan):

- [x] **Expo app + brand system** — forest-green/cream/gold theme (`src/theme/colors.js`), shared logo, splash with breathing loop, RoleSelector onboarding start.
- [x] **Auth backend** — `POST /api/auth/signup`, `/otp/send`, `/otp/verify`, `/login`, `/refresh`, `/logout`, `GET /me`; TalkSasa SMS OTP; JWT access (~12h) + rotating refresh tokens (SHA-256 hashed, `refresh_tokens` table); OTP codes in `otp_codes`.
- [x] **Auth frontend** — signup / OTP / password login screens, show-hide toggles, sign-out, silent session restore, 401 → refresh-and-retry, SecureStore persistence.
- [x] **Navigation** — `RootNavigator` swaps `GuestStack` ↔ `AuthedStack` on session change (commit `cec89d2`); role tabs: Maid `Home|Find Jobs|Applications|Chats|Profile`, Employer `Home|My Jobs|Maids|Chats|Profile`; Chats = Material Top Tabs; Profile = drawer.
- [x] **Location** — permission on first launch, lat/lng captured every app open, stashed pre-auth then flushed via `PATCH /api/users/me` (verified live: Utawala coords persisted).
- [x] **Worker profiles (read side)** — `worker_profiles` table; `GET /api/workers` (list), `GET /api/workers/:userId`, `GET /api/workers/me`.
- [x] **M-Pesa pipeline** — STK push (Daraja, `CustomerBuyGoodsOnline`, shortcode 5511376 → till 9393975), signed callback, txn polling `GET /api/payments/txn/:id`; **verified end-to-end in production** (receipt `UJHO5AFM0W`, ~17s). Plans live: `test_kes1` (1 KES), `contact_unlock` (300 KES).
- [x] **Deployment** — DirectAdmin + Passenger layout at `gateway.jobready.co.ke/helpnest/`, health stamp `build: 2026-10-17.1`, re-runnable `schema.sql`.

---

## Wave 1 — Stabilize & verify current baseline (≈ S)

Small fixes and confirmations before new features. Total: S.

- [~] **W1-1 · Verify navigation-swap fix on device — S**
  Pull `cec89d2`, run `npx expo start -c` (cache clear is mandatory — stale Metro state is the prime suspect for the earlier stranded-screen bugs). Expect `[NAV] auth area -> authed` after OTP verify and `-> guest` after sign-out, landing on Home / Splash→RoleSelector respectively.
- [ ] **W1-2 · Confirm health stamp after latest deploy — S** — `GET /api/health` must show `build: 2026-10-17.1`; if not, redeploy the 2026-10-17 package.
- [!] **W1-3 · Reconcile contact-unlock price — S** — PRD §2.2 says **200 KES**, backend `payments.routes.js` PLANS has `contact_unlock: 300`. Decide 200 (PRD) or 300 (margin) and set the backend + all UI copy to match. *Needed before Wave 4 unlock payments.*
- [!] **W1-4 · Record endpoint-naming decision — S** — PRD §12.2 calls maid endpoints `/api/maids/*`; backend implements `/api/workers/*`. Decision: keep `/api/workers` as canonical and treat PRD as superseded on naming (no code churn), or rename now. Default: keep `/api/workers`.

**Gate 1:** OTP login lands on Home; sign-out lands on RoleSelector; `[NAV]` logs fire on both transitions; STK test payment still succeeds; health stamp correct.

---

## Wave 2 — Profiles & KYC (≈ M + L)

Goal: both roles have complete, editable profiles and a working KYC path (submit → review → verified badge). Total: L.

### Backend

- [ ] **W2-B1 · Schema: `employer_profiles`, `kyc_documents` — S** — add to `schema.sql` with `CREATE TABLE IF NOT EXISTS`; columns per PRD §12.1 (`employer_profiles`: household_size, number_of_children, bio; `kyc_documents`: user_id, kind (id_front/id_back/selfie), file_path, status, reviewer_id, reviewed_at).
- [ ] **W2-B2 · Maid profile write endpoint — M** — `PUT /api/workers/me` accepting age (18+), gender, languages (JSON array), bio, availability (`live-in|live-out|part-time`), expected_salary, region_of_origin (optional, never returned in search filters per PRD §13.2); zod-validated; upserts `worker_profiles`.
- [ ] **W2-B3 · Media infrastructure (DESIGN LOCKED 2026-10-19) — M** — `POST /api/media/upload` (multer memory, JWT) → magic-byte sniff → decode→re-encode to **WebP dual-variant** (thumb 320px q70 / display 1600px q80, KYC docs 2000px q85; EXIF stripped by re-encode; originals discarded); files stored in `~/domains/gateway.jobready.co.ke/helpnest-media/` — **outside any webroot**, UUID names, sharded dirs. `media` table = registry (owner, kind, sha256 dedupe, bytes). Viewing: `GET /api/media/:id/link` (JWT + permission matrix: `profile` → any logged-in user; `kyc_*` → owner/admin only) returns **HMAC-signed URL, 5-min TTL** (`MEDIA_BASE_URL` host-agnostic: same-origin today, `media.jobready.co.ke` subdomain later — one env flip). Stream endpoint verifies sig+exp only (no headers — RN `<Image>` compatible). KYC selfies are biometric data → never public URLs (PRD §13.1). Status: **built this milestone** (infra + avatar wiring); KYC submit UI = W2-F3.
- [ ] **W2-B4 · KYC submit + status — M** — `POST /api/kyc/submit` (references uploaded doc IDs: ID front/back + selfie) → `kyc_documents` rows + `users.kyc_status = 'pending'`; `GET /api/kyc/status` returns state + rejection reason. *Note: OCR is deferred to Phase 2 — MVP verification is human admin review within the 24h SLA (PRD §10.2).*
- [ ] **W2-B5 · Email verification — M** — pooled Nodemailer transporter (PRD §11.2 config); `POST /api/auth/email/send` (verification token, 24h expiry) + `POST /api/auth/email/verify`; set `users.email_verified`.
- [ ] **W2-B6 · Admin KYC endpoints — M** — `GET /api/admin/kyc?status=pending` (queue with document links), `POST /api/admin/kyc/:id/approve` → `kyc_status='verified'`, `verified_at=NOW()`, grant verification-bonus credits (Wave 3 hook), `POST /api/admin/kyc/:id/reject` (with reason → allows re-submit). All behind `requireRole('admin')`.
- [ ] **W2-B7 · Employer profile read/write — S** — `GET/PUT /api/employers/me` (household_size, number_of_children, bio).

### Frontend

- [ ] **W2-F1 · Maid Edit Profile screen — M** — drawer item wired to full form (photo picker via `expo-image-picker`, languages multi-select, availability chips, salary); optimistic save + error states.
- [ ] **W2-F2 · Employer household-details screen — S** — same drawer pattern for employers.
- [ ] **W2-F3 · KYC flow — L** — drawer "Verification" item: intro (what's collected & why — DPA consent copy), ID capture, selfie capture, upload progress, status card (unverified / pending / verified / rejected + reason), re-submit path.
- [ ] **W2-F4 · Email verification UX — S** — persistent banner while unverified; "Verify email" screen handling the token link.
- [ ] **W2-F5 · VerifiedBadge component — S** — muted-gold badge (PRD §1.5) rendered on worker cards, profiles and Home header from `kyc_status`.
- [ ] **W2-F6 · Worker profile detail enrichment — S** — display languages/availability/salary/bio on `WorkerProfileScreen` (already fetched via `GET /api/workers/:userId`).

**Gate 2:** maid submits ID+selfie → appears in admin queue → approve → badge shows on her profile and `kyc_status='verified'`; reject path returns reason and allows re-submit; email verify round-trips; profile edits survive app restart; uploads are not publicly reachable.

---

## Wave 3 — Jobs, applications & credits (≈ L)

Goal: employers post jobs (500 KES STK), maids buy credit bundles and apply; both sides track pipeline state. Total: L.

### Backend

- [ ] **W3-B1 · Schema: `jobs`, `applications`, `credit_ledger` — M** — columns per PRD §12.1; `credit_ledger`: user_id, delta, source (purchase/bonus/usage/expiry), expires_at (bonus credits expire 30 days), remaining balance derivable; add indexes on (status, expires_at) and (job_id, maid_id) unique to block double-apply.
- [ ] **W3-B2 · Job CRUD + expiry — L** — `POST /api/jobs` creates job with `status='draft'`; activation happens on `job_post` payment success (callback sets `active`, `expires_at = NOW() + 30 days`); `GET /api/jobs` (active only; filters: near-me radius from lat/lng, salary range, schedule, pagination); `GET /api/jobs/:id`; `GET /api/jobs/mine`; expiry sweep on read + a daily internal check.
- [ ] **W3-B3 · Entitlement-activating payment plans — M** — extend `PLANS` in `payments.routes.js`: `job_post` (500), `credit_starter` (50/1), `credit_basic` (120/3), `credit_popular` (250/6), `credit_pro` (400/12); callback switches by plan → activate job / insert credit ledger rows; idempotent activation (skip if txn already processed).
- [ ] **W3-B4 · Credits & apply — M** — `GET /api/credits/me` (balance + soonest expiry); `POST /api/jobs/:id/apply` in a DB transaction: check balance → deduct 1 credit (FIFO by expiry) → insert application → enforce safeguard caps (PRD §7.6: max 2 bundles purchased per 24h, 6 per month, 2h cooling-off after exhausting a bundle).
- [ ] **W3-B5 · Application pipeline — M** — `GET /api/applications/me` (maid view), `GET /api/jobs/:id/applications` (employer, with maid profile summary), `PATCH /api/applications/:id` (viewed / shortlisted / rejected; employer-owned only).

### Frontend

- [ ] **W3-F1 · Find Jobs browse + detail — M** — real feed on `FindJobsScreen` (filter sheet: near me, salary, schedule), job detail screen with apply CTA.
- [ ] **W3-F2 · Post Job flow — M** — multi-step form (title, description, salary, location, schedule, requirements) → total due 500 KES → reuse `MpesaCheckoutScreen` with `job_post` → success screen → My Jobs.
- [ ] **W3-F3 · My Jobs management — M** — `MyJobsScreen`: employer's jobs with days-remaining, applications per job (status chips, shortlist/reject actions), chat entry point (disabled until Wave 4).
- [ ] **W3-F4 · Applications tab — S** — maid's applications with status timeline (pending → viewed → shortlisted → rejected).
- [ ] **W3-F5 · Apply with credits — M** — apply button states: has credits (apply, optimistic), no credits (bundle sheet → STK), cooling-off (countdown), already applied.
- [ ] **W3-F6 · Credit bundle purchase UI — S** — PaymentHub tier cards with "Popular ★" on 250 KES; balance display in Home header for maids.

**Gate 3:** employer completes a real 500 KES STK (test first by mapping `job_post` amount to 1 KES in a staging plan) → job live in Find Jobs; maid buys Popular bundle → balance 6; apply decrements to 5 and blocks second apply on same job; employer shortlists; unexpired jobs only.

---

## Wave 4 — Chat, anti-contact & contact unlock (≈ L)

Goal: safe employer-initiated chat with PRD §6 limits, multi-layer anti-contact detection, masked contacts, and paid unlock with maid approval. Total: L.

### Backend

- [ ] **W4-B1 · Schema: `chats`, `messages`, `contact_unlocks`, `user_strikes` — M** — per PRD §12.1 plus `is_flagged`, `flag_reason` on messages; `contact_unlocks`: chat_id, requested_by, status (pending/approved/declined), payment_txn_id.
- [ ] **W4-B2 · Chat endpoints — L** — `POST /api/chats` (employer-initiated only in MVP; tier caps), `GET /api/chats` (both sides, with unread counts), `GET /api/chats/:id/messages` (cursor pagination), `POST /api/chats/:id/messages` enforcing the limit matrix: free pair 5 msgs/70 chars · both-verified 10/100 · subscribed unlimited/500 (PRD §6.2); cap counter is conversation-shared.
- [ ] **W4-B3 · Anti-contact detection engine — L** — pure module `src/services/contactGuard.js` with PRD §6.5 pipeline: **normalize** (strip whitespace/punctuation, leet `o→0 l→1 s→5 z→2`, EN+Swahili number words incl. Sheng, emoji digits) → **patterns** (KE phone regex on normalized, email incl. `at/dot` forms, social handles + platform names) → **context** (concatenate last 5 messages, re-run) → **verdict** (pass/flag). Ship with a test-vector suite covering all 6 MVP categories.
- [ ] **W4-B4 · Strike system — M** — flag → block message (never stored/delivered) + issue strike; ladder per PRD §6.7: 1 warning, 2 → 24h chat restriction, 3 → 7-day suspension, 4 → permanent ban; disclaimer copy exactly as PRD.
- [ ] **W4-B5 · Contact masking — S** — all API payloads serialize phone/email as `07** *** 123` unless the viewer holds an approved unlock or subscription (serialize.js hook).
- [ ] **W4-B6 · Contact unlock flow — M** — `POST /api/chats/:id/unlock` (either side; creates pending unlock + `contact_unlock` payment via STK at the W1-3-decided price), maid `POST /api/chats/:id/unlock/approve|decline`; on payment success + approval → both contacts revealed in chat payload; surfaced in Requests tab.
- [ ] **W4-B7 · Message delivery — S** — polling (client refetch ~5s in open thread, ~30s for lists); no websockets on shared Passenger host; document upgrade path.

### Frontend

- [ ] **W4-F1 · Conversations + Requests screens — M** — real data on both Material Top Tabs (Conversations list, unlock/interview requests with approve/decline).
- [ ] **W4-F2 · ChatThread screen — M** — bubbles, character counter (turns gold near limit), cap banner with "Upgrade / wait 24h" (PRD §6.2), optimistic send with retry.
- [ ] **W4-F3 · Blocked-message + strike UX — S** — inline disclaimer when a message is flagged; strike-count notice; restricted state screen during 24h lockout.
- [ ] **W4-F4 · Unlock UX both sides — M** — request sheet with price, maid approve/decline prompt, revealed-contact card after success.

**Gate 4:** every PRD §6.5 test vector blocked (incl. "zero seven moja mbili", spaced emails, "WhatsApp me"); free pair hits cap at 5 with upgrade prompt; verified pair extends to 10; masked payload verified via raw API response; unlock E2E: request → maid approves → both see contacts; strike ladder escalates correctly.

---

## Wave 5 — Admin & moderation (≈ L)

Goal: one operator can run KYC, payments, moderation and suspensions from a web panel without touching the DB. Total: L.

- [ ] **W5-B1 · Admin auth — M** — `requireRole('admin')` middleware (done in W2-B6) + TOTP 2FA (otplib) required at admin login (PRD §5.3); no admin accounts in the mobile app.
- [ ] **W5-B2 · Admin data endpoints — M** — `GET /api/admin/payments` (reconciliation: mpesa_transactions joined to entitlements, failures, manual-credit action), `GET /api/admin/flagged-chats` (blocked messages + strike context, false-positive override), `POST /api/admin/users/:id/suspend|reinstate` (kills refresh tokens), `GET /api/admin/reports`, `GET /api/admin/analytics` (signups, verifications, jobs, applications, chats, revenue by plan — PRD §10.1).
- [ ] **W5-B3 · Admin web panel — L** — lightweight server-rendered pages (or single-file SPA) served by the same Express app at `/admin` behind 2FA; modules: KYC queue (document viewer), payments, flagged chats, reports, suspensions, refunds log, analytics summary. Deployed under the existing Passenger app.
- [ ] **W5-B4 · User reports pipeline — M** — `POST /api/reports` (from app: profile / chat / job menus, category + note) → admin queue; SLA timestamps per PRD §10.2.
- [ ] **W5-B5 · Refund handling — S** — manual refund recording (mpesa_transactions note + credit adjustment / job deactivation) tracked in panel; policy copy from PRD §13.4.

**Gate 5:** suspending a test user blocks both app access (401s) and chat; a seeded flagged message appears in queue and can be dismissed as false positive; analytics counters match raw SQL counts; KYC queue approve/reject still works through the panel.

---

## Wave 6 — Notifications: email + SMS events (≈ M)

Goal: the PRD §11.3 event matrix fires reliably (SMS via TalkSasa, email via Nodemailer) with zero duplicates. Total: M.

- [ ] **W6-B1 · Email infrastructure — M** — single pooled transporter (host/port 465, `maxConnections: 5`, `maxMessages: 100` per PRD §11.2), env-based SMTP creds, branded HTML templates: email verification, KYC submitted/approved/rejected, payment receipt, application received.
- [ ] **W6-B2 · Event wiring — M** — hook the §11.3 matrix into existing flows: KYC submitted (SMS+email), KYC approved/rejected (SMS+email), payment success/failure (SMS+email), job posted (SMS to matching maids — batched), new application (SMS+email to employer), contact-sharing warning (SMS). SMS templates ≤160 chars, sender `HELPNEST`, E.164 format.
- [ ] **W6-B3 · Delivery log + idempotency — S** — `notifications_log` table (event, channel, provider message id, status, user_id, dedupe key); every send goes through one helper that refuses duplicate dedupe keys; DRY_RUN flag suppresses real sends in dev.
- [ ] **W6-F4 · In-app notification surfaces — S** — unread badge on Chats tab (from W4-B2 unread counts), Home header dots for KYC/payment status changes.

**Gate 6:** each event type fires exactly once per trigger (verified in `notifications_log`); DRY_RUN prevents TalkSasa spend in dev; payment receipt email contains M-Pesa receipt code.

---

## Wave 7 — Legal, compliance & launch readiness (≈ M)

Goal: store-ready, DPA-2019-aligned, and safe to operate in Nairobi. Total: M (excluding external lawyer time).

- [ ] **W7-1 · Terms of Service + Privacy Policy — M** — draft covering DPA 2019 requirements (PRD §13.1): explicit consent for sensitive data (KYC selfies), retention schedule (OTP logs, KYC docs, chats), data-subject rights (access/correction/delete endpoint or email process), NEA positioning as marketplace charging **platform access fees** (PRD §13.3). Route past a lawyer before launch.
- [ ] **W7-2 · Consent capture in-app — S** — signup checkboxes (ToS, privacy, location, KYC processing; marketing optional per PRD §13.5) with stored consent timestamps; tribe non-discrimination disclaimer on profile/search screens (PRD §13.2).
- [ ] **W7-3 · Refund policy surface — S** — in-app policy page mirroring PRD §13.4 (job posts non-refundable, credits non-transferable, subscription pro-rata ≤7 days, unlock non-refundable once approved).
- [ ] **W7-4 · Production build + store listing — M** — EAS build (AAB), `app.json` finalization (package id, icons/splash already in `assets/`), Play Console listing (screenshots from device, privacy form), internal testing track first.
- [ ] **W7-5 · Real-amount payment cutover — S** — re-verify every plan through Daraja **production** at real amounts (500 / 50 / 120 / 250 / 400 / unlock price), confirm callbacks + entitlement activation per plan; keep `test_kes1` for staging only.
- [ ] **W7-6 · Ops hardening — M** — uptime check on `/api/health`, structured error logging, DB backup cron, log rotation under Passenger, `uploads/` disk monitoring.
- [ ] **W7-7 · Launch content — S** — seed 15–20 real-looking jobs + verified demo profiles for Nairobi launch density; moderation staffing note against SLAs (PRD §10.2).

**Gate 7:** AAB installs on a physical device and talks to production; all plans pay at real amounts with receipts; consent timestamps stored; legal pages reachable in-app; backups restore-tested once.

---

## MVP exit checklist (definition of done for launch)

Every P0 line from PRD §14.1 mapped to its wave:

| PRD P0 item | Wave |
|---|---|
| Signup/login with OTP (Talksasa) | ✅ Wave 0 |
| Maid KYC (ID + selfie + phone + email) | W2 |
| Employer KYC (ID + selfie + phone + email) | W2 |
| Maid profile fields | W2 |
| Employer profile | W2 |
| Browse maids with filters (near, verified, languages, salary) | W2/W3 (filters in W3-F1 use worker list) |
| Post job 500 KES via M-Pesa | W3 |
| Apply with application credits | W3 |
| Basic chat with limits | W4 |
| Contact masking | W4 |
| Anti-contact detection | W4 |
| Admin dashboard | W5 |
| M-Pesa STK push | ✅ Wave 0 (verified) |
| SMS via Talksasa | ✅ Wave 0 (OTP) + W6 (events) |
| Email via Nodemailer | W2/W6 |

**Launch = Waves 1–7 gates all passing.**

---

## Phase 2 — Post-MVP growth (all detailed)

Revenue expansion per PRD §14.2. Depends on MVP Waves 3–4.

- [ ] **P2-1 · Employer subscriptions — L** — `subscriptions` table (tier basic|pro, status, started/expires); plans `sub_basic` (1,000 KES/mo), `sub_pro` (2,500 KES/mo) via STK; `GET /api/subscriptions/status`; renewal is manual re-payment (Daraja has no auto-debit) with expiry SMS/email reminders 3 days prior; fair-use middleware enforcing PRD §8.2 (new chats/24h 3|10, active convos 10|30, profile interactions 20|100, monthly unique maids 30|100, messages/day 100|500); require employer KYC to subscribe.
- [ ] **P2-2 · Ratings & reviews — L** — `reviews` table per PRD §12.1; hire confirmation per PRD §9.2 recommendation: contact unlock + mutual confirmation prompts, 14-day auto-confirm if undisputed, disputes → admin; `POST /api/reviews`, `GET /api/reviews/user/:id`; double-blind publishing (both hidden until both submitted or 14 days); review responses; moderation flags.
- [ ] **P2-3 · Urgent boost (+50 KES) — S** — toggle in Post Job flow, `job_boost` plan, urgent jobs sorted first with badge.
- [ ] **P2-4 · Contact unlock pricing polish — S** — subscriber benefits vs standard unlock flow finalized (PRD decision #3: even subscribers request reveal, maid approves).
- [ ] **P2-5 · Maid-initiated chat — M** — verified maid ↔ verified employer conversations (PRD §4.5 "Phase 2" cell); new-chat caps still apply.
- [ ] **P2-6 · Featured profiles — M** — paid placement slots for verified maids in Browse (decision #7: paid model for Phase 2).
- [ ] **P2-7 · Referral program — M** — invite codes, bonus credits on first successful payment by referee.
- [ ] **P2-8 · Advanced AI moderation — M** — LLM-assisted contextual detection to cut false positives on the W4 engine (Sheng paraphrase, indirect leaks §6.5 Cat 4/6), admin feedback loop from false-positive overrides.
- [ ] **P2-9 · Push notifications — M** — Expo push tokens, server sender, replace polling badges for new message / application / KYC / payment events (completes the PRD §11.3 push column).
- [ ] **P2-10 · KYC OCR assist — M** — optional ID OCR pre-fill to speed admin review (PRD §4.2); still human-approved.

## Phase 3 — Later bets (all detailed)

- [ ] **P3-1 · In-app wallet — L** — held balances, payout rails, top-up via M-Pesa; replaces per-action STK.
- [ ] **P3-2 · Contract generation — L** — PDF employment templates from job + confirmed hire, e-signature capture.
- [ ] **P3-3 · Salary tracking — M** — optional monthly salary log post-hire; feeds review trust score.
- [ ] **P3-4 · Background checks — M** — vendor integration for police clearance / DCI verification badge tier.
- [ ] **P3-5 · Safety kit — M** — panic button + scheduled check-ins during first days of a placement.
