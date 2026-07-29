# C9 — Challenge VIP Ticket ($197) + Funnel Variant Fixes

## ADDENDUM 2026-07-25 (owner, FINAL — supersedes conflicting lines below)
- Challenge = 5 LIVE WEBINAR SESSIONS, **Wed Sept 2 → Sun Sept 6, 7:00 PM ET** (access/cohort opens Sept 1). NOT Mon–Fri, NOT self-paced 20-min lessons.
- **VIP replays confirmed**: session recordings are a VIP-only perk (VIP room + vip_receipt + site ticket).
- Access/decision window extended Sept 6 → **Sept 8 EOD ET** (48h cart after final Sunday session) — coordinator-directed, owner may veto.
- Textbook = REAL Shopify product on shop.cheatcode.com: "Intro To Stocks (Trading and investment book)", **$197 exactly** (gid://shopify/Product/9919130796330, variant …50727898841386), Lulu integration already configured ON THE STORE → fulfillment = Stripe webhook → Shopify order (paid-externally) → store's Lulu auto-fulfills. (Replaces app-side Lulu Direct plan.)
- Value anchor: VIP $197 = the book's normal retail price alone; Club month + VIP room + replays included on top. ($297 homeschool 4-book bundle exists on store — future family-mode upsell, not in scope.)
- VIP CTA on site → DIRECT guest Stripe checkout: GET app.familyinvestingclub.com/api/challenge/vip-checkout?src=funnel → 302 Stripe (no quiz funnel); thank-you upsell path also remains.
- CRM: challenge regs + VIP purchases + partial leads upsert to GoHighLevel (creds ~/.openclaw/secrets/ghl.env), tags challenge-sept1/ticket-free|vip/src.

Owner decisions 2026-07-25 (FINAL):
- VIP ticket $197: textbook (print, via existing Lulu+Shopify integration) + 1 month Club access + private group during challenge.
- Funnel purpose: convert free tickets → VIP tickets; BOTH register as app users. Free ticket = free user, VIP ticket = vip user.
- Billing: AUTO-CONTINUE W/ WARNING — $197 checkout starts a Club subscription with first month included; $99/mo begins after month 1; reminder email 3 days before first $99 charge; one-click cancel. (Honesty promise kept via explicit disclosure at checkout + reminder.)
- Textbook fulfillment: automate via existing Lulu & Shopify integration (textbook already sells there) — investigate store d4558b.myshopify.com, then Stripe webhook → Shopify order w/ shipping address → Lulu Direct auto-fulfills.
- Placement: tickets section (Free vs VIP) on /challenge/ page — free CTA stays primary and card-free — PLUS post-registration thank-you upsell.
- Family Mode: registration quiz step-1 answer (who's learning with you) determines Family Mode; parents get kids-subaccount setup prompts (existing family_invites infra) on thank-you/onboarding.

## Stripe structure
Checkout Session (subscription mode): Club $99/mo price + trial_period_days=30 + add_invoice_items one-time $98 "VIP Challenge Ticket" line → $197 due today ($99 first month + $98 VIP), $99/mo from day 30. Alt if line-item optics matter: one-time $197 price + trialed sub created in webhook. Metadata kind=challenge_vip, client_reference_id=user id (checkout only reachable post-registration). Shipping address collection ON (textbook). Webhook: stamp enrollment tier=vip, club_until=+30d, vip_room access, queue textbook order, schedule day-27 reminder email.

## Surfaces
1. **Site /challenge/** — tickets section: Free (everything current, no card) vs VIP $197 (textbook + month of Club + private VIP room). Designed objects not generic cards (two tickets — literal ticket objects fit the receipt idiom). VIP CTA → /free-class?challenge=1&vip=1&src=funnel (registers first, pays at thank-you).
2. **App registration flow** — persist vip intent alongside fic_challenge; challenge-variant copy through ALL 6 steps (fixes P1 date-leak: no "this week's class" for challenge entrants); Club branding on challenge variant; hide low count (<50) social proof; adaptive copy for solo path ("Just me" not "No kids yet"; result headline non-family on solo); verify+fix src stamping server-side.
3. **Thank-you** — free path: existing C7 elements + VIP upsell block (single, non-blocking, below calendar/referral); vip intent path: straight to Stripe checkout, then VIP thank-you (textbook shipping confirmation + VIP room link). Family-answer paths: kids → Family Mode enabled + kids subaccount setup prompt.
4. **App community** — "VIP Room" private space, visible tier=vip only, active during challenge window (Aug w/ prep + Sept 1-6).
5. **Email machine** — add: VIP receipt/confirmation w/ shipping notice; day-27 pre-charge reminder; vip_upsell step(s) for free registrants in existing 17-step calendar (dedupe vs day3_offer); update challenge steps to reference VIP where natural.
6. **Shopify/Lulu automation** — investigate how textbook currently fulfills (likely Lulu Direct app auto-fulfilling Shopify orders); implement webhook→Shopify Admin API order creation with buyer shipping address; fallback: flag manual fulfillment queue in admin if API path blocked.

## Compliance/guardrails
Education-not-advice everywhere; no income/returns language on tickets; free challenge remains complete on its own (VIP = more support/artifacts, never "the missing half"); disclosure at checkout: "$197 today · includes your first month of Club · $99/mo after — we'll remind you 3 days before, cancel in one click."

## Verification
E2E with test user (then FULL cleanup, zero residue): free path unchanged; vip path → Stripe test checkout → tier=vip + vip room visible + textbook order created (Shopify test/draft) + emails queued correct. Funnel variant copy checked at every step. src attribution lands in C7 admin dashboard.
