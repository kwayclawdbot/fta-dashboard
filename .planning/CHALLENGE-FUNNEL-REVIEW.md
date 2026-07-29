# Challenge Funnel Review — 2026-07-25

Consolidated review of the 5-Day Challenge funnel (marketing page → registration → confirmation → cohort machine), combining a hands-on walkthrough of the live flow with external best-practice research (full research: CHALLENGE-FUNNEL-RESEARCH.md; design-polish audit of the site: DESIGN-AUDIT-v13.md).

**Flow walked:** cheatcode-club.vercel.app/challenge → app.familyinvestingclub.com/free-class?challenge=1&src=funnel → quiz q/1–q/3 → /free-class/save (email capture, step 4/6). Stopped before submit (challenge email machine is armed — no test signups). Steps 5–6 (result + account) not directly observed.

## Verdict

The /challenge/ marketing page itself is best-practice-conformant (Hormozi structure, honest scarcity, compliance-clean). The email machine's day-3 soft pitch + Sept 6 access deadline match the canonical ~60%-mark pitch and hard-close research. The losses are concentrated in the marketing-page → registration handoff (variant coherence) and in show-up mechanics blocked on Twilio.

## P1 — Fix before Aug marketing runway (bugs, hours of work)

1. **Date leak in challenge variant.** Registration page shows "This week: Wednesday, Jul 29 · 7:00 PM" (weekly free-class session) under a "STARTS SEPT 1" badge; email-capture step says "hold your seat for this week's class." Two conflicting promises inside one flow. Challenge=1 must swap ALL date/session copy through the whole 6-step flow.
2. **Brand break.** Cheat Code Club funnel lands on FAMILY INVESTING CLUB-branded registration. Until cheatcode.com DNS, the challenge=1 variant should render Cheat Code Club branding (wordmark + palette) end-to-end.
3. **Low-count social proof.** "2 families registered" shown live. Hide the counter below a threshold (~50) or swap to non-numeric copy.
4. **Verify `src=funnel` attribution.** `fic_challenge:1` persists client-side; `src` does not (only `fta_funnel_id` UUID). Confirm the server stamps src on the funnel row at landing; otherwise the C7 cohort dashboard source attribution reads empty.
5. **Audience-rule copy violations.** "Just us adults — No kids yet" and hardcoded "See your family's result" on the solo path. Copy must adapt to the step-1 answer (families-first, never parents-only).

## P2 — Show-up machine (the #1 revenue lever per research: 30–40% abandon between opt-in and Day 1)

6. **Twilio unblock = top business priority.** SMS within 60s of signup + day-before + day-1-AM texts ≈ doubles show-up in cited data (96–98% open). The SMS opt-in checkbox already exists at email capture; the send side is dead until the token is replaced. (Owner blocker.)
7. **Thank-you page ordering per teardown:** confirmation headline → add-to-calendar (exists, C7 ✓) → expectations video (missing — small win) → account/SMS commitment → community join → what-happens-next timeline. Verify current C7 thank-you matches this priority order; referral share ✓ + intro-post commitment ✓ already built.
8. **Day-1 quick win:** ensure Day 1 mission delivers a completed artifact in ≤30 min (first watchlist name with a reason). Strongest predictor of completion AND purchase.
9. **Partial-capture nurture:** email is captured at step 4/6 before account creation — good structure. Ensure abandoners at steps 5–6 enter a "finish your registration" drip and count as registered leads. Consider magic-link to kill the password field.

## P3 — Offer-structure upgrades (owner decisions)

10. **Finisher-only earned rewards** tied to existing XP/belts: unlock a bonus live session + founding-member perk only for 5/5-day finishers. Manufactures the commitment that no-card removed.
11. **Optional $9–27 VIP/founding tier** on the thank-you page (never gating the free challenge; no card at signup stays true). Research: 45% of high-ticket sales came from the 10% who bought a small VIP in one cited case. Also a buyer-segmentation signal for the $1,500 FTA email pitch.
12. **Cart-close discipline:** access-until-Sept-6 = real 48–72h window ✓. Verify the 17-step machine has an explicit final-morning "closing tonight" email (research: 25–40% of offer revenue) and a next-cohort waitlist for non-buyers.
13. **Benchmark expectations:** registrant→paid 5–12% with full sequence (15–30% only among finishers); warm opt-in 30%+, cold low-double-digit. Instrument these in the C7 admin dashboard so Sept numbers are judged against the right baselines.

## Already right (don't churn)

No card ✓ · real cohort scarcity, no fake counters ✓ · day-3 soft pitch ✓ · value-stack receipt + risk reversal + objection FAQ ✓ · compliance floor throughout ✓ · 3-tap quiz micro-commitment before email ✓ · referral loop + .ics on thank-you ✓ · $1,500 FTA pitched in email only ✓.
