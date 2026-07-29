# Launch-Readiness QA Audit — app.familyinvestingclub.com

**Date:** 2026-07-25 · **Target launch:** Mon 2026-07-28 (real users + $99/mo Club sales)
**Method:** Playwright (desktop 1280 + mobile 390) against LIVE prod + direct Supabase reads (zvkercqohmmeyofycbgr). Test users created via real flows and via admin provisioning; **all test data cleaned + verified zero** (see end).
**Auditor scope note:** Per instructions, the C9 `vip=1` path and challenge-variant copy bugs were NOT audited (in flight). Repo was READ-ONLY except this file.

Screenshots referenced live in the session scratchpad:
`/private/tmp/claude-501/-Users-kwaysclawd/3b1e7d88-9e4a-4745-a8cd-fda1f40ffafa/scratchpad/qa-*.png`

---

## LAUNCH BLOCKERS (would break or embarrass a real Monday signup)

### B1 — Auth email pipeline is DOWN → paid buyers can't get into the app
- **Surface:** Supabase Auth email (SMTP/Resend) — affects Stripe buyer onboarding, password reset, admin invites.
- **Repro:**
  - `POST /forgot-password` with a valid email → UI shows **"Error sending recovery email"**; network shows `POST /auth/v1/recover` → **HTTP 500**. (`qa-forgot-after.png`)
  - Direct `admin.inviteUserByEmail(...)` → **500 "Error sending invite email"**. Link/token *generation* works (`admin.generateLink` succeeds) — it is specifically the **email SEND** that fails.
