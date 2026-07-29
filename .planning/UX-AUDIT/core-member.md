# Core Member Surfaces — UX Audit (READ-ONLY)

**Auditor pass:** 2026-07-22 · signed-in Playwright capture, live prod `https://fta-dashboard-ruddy.vercel.app`
**Slice:** /dashboard (Home + This Week), /community, /picks (+detail), /watchlist, /start-here, /parent-corner, /family/* (overview, leaderboard, members), /referrals, /upgrade (FIC sales + FTA panel)
**Method:** seeded 2 disposable families (1 FIC, 1 FTA, each parent + 2 kids) via service role → logged in as each parent → screenshotted desktop 1440 + mobile 390, light + dark. Screenshots: `scratchpad/ux-audit/core/`. All disposable data cleaned up (verified 0 residue).

> **Context that reframes this audit:** `FIC-VISUAL-UX-PLAN.md` Phase 1 is **substantially SHIPPED**, not pending. The `<MoneyMachine>` (This Week COTW), `<SetupTrail>` (Start Here), the watchlist corkboard empty state, the `<BadgeCase>` credential shelf, and the picks card/detail are all live. So this audit is not a re-litigation of that plan — it audits the *shipped implementation* and flags what's still flat, broken, or newly inconsistent as-built. Where the plan is well-executed, it's called out as GOOD / don't-touch.

---

## The 5 biggest wins (narrative)

1. **Fix the Start Here first-run media — it's the make-or-break funnel and it's visibly broken.** The embedded "Family orientation" deck iframe renders as a **blank white box**, and the "two-minute app tour" video above it sits on a **perpetual loading spinner**. A brand-new family's very first guided screen shows two empty/broken media wells. This is the single highest-value fix on the slice.

2. **Collapse the three competing onboarding prompts on Home.** On first load a new family sees the welcome **tour modal** + a **"Finish setting up your family"** card + a **"Tell us about your family"** card — three amber/gold nudges stacked with no clear primary. Pick one primary next-action; gate the profile-questions nudge behind Start Here completion.

3. **Give FTA families a premium home.** A family that paid **$2,997** lands on a Home *visually identical* to a $99/mo FIC family — same hero, same "This Week in FIC" tabs, no FTA program surface anywhere above the fold. Add a tier-gated FTA program module (next live class + 6-week curriculum progress) so the premium purchase is visible where they land.

4. **Wire the illustrated avatars everywhere (flip `AVATAR_EXT`).** Family strip (Home), Leaderboard, Members, and Overview all render **flat colored-initial circles** despite finished illustrated avatar packs sitting in `/public/avatars`. This is the highest warmth-per-effort change on the slice and reinforces the avatar the family picked in onboarding.

5. **Surface the credential shelf and make earning one a moment.** The `<BadgeCase>` (Scout → CEO) is genuinely nice but **buried under Family › Members**; a parent or kid hunting for achievements on *My Progress* won't find it, and locked tiles are flat lock icons. Mirror the shelf onto My Progress and add the earned-seal reveal the register calls for.

---

## Findings

Severity: **P1** blocks value · **P2** friction · **P3** polish. Effort: **S**/**M**/**L**.

| # | Page (viewport/theme) | Sev | What's wrong | Recommendation | Effort |
|---|---|---|---|---|---|
| 1 | Start Here (all) | **P1** | "Family orientation" deck iframe renders a **blank white box**; the "two-minute app tour" video above it is stuck on a **loading spinner** — the first-run screen's two core media embeds are empty/broken. | Fix/replace the orientation embed `src` and verify the tour video URL; don't ship a first-run screen with two dead wells. | M |
| 2 | Dashboard Home (all, first load) | P2 | Three onboarding prompts compete: tour modal + "Finish setting up your family" + "Tell us about your family," all gold, none dominant. | Collapse to ONE prioritized setup card; show the profile-questions nudge only after Start Here is done. | M |
| 3 | Dashboard Home (FTA, all) | P2 | FTA family's Home is indistinguishable from FIC — same hero, "This Week in **FIC**" tabs, no FTA program surface for a $2,997 buyer. | Add a `tier==='fta'` Home module above the fold: next live class + 6-week curriculum progress. | M |
| 4 | Parent Corner (all) | P2 | No "your family this week at a glance" — the guiding parent gets 6 stacked text sections with zero picture of where *their own kids* are. | Add a compact per-child strip (avatar + this-week mission/research/XP) above the weekly reading; reuse `Avatar` + existing XP/mission queries. | M |
| 5 | Family › Members / My Progress | P2 | The `<BadgeCase>` credential shelf is buried under Family › Members; not discoverable from My Progress; locked tiles are flat lock icons. | Mirror the shelf onto My Progress; add the earned wax-seal reveal (§2.4 of the plan). | M |
| 6 | Upgrade — FIC sales (1440) | P2 | Two sections ("A real program, not another video dump" and "The six weeks / A clear path from zero") render **blank** in static/full-page capture — consistent with `whileInView` reveals starting at `opacity:0`. Risk: invisible under `prefers-reduced-motion` / no-scroll. | Guarantee a reduced-motion / in-view fallback so content is visible; build the week-by-week visual the "six weeks" heading promises (it's currently empty). | M |
| 7 | This Week — MoneyMachine (390) | P3 | On mobile the machine stacks vertically (inputs → machine → payoff as three rows), losing the left→right "inputs turn into profit" narrative that carries the lesson. | Keep a compact horizontal/numbered mini-flow on mobile so the input→engine→output story survives. | M |
| 8 | This Week (1440) | P3 | The class card ("How Apple Makes Money" + RSVP) is a large near-empty gold block sitting **above** the rich MoneyMachine — hierarchy inverts (thin thing on top). | Slim the class strip to a single row, or move MoneyMachine up as the marquee. | S |
| 9 | Picks grid (1440) | P3 | A single active pick sits alone on a very wide canvas — the page reads empty. | Constrain to a max-width 2-up column and/or add a "past picks / watching" rail so it's never one lonely card. | S |
| 10 | Start Here (all) | P3 | TWO videos stacked (app-tour video AND orientation deck iframe) with the SetupTrail wedged between — unclear which to watch first. | One primary video; make the SetupTrail the header hero above a single embed. | S |
| 11 | Parent Corner (all) | P3 | Weekly card = 6 lucide-icon+LABEL+paragraph blocks; substance is right but reads as a wall of text. | Tighten to scannable rows or collapse secondary sections to an accordion; keep it text (correct adult register). | S |
| 12 | Family Overview (all, new family) | P3 | Headline stats render "0 / 0h / 0 / 0" with no warmth for a first-week family — stark. | First-week empty treatment ("Your family's story starts this week") instead of a row of zeros. | S |
| 13 | Leaderboard / Members / Overview / Home strip | P3 | Flat colored-initial avatars everywhere despite finished illustrated packs; leaderboard #1 crown lands arbitrarily when all members are tied at 0 lessons. | Wire illustrated `Avatar`; suppress the crown until the leader has >0 activity. | S |
| 14 | Upgrade — FTA panel (all) | P3 | "You're an FTA family" confirmation card is good but the page dead-ends into empty space below — no next value. | Add "your next live class" + program progress beneath the card. | S |
| 15 | Global top bar (picks, watchlist, start-here, parent-corner, referrals) | P3 | Top-bar heading reads **"Home"** on these pages (only Family Overview / Upgrade / Community set it correctly). | Set a per-route title in `DashboardTopBar`. | S |
| 16 | Onboarding / app-wide | P3 | Illustrated PNG avatar packs exist but the app resolves SVG/initials (`AVATAR_EXT`). Owner-gated per plan §5. | Flip `AVATAR_EXT` svg→png once packs are final (one line) to warm every avatar. | S |

**Counts:** P1 = 1 · P2 = 5 · P3 = 10 · (GOOD/don't-touch = 8, below).

---

## GOOD — do NOT touch (this is the quality bar)

- **`<MoneyMachine>` (This Week COTW)** — a real data-viz teaching component: "what they sell" input tokens → a gear "MAKES MONEY" machine with a red warning light → "THE PAYOFF" bar chart → a filling "why customers love them" heart-meter, with live price/market-cap and "Read the full breakdown." This is the north-star the flat pages should reach. **Leave the concept intact** (only the mobile-stacking nuance in Finding 7).
- **`<SetupTrail>` (Start Here)** — the 6-stop winding journey with a lit gold current node, dashed connecting path, and a flag finish. Exactly the motivating hero the funnel needed. (The *media around it* is broken — Finding 1 — but the trail itself is right.)
- **Watchlist empty state** — the "Start your research board" corkboard + pin + sun-circle halo is on-brand and inviting; do not revert to a dashed rectangle.
- **Picks card + detail** — logo, price with %today AND %since-pick, thesis headline, real sparkline, engagement counts; detail page pairs a video embed with genuinely good long-form thesis prose, read-more links, and a comments composer. Strong.
- **Family Overview report cards** — per-child Foundations bar, quiz/practice/badges stat tiles, a "Needs work" callout, and an AI "Coach's note." The most sophisticated surface on the slice.
- **Community feed** — the richest page: This Week card + pinned announcements + composer + image/reel posts + auto-posts for credentials/research/level-ups + family-pick embeds, with a Live Rooms + This Week Snapshot right rail that collapses cleanly to the top on mobile.
- **Referrals** — link + code chip + share buttons + 3 stat tiles + How-it-works; clean and complete.
- **Upgrade FIC sales hero + FIC-vs-FTA comparison table + FAQ** — solid (aside from the two blank reveal sections, Finding 6).

## Notes on things I could not fully exercise
- **Watchlist `<ResearchLadder>` / verdict-unlock** and the **loaded** watchlist board couldn't be audited from a fresh family (empty board only). Worth a follow-up pass with a seeded, partially-researched watchlist.
- **FTA execution rail on Home** didn't render because the disposable FTA family has no cohort/week assigned — Finding 3 assumes that; re-verify against a cohort-enrolled FTA family.
- **Mobile 390 overall:** no horizontal overflow observed; the bottom tab bar (Home/Watchlist/Community-FAB/Live/More) and the Community rail-collapse both behave. Mobile is in good shape.
