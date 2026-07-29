# UX Audit — Acquisition · Free-Tier · Commerce

Read-only audit, 2026-07-22. Surfaces: familyinvestingclub.com (+ /schools), `/free-class`
funnel (all 6 steps), free-tier in-app (FreeHome, community, courses, picks, locked surfaces,
UpsellCard), `/shop` (grid + product + bundle), `/login`, `/u/[username]`, `/help`.
Method: Playwright, mobile **390px primary** + desktop, anonymous + a real free-tier user driven
through the live funnel. Screenshots: `scratchpad/ux-audit/acquisition/`.

No code changed. Disposable funnel user(s) + all derived rows (families, enrollments, RSVPs, feed
posts, funnel_sessions, marketing_leads, registrations) created during the audit were deleted —
verified 0 remaining, no orphans.

---

## Top 5 (narrative)

**1. The login page is a different brand.** Every acquisition surface — the marketing site, the
funnel, the confirmation, the whole in-app — says **Family Investing Club**. The login page says
**"Family Trading Academy · Build Generational Wealth Together · © 2026 Family Trading Academy."**
A parent who found you at familyinvestingclub.com, went through the "Family Investing Club" free-class
funnel, then comes back a day later to log in, hits a screen for what looks like a different company.
This is the single cheapest P1 to fix and it sits on the highest-frequency returning-user path.

**2. The community — your best social proof — currently reads as a QA sandbox.** A brand-new free
member's first look at the club feed is dominated by test accounts and junk: *"ZZPUB ParentA earned
the Investor credential," "Perf Test Family is now researching Costco," "Nia Testfamily,"
"E2ETester," "fta-verify-probe-… leveled up," "Disposable Class (TEST),"* and announcements that
literally say *"test test test"* and *"tes."* The read-only community is meant to be the aspirational
"look how alive this place is" moment that drives the $99 join. Right now it inverts that signal.
There is real, good activity in there (admin picks, a Nvidia post, credential earns) — it's buried
under test noise that should never be visible to real users.

**3. The free member's home screen takes 6–10 seconds to appear.** `/dashboard` (FreeHome) and
`/upgrade` — the two most conversion-important logged-in screens for a free user — sit on skeleton
loaders / a spinner for many seconds before rendering. The dashboard `load()` awaits a chain
(`get_home_state` RPC + profile + FIC week + XP, *then* a `getFamilyTier` call gated behind that
`Promise.all`) with no timeout and no error fallback, so on a cold/slow response the free user stares
at grey blocks on the very first screen after signup. It does resolve — but "does it work?" is the
wrong bar for the home screen of a product you're trying to sell.

**4. The upsell system itself is excellent — calibration is right, a few doors are mis-hung.**
`UpsellCard` is a single, contextual, adult-first component: it names exactly what's behind each
locked door ("The trading simulator — practice with pretend money…"), offers the forward path, and
never uses fake countdowns or desperation. This matches the brand register precisely and should be
protected. The problems are placement, not tone: (a) the **Courses** page's bottom UpsellCard is
visually broken on mobile — text wraps one word per line and the CTA button overlaps it; (b) a free
user's **own `/u/[username]` profile is fully locked** behind the generic upsell — they can't even
see themselves; (c) **community** shows an editable "Post your family's pick" composer *and* a
"Join FIC to post" upsell at the same time — the compose box looks usable but the Post button is
dead, a small dead-end.

