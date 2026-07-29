# UX Audit — Master Synthesis (2026-07-22)

Merged from four parallel read-only audits of live prod (226 screenshots, all personas/viewports/themes):
core-member.md · learning-practice-kids.md · acquisition-free-commerce.md · navigation-ia.md

Browsable report: https://claude.ai/code/artifact/2f96c992-2289-46f9-b003-04a244f154d7

## Scoreboard
83 raw findings → 12 P1 · 28 P2 · 35 P3 · 23 keep-callouts. Cross-lane duplicates (top-bar titles ×3, login brand ×2, slow loads ×2, avatars ×2) merged.

## P1 (fix now)
1. /progress infinite spinner (all personas — achievements page dead)
2. Start Here: orientation iframe blank + tour video never loads (first-run screen)
3. Kid first lesson → hard "Lesson Not Found" (client bug, not RLS)
4. Kids' "My Lessons" leads with FTA ICT cohort + join upsell (age-inappropriate)
5. Lesson complete = silent +50 XP, zero celebration (core action)
6. Login/onboarding still branded "Family Trading Academy"
7. Community feed flooded with test data (purge agent dispatched — backup-first)
8. FreeHome + /upgrade 6–11s skeleton hangs (no timeout/fallback in load chains)
9. TopBar route-title map stale — "Home" on ~11 routes
10. "This Week" nav item can never show active (query-param link) — retire into Home
11. Admin: 3 competing CRM navs + duplicate member directories (/admin/users vs Contacts)
12. Home stacks 3 competing onboarding prompts; they re-fire after completion

## Nav decision (owner)
Scheme B (frequency-tiered) recommended: FIC parent 19→9 top-level + utility footer; club surfaces stay 1-tap; Learn▸/Family▸ nest; FTA header → gold "Academy ▸" group; This Week + Start Here retire into Home. Kid mobile FAB → not open-chat. Full trees (A/B/C, all personas, tab-bar slots): navigation-ia.md §2.

## Quick wins (S)
Teen baby-talk register (isKid by age_group not role) · kids shown parent-only setup nudge · free users blocked from own profile · dead free composer · courses UpsellCard mobile layout · Live Classes default tab · shop shipping/returns info · funnel landing social proof threshold · new-kid empty state says "All caught up" · wire illustrated avatars + AVATAR_EXT flip · FreeHome CTA density + label truncation · zero-XP crown · quiz-pass celebration · "30 seconds" claim · lonely picks grid.

## Big rocks (M/L)
Perf lane (parallelize load chains, progressive render, branded skeletons — dashboard/thisweek/watchlist/start-here/free/upgrade/funnel) · FTA premium Home rail + audience-aware /upgrade (FIC-first for free users) + blank whileInView sections fallback · BadgeCase→My Progress + earned-seal + StreakFlame · shared useRegister() + one locked-state component · Parent Corner per-child strip + This Week hierarchy/mobile MoneyMachine flow · admin sidebar grouping + CRM nav consolidation.

## Keep (don't regress)
MoneyMachine · narrated lesson player · mission emblems+Celebrate · SetupTrail · watchlist corkboard/ResearchLadder · picks cards+detail · report cards · community feed · UpsellCard tone · sampler + course art · funnel confirmation · games/flashcards/Kids Corner · help · shop anchoring · /schools · onboarding payoff.

## Couldn't reach (re-audit after P1s)
Loaded watchlist ladder/verdict-unlock · FTA Home execution rail (needs cohort family) · recording playback UI · HTML-lesson iframe @390 reliability · dark-mode intent on free surfaces.
