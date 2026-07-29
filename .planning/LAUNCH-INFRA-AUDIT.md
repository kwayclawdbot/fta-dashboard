# Launch Infra Audit — Monday 2026-07-28

Read-only verification run 2026-07-25. No live Stripe objects created, no emails
sent, no env/config changed. Evidence = live API responses (Stripe, Anthropic,
Twilio, Resend, Supabase REST, Railway GraphQL), live DNS/HTTPS, and repo code.

## Verdict table

| # | System | Verdict | One-line evidence |
|---|--------|---------|-------------------|
| 1 | Stripe (live) | **GO** | Account live (charges+payouts on); Club $99, VIP $197, FTA $2,997, Challenge $1,500 all active; both app webhooks on app domain, 0 pending in 7d |
| 2 | Supabase auth + email | **GO-WITH-CAVEAT** | Email signup on, confirm required; challenge funnel pre-confirms (no auth email); custom Auth SMTP NOT verifiable with available creds |
| 3 | Email machine (DB) | **NO-GO** | Challenge welcome fires immediately on every signup and renders literal `[physical address to be added]` — CAN-SPAM violation |
| 4 | Railway (cheatcode-kai) | **GO-WITH-CAVEAT** | kai-agent + cron-morning-alerts + drip-processor SUCCESS; cron-cancel-reconcile CRASHED; cron-dunning has no deployment |
| 5 | Twilio | **NO-GO** | Auth token 401 (dead) — all SMS features down |
| 6 | Anthropic | **NO-GO** | "credit balance too low" — NOT refilled; every Kai feature dead |
| 7 | Domains / DNS | **GO** | app + apex resolve, 200, SSL valid; DNS has MOVED since cutover prep |
| 8 | Monitoring / failure surfaces | **GO-WITH-CAVEAT** | Prod serving 200, DB not paused, 0 webhook backlog; Vercel build queue not checkable (no token); 2 crashed/undeployed crons |

## NO-GO list (one-line reasons)

1. **Anthropic credits** — API returns "credit balance too low"; not refilled. Kills every Kai feature (agent SMS replies, morning brief, alert narratives, coach).
2. **Twilio auth token** — 401 dead. Kills SMS reminders, C5 Kai-SMS migration, owner SMS updates.
3. **Email CAN-SPAM address** — the challenge welcome email that fires on Monday signups renders `[physical address to be added]`; sending it to real users is a compliance violation.

## Changed vs known context

- **DNS MOVED (new):** `app.familyinvestingclub.com` now has a CNAME → `cname.vercel-dns.com` and serves 200 with a valid cert. Context said "NO CNAME yet, owner must add." Cutover step (a) is DONE.
- **Stripe webhooks already cut over (new):** both `…/api/stripe/webhook` and `…/api/shop/webhook` endpoints already point at `app.familyinvestingclub.com` and are enabled. Cutover step (e) is DONE.
- **VIP $197 product now exists (new):** `prod_Ux0oQiDQ2IlkKT` "Challenge VIP Ticket", price `price_1Tx6n7F7Tbc3pSvJpgrwi2Nu` = $197 one-time, active. Created by the other lane. Gated OFF for sale via `app_settings.challenge_vip_enabled=false`.
- **Anthropic NOT refilled:** still dead (confirms, no change).
- **cheatcode.com moved onto Cloudflare:** was bluehost-parked; now fronted by Cloudflare returning 403 (NS still bluehost). Still NOT serving the club app — deferred as expected.

---

## Per-system detail + remediation

### 1. Stripe — GO
- Account `acct_1O1BkLF7Tbc3pSvJ` = CHEATCODE AI LLC; `charges_enabled=true`, `payouts_enabled=true`. Single live account (env.local key == breakout-alert-system key).
- **Club $99:** `prod_UuOS6gTLmBQOBw` → `price_1TuZg8F7Tbc3pSvJta0lUeVY` active, 9900 usd/month. ✓
- **Challenge $1,500:** `prod_UwhnbUZ3Dtyz5y` active, metadata `kind=fta_challenge` ✓ → `price_1TwoNdF7Tbc3pSvJmNhCeKpD` active, 150000 usd one_time. Payment link `buy.stripe.com/cNi28r0oHbxPdxacxBbEA0c` returns 200. ✓
- **VIP $197:** present (see "changed vs context"), active, but gated off — sale blocked by `challenge_vip_enabled=false`. Correct pre-launch state.
- **FTA $2,997:** `prod_UuOTvToRFLkc6c` → `price_1TuZgGF7Tbc3pSvJCI8mBTjJ` active. ✓
- **Webhooks:** 4 endpoints, all enabled. App-side `we_1Tw0Ze…/api/stripe/webhook` and `we_1Tw2N3…/api/shop/webhook` both on `app.familyinvestingclub.com`. Kai `cheatcode-ai.up.railway.app/webhook/stripe` (231 events) handles subscription lifecycle incl. STOP cancels. **0 events with pending webhooks in last 7d** → delivery healthy.
- **Payment method configs:** 3 active, card on. Sane.
- **Subscription states:** 41 active, 7 past_due, 0 unpaid/incomplete/incomplete_expired. 7 past_due = normal dunning, not a blocker.
- **STOP auto-cancel (Stripe side):** 2 `customer.subscription.deleted` in 7d delivered cleanly → cancel API path healthy. (Note reconciliation caveat in §4.)
- App webhooks only subscribe to `checkout.session.completed` — by design; subscription lifecycle is handled by the Kai endpoint.
- Remediation: none required.

