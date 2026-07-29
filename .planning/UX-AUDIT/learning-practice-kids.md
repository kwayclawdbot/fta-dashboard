# UX Audit — Learning · Practice · Kid/Teen surfaces

**Scope:** Live audit of `https://fta-dashboard-ruddy.vercel.app` as three seeded FIC-tier personas
(parent · teen `age_group=teens` · young kid `age_group=kids`) + a fresh-parent onboarding walkthrough.
**Method:** Playwright, desktop 1440 + mobile 390 (kids/teens weighted mobile), light theme (dark verified on sidebar).
**Date:** 2026-07-22. Read-only. No app code changed. Disposable accounts cleaned up after.
**Screenshots:** `scratchpad/ux-audit/learning/` (98 shots; `recap_*` = long-wait re-captures, `lesson_*`, `onboard_*`).

> **Framing — read this first.** The FIC-VISUAL-UX-PLAN is now **~90% shipped**. The "just textboxes"
> gap it targeted is largely CLOSED: `MoneyMachine` (Company of the Week), `MissionEmblem` (5 bespoke
> patches), `ResearchLadder`, `SetupTrail`, `EmptyState`, `Celebrate` (emblem-stamp + confetti + level-up),
> and a cinematic **narrated** lesson player are all live and genuinely good. This audit therefore does
> **not** re-recommend those. It is a fresh-eyes pass on what is **still broken, register-wrong, or newly
> inconsistent** on top of that upgraded base. The single most important finding is a hard bug (P1 #1),
> not a visual-richness gap.

---

## Top 5 (narrative)

**1. `/progress` is an infinite spinner — "My Progress" / kid "My Badges" never loads.** Definitively
reproduced: at 5s, 10s, 20s and 30s the page shows only the shell + a spinning circle (no console error —
an async load that never resolves), desktop and mobile, every persona. The entire achievements surface
(level bar, stat grid, badges, report card) is unreachable. This is the app's core motivation-payoff page
and, for a kid, the "My Badges" nav item — and it's dead. Everything else is polish next to this.

**2. The kid learning path has two age-appropriateness breaks.** (a) A young kid's **"My Lessons"** page
leads with the advanced **"FTA Trade Ready — 6-Week Live Program"** ("liquidity sweeps, fair value gaps,
ORB, execution playbook") + a **"Join the next cohort"** upsell — an ICT day-trading cohort pitched above a
6-year-old's actual content. (b) Opening the first **kids-corner lesson** lands on a hard **"Lesson Not
Found"** dead-end (kid has RLS read access, so this is a client/data or locked-state-rendered-as-error
problem, not permissions) — a young kid's first lesson click is an error page with only "Back to course."

**3. Register leaks — teens get baby-talked, children get parent chores.** The **Missions** page treats
*any* child as a young kid (`isKid = role === 'child'`), so a 15-year-old sees **"Kid Missions / Little
quests that turn you into an investor / Collect all five emblems!"** plus a kid sound-toggle — the exact
opposite of the "teens = rank/level framing, no baby-talk" standard. Separately, both the teen and the kid
dashboards show a **"Finish setting up your family — 0 of 6 Start Here steps"** nudge: a parent-only
account task a child cannot complete.

**4. The highest-value learning moment is celebrated nowhere.** Finishing a lesson awards **+50 XP
silently** — "Mark Complete" just swaps to a static green "Completed" pill; no toast, no XP pop, no
`Celebrate`. Missions, watchlist unlocks and level-ups all got the celebration treatment, but the lesson —
the thing the whole product exists to make kids do — gives zero feedback at completion. (Quiz pass is also
un-celebrated; the results screen is a static score review.)

**5. Core club pages have a slow/again-skeleton first load, and it lands hardest on the youngest.**
Dashboard / This Week / Watchlist / Start-Here repeatedly showed prolonged skeleton or spinner states
(watchlist & start-here still spinning past 18s on mobile). The content, when it resolves, is excellent
(the Apple **MoneyMachine** on This Week is a flagship) — but a brand-new family, especially a kid on a
phone, often meets an unbranded spinning circle first. Perceived performance is now the weakest link on
surfaces whose *content* is already strong.

---

## Findings table

| # | Page | Persona | Sev | What's wrong (1 line) | Recommendation (1 line) | Effort |
|---|------|---------|-----|------------------------|--------------------------|--------|
| 1 | /progress (My Progress · kid "My Badges") | all | **P1** | Infinite spinner — content never renders at 5/10/20/30s, no console error | Find the unresolved/failing query, set `loading=false` on error + render a fallback; add a timeout guard | M |
| 2 | Kid lesson player (`/courses/fic-kids-corner/…`) | kid | **P1** | Valid first kid lesson → hard "Lesson Not Found" dead-end (RLS is fine) | Fix the lesson-load path for kids-corner; if drip-locked, render a kid-friendly "unlocks soon" state, never an error | M |
| 3 | /courses "My Lessons" | kid | **P1** | Leads with advanced FTA ICT cohort ("liquidity sweeps/FVG/ORB") + "Join cohort" upsell | Hide the FTA live-program card + cohort upsell for `age_group=kids`; lead with "My Adventures" | S |
| 4 | Lesson player — completion | all | **P1** | +50 XP awarded silently on Mark Complete; no celebration at the core action | Fire `Celebrate` (XP pop / register-correct) on lesson complete like missions already do | S |
| 5 | /missions | teen | P2 | Teens get young-kid register ("Kid Missions / Little quests / Collect all five emblems" + sound toggle) | Split register: `isKid` should be `age_group==='kids'`, teens get rank/level copy, no sound | S |
| 6 | Dashboard nudge | teen, kid | P2 | Children see "Finish setting up your family — 0/6 Start Here" (a parent-only task) | Gate the family-setup nudge to `role==='parent'`; kids get a kid-appropriate next-step | S |
| 7 | Kids Corner home (empty state) | kid | P2 | New kid (0 XP, 0 lessons) sees "You did it! / All caught up" completion celebration | Give the no-lessons-yet kid a real "start your first adventure" invitation, not a win screen | S |
| 8 | Dashboard / This Week / Watchlist / Start-Here | all | P2 | Prolonged skeleton/spinner on first load (watchlist & start-here still spinning >18s on mobile) | Parallelize the sequential queries; render partial content progressively; branded skeletons | M |
| 9 | /progress badge system | all | P2 | Still the legacy DB-badge grid; has NOT adopted `BadgeCase`/`BadgeCaseView` (used in community) or `StreakFlame` | Adopt the credential shelf + `StreakFlame`; retire the ad-hoc on-the-fly badge criteria (once #1 fixed) | M |
| 10 | HTML lesson player | kid, teen | P2 | HTML lessons drop the AI-Coach / Notes / lesson-list sidebar that video lessons have | Add a persistent "stuck? ask the coach" / lesson-list affordance to the HTML lesson chrome | M |
| 11 | /live-sessions | all | P2 | Defaults to empty "Live Now" tab — first view is an empty state though Upcoming/Recordings have items | Default to "Upcoming" (or the first non-empty tab) when nothing is live | S |
| 12 | Login + onboarding branding | parent (new) | P2 | Auth/onboarding say "Family Trading Academy"; member app is "Family Investing Club" | Unify to "Family Investing Club" on auth/onboarding (or make the split intentional & explained) | S |
| 13 | Top bar page title | all | P2 | Many routes (chart, games, missions, lesson, start-here) show "Home" as the top-bar title | Derive the top-bar title from the active route/section, not a "Home" fallback | S |
| 14 | Lesson player | all | P3 | "Mark Complete" is enabled immediately, before any engagement with the lesson | Gate completion on narration/section progress (or a light "watched?" check) | S |
| 15 | /simulator (Trading Floor) | parent, teen | P3 | Loads with a bare spinner, no skeleton/context (+ one transient 504 on cold start) | Add a branded loading state + a one-line "what this is" while the chart boots | S |
| 16 | App Tour | teen, kid | P3 | 11 steps, identical copy for parent/teen/kid; long for a "one-minute tour" | Trim steps; register-differentiate the copy (kid "adventure" vs parent "here's your home") | S |
| 17 | /missions emblems (uncollected) | kid, teen | P3 | Emblems are small, warm-on-warm, low-contrast until earned — don't yet read as "collectible" | Slightly lift uncollected-emblem contrast/size; keep the gold-ring "collected" delta | S |
| 18 | Dashboard "Your family this week" strip | parent | P3 | Family members shown as initials (AT/AK), not the illustrated `Avatar` they just picked | Wire `Avatar` into the family strip (plan §1.1 — still not done) | S |
| 19 | Kid mobile bottom tab | kid | P3 | Center FAB is "Community" (open chat) as the primary tab for young kids | Make the kid FAB "Home"/"Missions"/"Play"; move Community off the primary slot for `kids` | S |
| 20 | Onboarding profile steps | parent (new) | P3 | Clean but visually spare (plain centered card, no motif/illustration) for a "built-for-you" moment | Add a light motif/illustration per step to warm the personalization flow | S |
| 21 | Quiz results (QuizPanel) | all | P3 | Pass = static score + review; no celebration for clearing the quiz | Add a modest register-correct win on pass (kid confetti, teen/parent quiet) | S |
| 22 | Gated-state consistency | all | P3 | Locks are inconsistent: kid lesson = hard error; FTA = "Enrollment required/Join cohort"; free-tier = locked nav | Standardize one "locked/unlocks" component + copy across tiers/ages | M |
| 23 | Kids Corner "Start Here" nudge target | kid | P3 | Kid's Start-Here nudge points at parent-oriented account-setup steps | Give kids a kid Start-Here (or hide setup steps they can't do) | S |
| 24 | Live class recording playback | all | P3 | Recordings tab shows a count (1) but the in-tab playback UI wasn't reachable in this pass | Verify recording open/playback works from the Recordings tab (unverified — flag) | S |
| 25 | Lesson player mobile (390) | all | P3 | HTML lesson intermittently failed to resolve the iframe at 390 while 1440 loaded | Confirm the HTML-lesson iframe loads reliably on phones (mobile is the kid default) | S |

---

## What's GOOD (do not touch — this is the quality bar)

- **Lesson player (HTML lessons).** Cinematic hero (photo + animated chart), big display title, meta chips
  (audience / time / level / "hands-on + quiz"), and — the standout — **built-in narration**: an audio
  scrubber with per-**section** markers and speed control, "Press play — I'll narrate the whole way." This
  is genuinely north-star for a family product. See `lesson_parent_top_1440.png`.
- **This Week / Company of the Week — the `MoneyMachine`.** Fully realized: real logo + live delayed price,
  product tokens → a "MAKES MONEY" gear (with a red warning light) → gold-coin payoff bars → a
  "why customers love them" heart-meter, plus discussion question, watchlist/family assignments, and a
  "Draw the money machine" challenge. Flagship. See `recap_teen_thisweek_390.png`.
- **Kid Missions.** Five bespoke emblem medallions (Brand Detective magnifier, Snack Stock, Money Machine
  gear, Stock-vs-Product balance, Family CEO), XP chips, a "0/5 done" trophy counter, kid-voiced prompts +
  grown-up helper lines, and register-correct `Celebrate` (emblem stamp + confetti + level-up).
- **Games hub + games.** Bespoke tug-of-war hero, per-game illustrated cards (Candle Battle / Trend or Trap
  / Pattern Practice), clear states + Play CTAs. `parent_games_1440.png`.
- **Flashcards.** Daily 5 hero, visual card sets with candle/chart art, mobile bottom-tab nav. Strong.
- **Kids Corner dashboard.** Real kid voice ("Hey Audit! Ready for today's adventure?"), Level/Explorer
  chip, "Our House Rules," "More fun" nav, bespoke celebration art. Well-derived from the adult base.
- **Courses catalog.** Bespoke per-course art, clean tier structure (Live Program / Adult / Teen), progress.
- **Onboarding.** Clean 7-dot stepper, skippable profile steps, and a genuine personalized payoff
  ("Good afternoon, Fresh / Recommended for your family / Picked from what you told us").
- **Watchlist `EmptyState` + `ResearchLadder`, Start-Here `SetupTrail`, dark-mode sidebar** — all shipped.

---

## Counts by severity

- **P1: 4** (#1 progress infinite spinner · #2 kid lesson "Not Found" · #3 kid FTA-cohort upsell · #4 silent lesson-complete)
- **P2: 9** (#5–#13)
- **P3: 12** (#14–#25)
- **Total: 25**

## Notes / caveats
- `/progress`, and to a lesser extent watchlist & start-here, would not finish loading within the capture
  window — several of their intended visuals (badge shelf, research ladder on a populated board) could not
  be seen live and are assessed from source. Fixing #1/#8 is a prerequisite to auditing those visuals.
- Register logic is derived **inconsistently** across pages: dashboard uses `track`, missions uses
  `age_group`/`role`. Worth a single shared `useRegister()` helper (relates to #5, #6).
