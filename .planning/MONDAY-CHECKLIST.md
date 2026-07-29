# MONDAY LAUNCH CHECKLIST — compiled 2026-07-25 (Fri)

Target: onboarding real users + generating sales Monday 2026-07-28. Challenge cohort: access opens Sept 1; five live webinar sessions Wed Sept 2 → Sun Sept 6, 7:00 PM ET; decision window through Sept 8.

## LIVE NOW (verified in production) — updated 07-25 night
- **Email-first challenge funnel:** 3-field pass object (email+name+phone w/ SMS consent) on /challenge/ → instant registration+welcome+sequence+CRM → VIP one-time-offer page → 3-tap setup → thank-you. Verified live end-to-end.
- **Fully-custom checkout** (/checkout/club + /checkout/vip): Payment Element themed to brand, our email/shipping/summary/bumps UI, dynamic totals. Order bumps live: textbook $119, parents bundle $297 (club, mutually exclusive); kids curriculum $97 (VIP). Provisioning on invoice.paid, idempotent, hosted fallback. OWNER DECISION: Stripe Link block stays unless account-level toggle flipped (affects shop too).
- **Challenge member tour:** challenge-variant walkthrough on first login (Community → first watchlist add → Kai → sessions → belts → intro-post commit; VIP room stop for VIPs).
- **Full D1 redesign:** ClubHome "Today in the Club" masthead (3-card row deleted, entry points deduped, zero-states = warm invitations), Community two-lane editorial thread (activity collapsed to strip), Research gauge-hero one-pager (nesting 3→1). Family sidebar grouped; mobile name-wrap fixed. D2 (Watchlist/Alerts/Courses) specs ready in APP-DESIGN-UX-AUDIT.md.
- Marketing site cheatcode-club.vercel.app: v14 home (goal mission, real app screenshots, 3-phone hero, left-pinned rotating word), Free/VIP ticket objects, dark event-energy challenge page ("The 5-Day Investing Challenge"), webinar dates/time, VIP replays (VIP-only), $197 book value anchor. Card-gate clean.
- VIP $197 END-TO-END: site CTA → guest 302 → live Stripe checkout ($197 today = book + first Club month; $99/mo from day 30 w/ day-27 reminder email; one-click cancel). Gate ON. Guest account provisioning + vip-success set-password verified.
- $99 Club checkout live; buyer-lockout hole CLOSED (generateLink+Resend, webhook retries on provisioning failure). Password reset Resend-backed.
- Funnel fixes: challenge-variant dates through all 6 steps, "Just me" path, adaptive copy, src attribution verified, count hidden <50.
- In-app CRM: /admin/crm/challenge free/vip/partial split w/ src. (GHL is DEAD — "Location is not active"; cancel if paying.)
- Brand: Cheat Code Club everywhere; FIC only in Family Mode (incl. emails' friendly names, PWA icons). Deployed+verified.
- 14 challenge emails re-dated Wed–Sun 7PM ET; .ics = 5 events Sept 2–6. Community feed cleaned of test posts. All e2e residue zero.
- Kai fix branch READY (honest error copy + quota refund on failed turns) — merge blocked only on credits.

## OWNER — MONDAY-CRITICAL
1. **Anthropic credits** → the org owning key …0TXGQgAA (verified still empty). Kai chat/reports/newsroom/NL alerts all dark until then. Then agent merges the Kai fix + live-verifies.
2. **Mailing address** (CAN-SPAM) — the instant challenge welcome email ships `[physical address to be added]` on every signup. One line → agent fixes + redeploys. Fallback if none by Sunday night: agent gates the welcome email.
3. **Twilio token** — all SMS dead (biggest show-up lever; SMS ≈ 2x attendance). Regenerate → agent updates .env/Vercel/Railway fleet.
4. **Stripe Dashboard renames (buyer-facing!):** account business name `algo.cheatcode` → "Cheat Code Club" (Settings→Branding); product `prod_UuOS6gTLmBQOBw` "Family Investing Club" ($99) → "Cheat Code Club" (it's what a solo buyer sees on hosted checkout).
5. **Create the 5 live webinar sessions + join links** (Zoom/live-rooms). All copy + .ics reference them; .ics currently deep-links /dashboard.
6. **SHOPIFY_ADMIN_ACCESS_TOKEN** (custom app, write_orders) → Vercel prod, for auto book fulfillment via the store's Lulu app. Until then VIP book orders sit in /admin/shop manual queue. NOTE: first real VIP purchase = live fulfillment test — watch it.

## OWNER — IMPORTANT, NOT BLOCKING
7. Supabase→Auth→SMTP password = current RESEND_API_KEY (root cause: stale rotated key; money paths + invites already immune).
8. Seed 3–5 real community posts + add names to community_watchlist (only AAPL today); feed is clean but thin.
9. Approve/veto: Sept 8 access-window extension (agent-directed; access would otherwise die during the final Sunday session).
10. Email approvals: [TEST] drip/challenge/conversion emails in kwayclawdbot@gmail.com; flip drip_enabled when approved.
11. cheatcode.com DNS → Vercel `cheatcode-club` project when ready (then canonicals swap + Stripe cancel_url TODO).

## AGENT — QUEUED (next session picks up automatically)
- Merge fix/kai-chat-error-surface-quota-refund (REBASE first — carries duplicate C9 commits) → deploy → live Kai reply verify → Kai-Watch NL round-trip verify → optionally re-capture live Ask Kai vignette.
- ~~Railway: cron-cancel-reconcile / cron-dunning / alerts-ingest~~ DONE 07-26: cancel-reconcile fixed via 2cd74dc (real cause = cron image lacks fastapi; reconciler decoupled from app.py; next run 08:00Z), cron-dunning wired+deployed (cron 0 10,22 * * 1-5; SMS sends still blocked on Twilio), alerts-ingest re-verified all-green for Mon 12:30Z.
- ~~Small app fixes~~ DONE 07-26, prod-verified zero-residue: mission_completions 400 = badges.ts queried nonexistent mission_slug column (45d7711); kid screener walled server-side — page redirect via deriveRegister + RLS viewer_is_kid() on screener_metrics/meta, migration 137 applied (f4947c3).
- ~~Site design-audit P1s~~ FIXED 07-26 on PREVIEW awaiting owner review→promote: https://cheatcode-club-ec9ef23v4-kways-clawds-projects.vercel.app (behind Vercel SSO — view logged in). Text-safe accent tokens (29/29 AA checks pass), legal/captions to ink-500, .btn:active scale .97, all :hover gated @media (hover:hover), font preconnects. Card-gate PASS, v=15 bump, backups in .bak-20260725-210654-p1fixes/. (P2s + mobile-nav sheet = post-launch.)
- Twilio env fleet update + SMS smoke when token arrives. Then C5 decision.
- KPI baselines (from research): warm opt-in 30%+, cold low-double-digit; registrant→paid 5–12% (completers 15–30%); watch show-up rate above all.