### 2. Supabase auth + email — GO-WITH-CAVEAT
- `/auth/v1/settings`: `email=true`, `disable_signup=false`, `mailer_autoconfirm=false` (confirmation email IS required on organic signup).
- **Challenge/free-class funnel** (`/api/free-class/register`) uses `supabase.auth.admin.createUser({ email_confirm: true })` → users are PRE-CONFIRMED, so the Monday funnel does NOT depend on Supabase Auth SMTP for confirmation. Good.
- **Gap:** organic `/signup` confirmations and **password resets** DO go through Supabase Auth SMTP. Whether a custom Resend SMTP is configured for Auth is **not verifiable** with available creds (no Supabase management/access token found; the `/settings` endpoint doesn't expose SMTP). If Auth is still on default Supabase SMTP, it throttles (~30/hr) and password resets/organic confirms will fail under load.
- Auth Site URL / redirect config also not readable without a mgmt token; DOMAIN-CUTOVER step (b) was owner-only. Site serving + pre-confirm funnel means this is lower-risk for Monday but unverified.
- Did NOT trigger test signup/reset sends (honoring read-only).
- Remediation (OWNER, ~10 min): in Supabase → FTA project → Auth → confirm **custom SMTP = Resend** with verified sender, and confirm Site URL = `https://app.familyinvestingclub.com` + redirect URLs. Then a 2-min manual smoke test (one signup + one password reset to a real inbox).

### 3. Email machine (DB) — NO-GO
- **Flags (`app_settings`):** `drip_enabled=false`, `challenge_emails_enabled=true`, `challenge_vip_enabled=false`, `challenge_start=2026-09-01`, `challenge_end=2026-09-06`.
- **Tables are send-logs, not seeded calendars** — all empty (`challenge_sequences`, `email_drips`, `notification_email_queue`, `challenge_vips` = 0 rows; `marketing_campaigns` = 2 test rows only). The 17-step challenge calendar is a CODE constant (`CHALLENGE_SCHEDULE` in `src/lib/server/challenge-sequence.ts`, Aug 4 → Sept 8), not DB rows — empty tables are the correct pre-launch state.
- **What fires Monday with 100 signups:**
  - Welcome-drip 13B: **nothing** — `drip_enabled=false` hard-gates `/api/cron/drip-welcome`.
  - Challenge sequence: `/api/free-class/register` line 185 calls `enrollChallengeSequence()` **unconditionally for every signup**. With `challenge_emails_enabled=true` it (a) schedules the future steps as `pending` (first send Aug 4, nothing due Monday) AND (b) **fires the registration welcome email immediately via Resend** to each of the 100 users.
- **CAN-SPAM placeholder:** the shared `shell()` footer in `src/lib/server/drip-templates.ts:262` prints `Mailing address on file · [physical address to be added]`. `shell()` is used by ALL email families: welcome drip, challenge sequence (incl. the immediate welcome), club-clock, challenge VIP (imports confirmed in `drip-welcome/route.ts`, `club-clock-emails.ts`, `challenge-emails.ts`, `challenge-sequence-emails.ts`). So the 100 immediate challenge welcomes Monday — plus every scheduled step from Aug 4 — go out with a placeholder mailing address. **This is the blocker.**
- **[TEST] approval situation:** the crons have a `[TEST]`-subject preview mode that sends copies to the owner inbox (no DB writes) for content approval. That's a manual owner sign-off on copy, not a system gate — noted, not blocking infra.
- Remediation:
  - **OWNER (2 min):** provide the real physical/mailing address (a registered-agent or PO box is fine).
  - **AGENT (5 min):** replace `[physical address to be added]` at `drip-templates.ts:262` with the real address, redeploy. Until then, either hold the address fix OR set `challenge_emails_enabled=false` to suppress the immediate welcome (but that also suppresses the whole challenge sequence).

### 4. Railway (cheatcode-kai) — GO-WITH-CAVEAT
- **kai-agent** `SUCCESS` (deployed 2026-07-24 19:13) — the Twilio `sms_url` host + Stripe `/webhook/stripe`. Service up. (Note: its LLM replies are dead until Anthropic credits — §6.)
- **cron-morning-alerts** `SUCCESS` (2026-07-24 19:13) — redeployed at/after the 57e5559 scorer baseline.
- **cron-drip-processor**, cron-morning-brief, cron-closing/sunday/weekly, cron-email-* all `SUCCESS` (07-24).
- **cron-cancel-reconcile — CRASHED** (2026-07-24 19:13). This is the nightly Stripe→DB cancellation reconciliation sweep. STOP auto-cancel itself runs in kai-agent (up) and Stripe shows cancels succeeding, so this is drift-catching, not the live cancel path — caveat, not a launch blocker.
- **cron-dunning — NO deployment** (dunning sweep not running). Other NO-DEPLOYMENT services (webhook, kai-stream, kai-watchlist, cron-reel-queue, kai-agent-warroom, kai-v4-weekly-scan, cron-closing-brief, cron-reel-schedule) appear dormant/unused for the app.
- **Alerts-ingest bridge** (`30 12 * * 1-5` → `POST app…/api/alerts/ingest`): the POST lives in **breakout-alert-system**'s `kai_morning_alerts.py` (a different Railway project), NOT cheatcode-kai — could not confirm that project's deploy state in this pass. App receiver `/api/alerts/ingest` exists in code; `ALERTS_INGEST_SECRET` recorded in ALERTS-WIRING.md.
- **fta-dashboard-api** Railway project = NO deployments (the app is Next.js on Vercel; this backend is unused). Not a blocker.
- Remediation (AGENT, ~10 min if wanted): restart/redeploy `cron-cancel-reconcile` and `cron-dunning`; separately verify the breakout-alert-system project is deployed so Monday's morning alerts reach the app hub.

### 5. Twilio — NO-GO
- One auth check: `GET /Accounts/AC18d78…` → **401**. Token dead (unchanged).
- **Dies without it:** SMS reminders (challenge day-of nudges), C5 Kai-SMS → Club migration, owner SMS status updates, any SMS OTP.
- **Still works:** all email (Resend), the app, Stripe, web push, dashboard. The Monday challenge funnel is email + app based and does NOT require SMS to function.
- Remediation (OWNER, ~5 min): regenerate the Twilio auth token in console; update `TWILIO_AUTH_TOKEN` in `.env.local`, Vercel prod, and Railway kai-agent; AGENT redeploys.

### 6. Anthropic — NO-GO
- One `/v1/messages` call (key last8 `0TXGQgAA`) → `invalid_request_error: "Your credit balance is too low to access the Anthropic API."` **Not refilled.**
- Kills every Kai/LLM feature: agent SMS replies, morning-brief/alert narratives, AI coach, any generated copy.
- Remediation (OWNER, ~5 min): add credits at console.anthropic.com Plans & Billing.

### 7. Domains / DNS — GO
- `app.familyinvestingclub.com`: CNAME → `cname.vercel-dns.com` (A 76.76.21.98); `https://…/login` → 200, cert valid. **DNS moved since cutover prep.**
- `familyinvestingclub.com` (apex): A 216.150.1.1; 200, cert valid.
- `cheatcode-club.vercel.app`: 200.
- `cheatcode.com`: now behind Cloudflare (was bluehost-parked), returns 403; NS still bluehost. NOT serving the club app — deferred, expected.
- Resend domain verification: **not API-checkable** — the `RESEND_API_KEY` in env is send-restricted (`restricted_api_key`), so `GET /domains` is 401. Send path is configured for `hello@familyinvestingclub.com`; a send would error if the domain were unverified. Treat as configured-but-unconfirmed.
- Remediation: none blocking. Optionally confirm domain "verified" in Resend dashboard (owner, 1 min).

### 8. Monitoring / failure surfaces — GO-WITH-CAVEAT
- **Vercel prod:** `app.familyinvestingclub.com` serves 200 → current production deploy is healthy. Could NOT enumerate failed/queued builds (no Vercel token available this pass).
- **Supabase DB:** REST responded on every table → project NOT paused. No table observed at/near limits (all app tables tiny). Auth healthy.
- **Backlogs:** Stripe 0 pending webhooks in 7d. Visible cron failures = `cron-cancel-reconcile` CRASHED + `cron-dunning` no-deploy (see §4).
- Remediation: (owner/agent) glance at Vercel dashboard for any failed prod build before Monday.

---

## Owner action list (blocking) — do before Monday

1. **Anthropic** — add credits (~5 min).
2. **Twilio** — regenerate auth token + hand off for env update (~5 min).
3. **Mailing address** — provide the CAN-SPAM footer address (~2 min) → agent edits `drip-templates.ts:262` + redeploy (~5 min).
4. **Supabase Auth SMTP** — confirm custom Resend SMTP + Site URL/redirects, then a 2-min signup/reset smoke test (~10 min).

## Agent action list (fast, non-blocking)

- After owner gives address: one-line edit `drip-templates.ts:262` + redeploy.
- After owner refreshes Twilio: update `TWILIO_AUTH_TOKEN` in Vercel + Railway + redeploy.
- Restart `cron-cancel-reconcile` and `cron-dunning` on Railway; verify breakout-alert-system deploy for the alerts bridge.