**5. `/upgrade` sells the $2,997 program to someone deciding on the $99 one.** For a free user the
next logical purchase is FIC at $99/mo. But `/upgrade` (the destination of FreeHome's "See the full
comparison" and every UpsellCard's "See everything membership includes") leads with a black
**FTA academy hero — "Upgrade to FTA — $2,997"** as the primary CTA. The FIC-vs-FTA comparison table
below it is genuinely good, but the page answers "should I spend $2,997?" when the visitor's actual
question is "what do I get for $99?" The framing over-reaches the free user's readiness and buries
the $99 decision.

---

## Findings

| # | Surface | Sev | What's wrong | Recommendation | Effort |
|---|---------|-----|--------------|----------------|--------|
| 1 | `/login` | **P1** | Branded "Family Trading Academy / Build Generational Wealth Together / © 2026 Family Trading Academy" — the only surface still on the old FTA brand; every other acquisition surface is Family Investing Club. Brand break at the returning-user auth gate. | Rebrand login (+ any shared auth layout/footer) to Family Investing Club to match funnel/app. | S |
| 2 | Free community | **P1** | New free member's first community view is flooded with test data: ZZPUB*, Perf Test*, Nia Testfamily, E2ETester, fta-verify-probe, "Disposable Class (TEST)", "test test test" / "tes" announcements. Inverted social proof — reads as a QA sandbox. | Purge/soft-delete test accounts + test announcements from prod, or filter them out of the public feed; add a seeded "welcome" state so the free feed always looks alive. | M |
| 3 | FreeHome `/dashboard` + `/upgrade` | **P1** | Primary free-tier home and the upsell page show skeletons/spinner for ~6–10s (upgrade ~11s). `load()` chains RPC+profile+week+XP then a gated tier call, no timeout/no error state → grey blocks on the first post-signup screen. | Parallelize/short-circuit the free-tier path (tier check first), cache, add a fast optimistic render + error fallback so home never hangs on grey. | M |
| 4 | Funnel (all steps) | P2 | Every step blocks render on a `fetchSession` round-trip → a gold spinner flashes between q1→q2→q3→save→result→register; save/register API calls are slow (multi-second "Saving…"). Adds perceived latency at each conversion beat. | Optimistically render the next step from local answers; hydrate session in the background; show inline button-spinners, not full-screen loaders. | M |
| 5 | Courses (free) | P2 | Bottom UpsellCard ("The rest of the course library") has a broken mobile layout — text wraps one word per line, CTA button overlaps the paragraph. | Fix the container width/flex on the courses upsell slot (it's being constrained far below the card's `max-w-lg`). | S |
| 6 | `/u/[username]` | P2 | Free user's **own** profile is fully locked behind the generic "This is part of the club" upsell — they can't view themselves or any member. Over-gating. | Let free users see their own profile (and read-only member profiles); reserve the upsell for member-only actions, not the whole page. | M |
| 7 | Free community | P2 | Editable "Post your family's pick" composer + "Post" button shown to free users who can't post (button disabled) alongside the "Join FIC to post" upsell — mixed signal / dead-end. | For free tier, replace the composer with the upsell band (or make the tap open the join CTA), so nothing looks usable-but-isn't. | S |
| 8 | `/upgrade` | P2 | Leads with FTA $2,997 academy hero + primary CTA for a free user whose next step is FIC $99/mo; the "See what FIC includes" links land here. Answers the wrong question. | Make `/upgrade` FIC-first for free users (what $99 unlocks, Join CTA), with FTA as a secondary "go deeper" tier below the comparison. | M |
| 9 | `/shop` product + bundle | P2 | No returns/refund policy, no shipping cost, no delivery-time estimate anywhere before Stripe checkout. Print-on-demand can be slow/expensive — expectation + trust gap. | Add a short shipping & returns line/section (POD lead time, ship cost, return policy) on product/bundle pages and near "Buy now". | S |
| 10 | Funnel landing | P2 | No visible social proof or urgency — social-proof chip requires ≥5 registrations (hidden), seats chip hidden too. Landing has only a date chip; weakest-converting version of the page is what's live. | Seed/lower the honest social-proof threshold or add "families learning this week" so the hook has at least one trust/urgency signal. | S |
| 11 | FreeHome | P3 | "Everything the club unlocks" 2-col grid truncates every label at 390px: "Full cour…", "Weekly li…", "Family w…", "Kid missi…", "Games &…", "Badges …". Looks unpolished. | Shorten labels or allow 2-line wrap; single column on narrow widths. | S |
| 12 | In-app top bar | P3 | Mobile top-bar title shows "Home" on Help, Picks, Upgrade, and Profile instead of the section name. | Wire the top-bar title to the active route. | S |
| 13 | `/shop` covers | P3 | Placeholder covers are tasteful *typographic* covers (not ugly) — but identical layout across all titles and lots of empty space mid-cover; clearly not real book art. | Fine as a stopgap; vary accent/graphic per title, or drop in real cover renders when ready. | M |
| 14 | Marketing home (390) | P2 | Long page with large empty vertical gaps between sparse sections — reveal-on-scroll content is fine, but pacing feels thin/over-spaced on mobile; several dark bands carry little. | Tighten section spacing on mobile; add a supporting visual/proof point to the emptiest bands. | M |
| 15 | Coherence — brand systems | P2 | Three+ distinct shells: marketing (dark editorial wordmark) → funnel/app (warm-paper), login (FTA brand), shop (sub-branded "The Cheat Code Guides" with its own header + "Member login" pill). Funnel→app is coherent; login + shop are the jarring seams. | Unify login into FIC; give shop a clearer "part of Family Investing Club" tie-in so the sub-brand doesn't read as leaving the site. | M |
| 16 | In-app theme | P3 | App ignores `prefers-color-scheme: dark` — renders warm-paper light on dark-preferring devices (dark captures were identical to light). Likely intentional, but flag. | If light-only is intentional, fine; otherwise add a dark treatment. At minimum confirm it's a deliberate brand choice. | S |
| 17 | Funnel landing copy | P3 | "Reserve your seat in 30 seconds" but the flow is 6 steps (3 quiz + email + result + register) ≈ 60–90s. Mild overclaim. | Either trim to match the claim or soften to "in about a minute." | S |
| 18 | Free session upsell load | P3 | Count of Join-FIC touchpoints in one free session is on the high side: FreeHome alone stacks ~3 "Join FIC — $99/mo" CTAs (journey band, unlocks grid, footer) before you leave the home screen; plus community band, every locked page, confirmed page. Tone is right, but density on FreeHome is heavy. | Consolidate FreeHome to one primary Join CTA + one "compare" link; let the locked-door UpsellCards carry the rest. | S |
| 19 | Confirmation page | ✅ Good | Polished, celebratory, on-brand: class card, Add-to-calendar, watch-first video, "Join FIC $99/mo" + "Explore the app free", education-only disclaimer. Strong close. | Keep. | — |
| 20 | Picks (free teaser) | ✅ Good | Real company card (Apple), live price, % since pick, chart, thesis teaser with like/comment counts, and an honest "nothing here is investment advice · prices delayed ~15 min" disclaimer. Excellent trust posture. | Keep. | — |
| 21 | Courses (free sampler) | ✅ Good | 3 full free lessons with genuinely rich illustrated covers, "Quiz + XP", clear "28 more lessons" lock, honest "FREE SAMPLER" framing. Note: course art is beautiful — the contrast with the placeholder shop covers is stark. | Keep; consider borrowing the course art quality for shop covers. | — |
| 22 | UpsellCard system | ✅ Good | Single source, contextual per door, adult-first, confident-not-desperate, no fake urgency, always names what's behind the lock + the forward path. Protect this in any rebuild. | Keep. | — |
| 23 | `/help` | ✅ Good | Clean AI ("Ask Kai's help bot") + "Speak to the team" ticket handoff, "Talk to a human instead", scoped disclaimer ("can't give trading advice"). | Keep. | — |
| 24 | Shop product/bundle | ✅ Good | Price anchoring (compare-at strike + "Save $23"), bundle "includes 3 books" itemized breakdown, "What's inside", page count, "Secure checkout by Stripe · Ships to US & Canada". Solid presentation. | Keep; add the shipping/returns line (finding #9). | — |
| 25 | `/schools` (marketing) | ✅ Good | Rich B2B page: curriculum modules, "games they beg to replay", weekly live classes, transparent bulk pricing tiers ($12/$8/Custom), demo CTAs. Distinct coral palette is acceptable for a separate audience. | Keep. | — |

---

## Severity counts
- **P1: 3** (#1 login brand, #2 community test-data flood, #3 FreeHome/upgrade slow load)
- **P2: 8** (#4 funnel step latency, #5 courses upsell layout, #6 profile over-gating, #7 community composer dead-end, #8 upgrade FTA-first, #9 shop shipping/returns, #10 landing no social proof, #14 marketing pacing, #15 brand-system seams — *counted once*)
- **P3: 6** (#11 grid truncation, #12 top-bar title, #13 shop covers, #16 theme, #17 30s claim, #18 FreeHome CTA density)
- **Good / keep: 7** (#19–25)

*(Note: #15 spans P2; total distinct findings = 25.)*

## Upsell-pressure verdict
Calibration (tone) is **on-brand and correct** — confident, education-first, no desperation. The
issue is **density and placement**, not aggression: FreeHome front-loads ~3 identical "Join FIC —
$99/mo" CTAs, and the strongest natural upsell moment (a lively community) is undercut by test data.
Fix the placement bugs (#5, #6, #7, #18) and the trust flood (#2) and the free tier converts on
strength, not repetition.