- **Why it's a launch blocker:** The $99 Stripe buyer path is `stripe/webhook → provisionMembership() → auth.admin.inviteUserByEmail()` (`src/lib/server/membership.ts:77`). With SMTP down, a buyer **pays $99 and never receives the create-account email**. Worse: the failed invite creates **no** auth user (verified — 500 rolls back), and `provisionMembership` returns `ok:true` with `mode:"invite_email_failed"`, so the webhook returns 200 to Stripe and **never retries**. The customer is permanently locked out with no self-serve recovery (password reset is also 500). Same failure breaks the admin "invite member" flow.
- **Severity:** CRITICAL. This directly prevents Monday sales from converting to usable accounts.
- **Suggested fix:** Verify/complete the Supabase project SMTP config (Resend DNS is on the owner's outstanding list — this is the concrete consequence of it). As a belt-and-suspenders option, switch buyer provisioning to the same **service-client, `email_confirm:true`, generated-password** pattern the free-class route already uses (`src/app/api/free-class/register/route.ts`), and deliver the login link/credentials via a channel that works. Re-test with a real invite after the fix.

### B2 — Live community feed shows leftover TEST posts to newcomers
- **Surface:** `/community` (For You tab) — visible to every member incl. free. (`qa-club-community.png`)
- **Repro:** Open `/community`. Real, un-deleted prod posts in the feed today include:
  - `Member … e2e-post-1784853776653` (an automated end-to-end test artifact)
  - `$ndva is the worst stock ever` (Kway · ADMIN — typo'd, low-quality)
  - `@JehuGraham yo` (Kway Jr · CHILD)
- **Severity:** HIGH — a paying Monday newcomer's first look at "the community" contains obvious test junk. Embarrassing, erodes trust.
- **Suggested fix:** Delete these `feed_posts` rows before Monday (query by body `e2e-post`, `worst stock ever`, `@JehuGraham`). Consider a one-time pre-launch feed grooming pass.

---

## SHOULD-FIX (degrades trust or conversion)

### S1 — Kai degraded state looks broken; the graceful fix is unmerged/undeployed
- **Surface:** `/kai` chat + Kai FAB + Kai Watch (Anthropic key out of credits, owner refilling). (`qa-kai-after-send.png`)
- **Repro:** Ask Kai "What is a stock?" → live reply is **"I couldn't find an answer to that."** The failed turn is saved to chat history AND the daily quota decrements ("14 left today") — i.e., users **burn their Kai allowance on error messages**.
- **Note:** The repo working copy of `src/app/api/kai/chat/route.ts` ALREADY contains the fix (emits *"Kai is temporarily unavailable. Please try again in a bit."* and **refunds quota** on failure; a code comment explicitly says it replaced the old "I couldn't find an answer" fallback). **This fix is not on prod.** Kai Watch NL rule creation and any Kai-dependent surface fail the same way.
- **Severity:** HIGH for a product whose headline feature is "your AI analyst." A basic first question returning "I couldn't find an answer" reads as broken/dumb.
- **Suggested fix:** (a) Refill Anthropic credits; (b) deploy the Kai error-UX branch before Monday even if credits arrive, so any future outage degrades honestly and doesn't consume quota.

### S2 — `mission_completions` query 400s on the community page
- **Surface:** `/community` (both club and free). Console error on every load.
- **Repro:** Network shows `GET /rest/v1/mission_completions?select=id&user_id=eq.<uid>&mission_slug=` → **HTTP 400** (empty `mission_slug=` with no operator — malformed PostgREST filter). The dependent data fetch silently fails.
- **Severity:** MEDIUM — no visible crash, but a guaranteed console error + broken query on a core page.
- **Suggested fix:** Guard the query so it isn't issued (or uses a valid filter) when `mission_slug` is empty/undefined.

### S3 — Brand identity is inconsistent across tiers and pages
- **Surface:** cross-app.
- **Repro:**
  - FREE dashboard → new **"CHEAT CODE CLUB"** wordmark + infinity logo. (`qa-dashboard.png`)
  - PAID (fic) app → old **"FIC · Family Investing Club · part of Cheat Code Club"**. (`qa-club-dashboard.png`)
  - Login → "Family Investing Club" H1 but `<title>` "Cheat Code Club | Dashboard". (`qa-login.png`)
  - Upgrade CTA "Join Cheat Code Club — $99/mo" → Stripe page titled "Family Investing Club". (`qa-stripe-fic.png`)
- **Severity:** MEDIUM — the redesign (R1–R5) is legitimately in flight, but a paying member "downgrading" from the Cheat-Code-Club-branded free view to the older FIC-branded app is a jarring, trust-relevant mismatch. Worth an explicit pre-launch decision on which brand a Monday user should see everywhere.

### S4 — Kid can reach the full Screener by direct URL
- **Surface:** `/screener` as a `role:child / age_group:kids` account.
- **Repro:** Screener is correctly hidden from the kid "Kids Corner" nav, but navigating directly to `/screener` loads the full 11,461-security screener — not server-side gated for kids.
- **Severity:** LOW/MEDIUM — it's educational market data (not unsafe content), but it's outside the intended kid experience and contradicts the "kid-safe gating" promise.
- **Suggested fix:** Redirect kid roles away from `/screener` (and any other adult-only route) server-side, matching the nav gating.

### S5 — Newsroom / daily briefing freshness depends on the down LLM
- **Surface:** `/news`, `/alerts` Kai daily briefing.
- **Repro:** `news_articles` is current only to **2026-07-24**. Monday (07-28) freshness relies on the same Anthropic/Kai pipeline that is currently out.
- **Suggested fix:** Confirm the Railway newsroom + Monday 12:30Z briefing cron regenerate cleanly once credits are restored; otherwise Monday users see stale/last-week content.

---

## COSMETIC

- **C1 — Company-logo 404s** on the screener/alerts: `GET /api/market/logo?symbol=XOM` → 404 (missing logos for some tickers). (`qa-club-screener.png`)
- **C2 — Kai surfaces use orange→teal gradient, not the spec'd Kai-blue `#2563FF`** (Kai Alerts header `qa-club-alerts.png`, Kai Watch card `qa-club-watchlist.png`). Minor deviation from CLUB-REDESIGN tokens.
- **C3 — Thin genuine community content.** `feed_posts` = 36 but ~29 are auto "is now researching / going to Free Class" activity cards; only ~3 are genuine human text posts (after removing the B2 test junk). `community_watchlist` has only **1** admin item (AAPL). Feed reads active-ish but bot-heavy. Consider seeding a handful of real discussion posts pre-launch.
- **C4 — Sign-in → first paint latency ~6–8s** in headless (auth call + onboarding-gate redirect). Possibly network; worth a real-device check.
- **C5 — Pre-existing test user in prod auth:** `fic-probe-1784859070@example.com` (created 07-24, unconfirmed) — not created by this audit; owner may want to purge.

---

## VERIFIED-GOOD (solid — coverage confirmed)

**Front door / signup**
- Free-class funnel (solo adult) end-to-end WORKS: quiz → email capture → name+password → creates a real **email-confirmed** free account + family + profile + `free` enrollment + class RSVP, then signs in. No email dependency (bypasses the broken SMTP by design). (`qa-freeclass.png`)
- `/signup` correctly redirects to marketing (self-serve signup intentionally closed; purchase/invite-only).
- Onboarding wizard (13 steps, solo-adult path) completes and lands on `/dashboard`; tour v3 fires on first session. (`qa-onb-*.png`, `qa-dashboard.png`)

**Club (paid) first-session — alive, not barren**
- ClubHome: belt/XP with progress, Market pulse (real S&P/NASDAQ/DOW), Today's Movers, Community heat, Ask-Kai card, illustrated "Today's one thing" lesson, "Keep going" checklist, "In the club" activity feed with avatars. (`qa-club-dashboard.png`, mobile `qa-club-dashboard-m.png`)
- Discover (R3): For You / Trending / Top Research / Most Discussed / News tabs + Stock Finder "Launch" CTA. (`qa-club-discover.png`)
- Watchlist: strong empty state ("Start your research board" + first-company CTA) and the Kai Watch NL-alert card. (`qa-club-watchlist.png`)
- Alerts: Kai Alerts header, good "No alerts yet" empty state, real 52-wk high/low market events with logos, compliance disclaimer. (`qa-club-alerts.png`)
- Screener (11,461 securities), Courses (Start Here/Courses/Live Classes/Flashcards), Research pages all load. (`qa-club-screener.png`, `qa-club-courses.png`, `qa-club-research.png`)

**Gating**
- Free tier: clean upgrade-gated dashboard (locked features with lock icons, "See what $99/mo unlocks"), Free-Sampler courses ("3 lessons free"), read-only community with "Join FIC to post/like/comment" banner. No silent dead-ends; all free-nav targets resolve. (`qa-dashboard.png`, `qa-free-community.png`, `qa-free-courses.png`)
- **$99 Stripe checkout is LIVE and correct:** `buy.stripe.com/…` → "Subscribe to Family Investing Club — $99.00 per month", total due $99.00. (`qa-stripe-fic.png`) (Stopped before payment.)
- **Admin routes are protected:** `/admin`, `/admin/crm`, `/admin/crm/challenge` all redirect unauthenticated users to `/login`. Not publicly accessible.

**Family / kid**
- Kid subaccount inherits family tier; kid-adapted "Kids Corner" nav (no Screener/Family/Discover in nav), friendly tone, White Belt XP, kid Kai loads with a softer greeting. (`qa-kid-missions.png`) (One gap: S4 direct-URL screener.)

**Content volume (not stubs)**
- Courses: 39 published · Lessons: 101 · Flashcards: 378 · News articles: 10 (current to 07-24).
- Challenge email machine present (`challenge_sequences` table + cron); 0 rows = expected (no cohort members yet), gated by `challenge_emails_enabled`. Daily-mission content is code/template-driven, materializes per-enrollee at signup — nothing missing in DB.
- Community has a weekly anchor set ("This Week: How Apple Makes Money") + community_watchlist teaching thesis (AAPL).

**Mobile 390px:** Club home and community render correctly (collapsed nav, working tabs). (`qa-club-dashboard-m.png`, `qa-club-community-m.png`)

---

## CLEANUP VERIFICATION (mandatory — all zero)

Test users created via real/admin flows, then fully removed:
- Deleted: **3** auth users (free funnel, club parent, kid), **3** profiles, **2** families, **2** enrollments, **1** family_profile, **1** feed_post (auto RSVP activity), **1** session_rsvp, **1** free_class_registration, **1** funnel_session, **1** marketing_lead, **2** kai_chat_messages, **1** kai_chat_thread, **1** kai_user_memory.
- **Verified zero residue:** qa-launch auth users = 0 (only the pre-existing `fic-probe` remains, not ours); profiles matching qa = 0; families/enrollments/family_profiles for test families = 0; funnel_sessions/marketing_leads qa = 0; kai_chat_threads "What is a stock?" = 0.
- `feed_posts` back to its original **36** with **0** matches for any test display name (QALaunch/QAClub/QAKid). No feed residue.
