# V1-REMNANT AUDIT — the kill-list and consolidation plan
**2026-07-23 · AUDIT lane (read-only). Owner directive: "I don't want ANY trace of past UI/UX on this app."**
Inputs: full-code sweep of `src/` against the canvas language (CONVERSION-PLAN.md, DESIGN-UX-SPEC.md, MOCKUP-CAPABILITY-AUDIT.md, LIVE-LEADERBOARD-CANVAS-NOTES.md) + the 124-route map in CURRENT-APP-INVENTORY.md.

Grade key: **A** v2-converted, clean · **B** v2-converted but leaking v1 · **C** unconverted pure v1 · **D** flagged separately in §3 (conflation/legacy-stacking — orthogonal to A/B/C).
Flag mechanics context: `NEXT_PUBLIC_DESIGN_V2` is **env-only, build-time** (`src/lib/design-flag.ts:19-21`) and `data-design="v2"` is stamped **post-hydration** in `src/components/dashboard/v2/DesignManager.tsx:26-38` — a one-frame theme flash exists on any v2 root without `--cc-*` fallbacks.

---

## §1 Scorecard — every user-facing surface

### Global chrome (wraps every dashboard route)

| Surface | Grade | Issue |
|---|---|---|
| DashboardShell frame | **B** | Challenge + clubLapsed/FTA banners render v1 gold/midnight unconditionally (`DashboardShell.tsx:251-289`) |
| TopBarV2 | **B** | v1 CommandSearch + v1 NotificationsBell round controls embedded (`TopBarV2.tsx:92,97`) |
| SidebarV2 / MobileTabBarV2 | A | Clean; but IA itself is v1 (15+ items) — see §4 |
| Kai FAB | A | Untouched by design (adult club surfaces) |

### Entry / auth / paywall

| Route | Grade | Issue |
|---|---|---|
| `/` splash | **B** | Renders on user-theme ground — must force dark full-bleed per board 09 (known follow-up, CONVERSION-PLAN Phase 1 note) |
| `/login` | A | Clean (`--cc-*` branch) |
| `/signup` | C | Redirects off-app to familyinvestingclub.com (`signup/page.tsx:9`) — brand + funnel decision |
| `/signup/invite/[code]`, `/forgot-password`, `/auth/*` | C | Pattern-adoption tier (auth plumbing) |
| `/onboarding`, `/onboarding/profile` | C | NEW canvas **Onboarding** (needs fetching); Phase 5. Contains "This Week in FIC — together" copy (`onboarding-profile.ts:320`) |
| `/pricing` | A | PricingV2 clean, real matrix |
| `/upgrade` | **B** | v2 shows compact paywall only — long-form FTA narrative unconverted; `upgrade/loading.tsx` flashes v1 DashboardSkeleton |
| `/r/[code]` | C | Handler; no UI concern |

### Home + core converted loop

| Route | Grade | Issue |
|---|---|---|
| `/dashboard` (solo adult) | **B** | ClubHomeBoard clean, but embeds v1 ChallengeSlot (`ClubHomeBoard.tsx:1024`) + v1 LiveNowStrip (`:1026`); `dashboard/loading.tsx` = v1 DashboardSkeleton |
| `/dashboard` (kid/teen) | **B/C** | `ClubHomeV2.tsx:224` — only `register === "adult"` gets the v2 board; kid/teen fall through to v1 warm-sand board (`:238-299`, `club-b-card`/`volt-500`/`gold-700`) inside v2 chrome |
| `/dashboard` (free) | C | FreeHome fully v1 inside v2 chrome |
| `/dashboard` (family) | C | DashboardHomeClient fully v1; dense FIC framing ("This Week in FIC" `:793,802`) — family conversion is Phase 4 |
| `/discover` | **B** | DiscoverClientV2 clean EXCEPT Screener tab embeds v1 ScreenerSurface whole (`DiscoverClientV2.tsx:781`, comment `:765` admits it) |
| `/research/[ticker]` | **B** | Worst B: v1 PriceTechnicals (`ResearchClientV2.tsx:1588`), Fundamentals (`:1642`), KaiReportSection (`:1844`), TickerDebate (`:1467`), ChangedMyMind (`:771`), ResearchObjectCompose/Card (`:1439/:1450`), UpsellCard (`:1646,1791`), Gated/ContextualWall (`:1438`), news KindChip; `research/[ticker]/loading.tsx` v1 skeleton |
| `/research/thesis/[id]` | C | Pattern-adoption (research-object card language) |
| `/progress` | **B** | ProfileSurfaceV2 clean; `progress/loading.tsx` flashes v1 `club-b-card` skeleton |
| `/u/[username]` | C | Public profile — board 07 trimmed (Club Screens 09) |

### Community / social

| Route | Grade | Issue |
|---|---|---|
| `/community` FEED | **B** | CommunityClientV2 clean except v1 AnnouncementCard pinned + in-feed (`CommunityClientV2.tsx:849,1122`, comment `:847` admits it); `community/loading.tsx` v1 skeleton |
| `/community` DISCUSSIONS | **B** | v1 ClubDiscussions whole (`ClubModeShellV2.tsx:230`; self-documented at `:226-228` as accepted follow-up) |
| `/community` LOUNGE | **B** | v1 ClubRooms whole (`:243`) |
| `/community` LIVE | **B** | v1 ClubLiveTab whole (`:247`) |
| `/community/compose` | A | ShareYourCallV2 clean |
| `/community/changed-my-mind` | A | ChangedMyMindV2 clean (route's existence = §3 D2) |
| `/circles`, `/circles/[slug]` | **B** | V2 surfaces token-clean; only `circles/loading.tsx` flashes v1 DashboardSkeleton |
| `/vip-room` | C | Challenge generation graft — see §3 D8; NEW canvas needed (VIP room brief #10) |

### Live / rank

| Route | Grade | Issue |
|---|---|---|
| `/live-sessions` | **B** | LiveSessionsSurfaceV2 clean (L1/L2); `live-sessions/loading.tsx` flashes v1 `club-b-card` |
| `/leaderboard` | **B** | LeaderboardSurfaceV2 clean; `leaderboard/loading.tsx` v1 flash |
| `/belts` | **B** | BeltLadderV2 clean; `belts/loading.tsx` v1 flash |

### Watch / markets (all unconverted)

| Route | Grade | Issue |
|---|---|---|
| `/watchlist` | C | 1,975-line v1 client; covered by board 06 WATCHLIST sub-tab; Phase 3 |
| `/watchlist/community` | C | v1; board 17 (Club Picks pattern); Phase 3; absorbed Team Picks thesis (comment `CommunityWatchlistClient.tsx:886`) |
| `/alerts`, `/alerts/e/[id]` | C | v1; boards 18/19; Phase 3. Route already retitled "Kai Watch" (`alerts/page.tsx:40`) — see §3 D3 |
| `/screener` (standalone) | C | v1 ScreenerSurface; board 15 covers it — same component as the Discover leak, one v2 skin fixes both |
| `/news`, `/news/[slug]` | C | NEW canvas **Newsroom** (needs fetching); board 02's newsroom foot = placement; Phase 5 |
| `/kai` | C | v1 chat; board 14 pattern + FAB full-screen; Phase 3+ |
| `/chart` | C | v1; board 12 chart chrome; overlaps simulator — §3 D4 |

### Learn / practice (all unconverted — Phase 3)

| Route | Grade | Issue |
|---|---|---|
| `/courses`, `/courses/[slug]`, lesson player | C | Boards 08/20/21; LessonViewerClient has a legacy video/html/iframe/mock fallback path (`:78,529`) |
| `/start-here` | C | Board 20 node language; file already carries "legacy purge" archaeology comments (`start-here/page.tsx:38`) |
| `/flashcards` | C | Board 21 quiz language |
| `/games`, `/games/candle-battle`, `/games/trend-or-trap` | C | Re-token; overlaps simulator scenarios — §3 D4 |
| `/simulator`, `/simulator/simbot`, `/simulator/lessons`, `/simulator/lessons/[scenarioId]` | C | NEW canvas **Simulator** (needs fetching); second lesson engine — §3 D4 |
| `/missions` | C | Kid register; derived from Family canvas; Phase 4 |
| `/live-sessions` replays | (in B above) | Replay library = L2 |

### Family mode (15 routes — all C, Phase 4, Family canvas F1-F9)

| Route | Grade | Cover |
|---|---|---|
| `/family` | C | F1 |
| `/family/overview`, `/family/members`, `/family/tonight` | C | NEW canvas **Family Nights** briefs (#11 — needs fetching) |
| `/family/corner` | C | F8 |
| `/family/watchlist` | C | F6 (overlap — §3 D2) |
| `/family/circle` | C | F4 |
| `/family/learn` | C | F5 |
| `/family/live` | C | F7 |
| `/family/leaderboard` | C | R2 (Live+Leaderboard canvas — notes already local) |
| `/family/teen/[memberId]` (+progress, +guardrails) | C | F2/F9/F3 |
| `/parent-corner` | C | Legacy redirect — kill-list §3 D6 |

### FTA / shop / collection

| Route | Grade | Issue |
|---|---|---|
| `/fta/chat`, `/fta/courses`, `/fta/recordings` | C | NEW canvas **FTA Hub** (brief #6 — needs fetching); gold lane preserved; Phase 5 |
| `/shop`, `/shop/[slug]`, `/shop/thanks` | C | NEW canvas **Shop** (brief #7 — needs fetching); Phase 5 |
| `/collection`, `/collection/[id]`, `/collection/mint` | C | By-design keep (LivingCard system) — adopt `--cc-*` tokens only (brief #5 note) |
| `/c/[serial]`, `/c/[serial]/claim`, `/c/about` | A- | Theme-independent dark-premium by design (CONVERSION-PLAN §4.15) — no work |

### Funnel / challenge / checkout (public)

| Route | Grade | Issue |
|---|---|---|
| `/free-class` + 8 sub-steps | C | NEW canvas **Funnel** (brief #8 — needs fetching); Phase 5 |
| `/challenge/*` (8 routes) | C | 5-Day Challenge + Challenge Days canvases exist locally; ⛔ freeze window (owner decision #2 in CONVERSION-PLAN) |
| `/checkout/club`, `/checkout/vip`, `/club/welcome` | C | NEW canvas **Checkout** (brief #9 — needs fetching) |
| `/club` (push bridge) | C | Redirect only; fine |
| `/club/preview` | D | Dev harness — kill-list §3 D6 |

### Utility / system

| Route | Grade | Issue |
|---|---|---|
| `/settings` | C | NEW canvas **Help+Settings** (brief #13 — needs fetching) |
| `/help` | C | Same brief |
| `/referrals` | C | Pattern-adoption |
| `/picks`, `/picks/[id]` | D | Retired-product stubs; `/picks/loading.tsx:22` shows a **user-visible** "Team Picks has moved" card — §3 D6 |
| `/dev/lesson-audio` | D | Dev workbench in route tree (prod 404) — §3 D6 |
| `/admin/*` (~23 routes) | C | Admin brief #14, converts last; FIC-named surfaces flagged in §3 D7 |

**Canvas fetch status: NONE of the 7 new canvases are local.** `.planning/design-project-v2/` holds only the original 9 .dc.html files + Live+Leaderboard notes. Needs fetching from the design project before Phase 5: Onboarding · Newsroom(+Simulator) · FTA Hub+Shop · Funnel+Checkout · Family Nights · Help+Settings+Admin · Leaderboard-list (if generated beyond the R1/R2 notes).

---

## §2 The B-list — every leak, with fix notes

### B1. Global chrome (every converted page inherits these)
| Leak | Location | Fix |
|---|---|---|
| Challenge banner, v1 gold/midnight (`border-gold-400/40`, `font-display text-gold-700`, `text-midnight-*`) | `src/components/dashboard/DashboardShell.tsx:251-269` | Flag-gate; build `--cc-orange` v2 banner variant |
| clubLapsed/FTA banner, same v1 chrome | `DashboardShell.tsx:270-289` | Same |
| CommandSearch trigger + modal: `rounded-full border-sand bg-paper`, modal `bg-card`/`--accent-solid`/`bg-kai-blue` | `src/components/dashboard/v2/TopBarV2.tsx:92` → `src/components/search/CommandSearch.tsx:231+` | CommandSearchV2 skin (`--cc-card`/`--cc-line`, mono kicker results) |
| NotificationsBell: badge `bg-gold-500 text-night-950 font-display`, dropdown `bg-midnight-900 border-midnight-700`, unread `bg-gold-400/10` | `TopBarV2.tsx:97` → `src/components/notifications/NotificationsBell.tsx` | NotificationsBellV2 (bell = board 01's badge pattern) |

### B2. Loading skeletons — 9 files, zero flag-aware (the single most frequent v1 flash)
| Files | What flashes | Fix |
|---|---|---|
| `live-sessions/loading.tsx`, `leaderboard/loading.tsx`, `belts/loading.tsx`, `progress/loading.tsx` | v1 `club-b-card` board skeletons | One shared `SkeletonV2` on `--cc-card` footprints; branch on `designV2Enabled()` |
| `dashboard/loading.tsx`, `research/[ticker]/loading.tsx`, `community/loading.tsx`, `circles/loading.tsx`, `upgrade/loading.tsx` | v1 `DashboardSkeleton` (`border-sand bg-paper`) | Make `src/components/skeletons/DashboardSkeleton.tsx` flag-aware (single edit covers all five) |
| Related | `DesignManager.tsx:16-24` one-frame flash | Move `data-design` stamp to a root-layout inline script (pre-hydration), per CONVERSION-PLAN Phase 1 note |

### B3. Home (`ClubHomeBoard`)
| Leak | Location | Fix |
|---|---|---|
| v1 ChallengeSlot (`font-display`, `gold-700`) | `src/components/clubhome/v2/ClubHomeBoard.tsx:1024` → `clubhome/ChallengeSlot.tsx` | ChallengeSlotV2 (countdown chip + mono kicker) |
| v1 LiveNowStrip (`border-red-500/20`, `via-volt-500/10`) | `ClubHomeBoard.tsx:1026` → `src/components/live/LiveEventCard.tsx:456-499` | v2 ON-AIR strip per L1 hero spec (orange halo, cc-ping) — red violates design law #3 |
| Kid/teen registers fall to v1 board | `ClubHomeV2.tsx:224` (adult-only branch), v1 board `:238-299` | Kid/teen ClubHomeBoard variants (Phase 4 family register) or scope flag messaging |

### B4. Discover
| Leak | Location | Fix |
|---|---|---|
| v1 ScreenerSurface embedded whole (~25 `text-ink`/41 `text-soft`, `gold-*`, `border-sand`, `font-display`) | `DiscoverClientV2.tsx:781` (`<ScreenerSurface embedded />`) | ScreenerSurfaceV2 (board 15: filter chips, mono result rows, club-signal sort) — **also fixes standalone `/screener`**, one build kills two surfaces |

### B5. Research (`ResearchClientV2` — highest leak density)
| Leak | Location | Fix |
|---|---|---|
| PriceTechnicals (`volt-500`, `font-display`) | `ResearchClientV2.tsx:1588` | TechnicalsV2 body per board 12 (gauge, indicator readouts, level ladder) |
| Fundamentals (`volt-500`, `gold-700`, `midnight-200`) | `:1642` | FundamentalsV2 per board 13 (grade badge, revenue bars, peer comps) |
| KaiReportSection (`border-sand`, `midnight-200`) | `:1844` | KaiReportV2 per board 14 (verdict ring, evidence cards, falsification list) |
| TickerDebate (`volt-*`, `bg-paper`) | `:1467` | Fold into raw-sentiment module (board 03 "where the club stands") — see §3 D2 debate-legacy note |
| ChangedMyMind v1 component | `:771` | Re-use ChangedMyMindV2 card language |
| ResearchObjectCompose/Card (`gold-*`, `volt-500`) | `:1439`, `:1450` | v2 thesis-card (research-object language per CONVERSION-PLAN §2 pattern tier) |
| UpsellCard (`club-b-card`, `club-b-orb`) | `:1646`, `:1791` | LockedStateV2 (Gated ≠ hidden, spec §6.4) |
| Gated/ContextualWall + news KindChip | `:1438`, news rows | Same LockedStateV2 + mono kind chips |

### B6. Community
| Leak | Location | Fix |
|---|---|---|
| ClubDiscussions whole (v1 `volt-*`, `gold-700`) | `ClubModeShellV2.tsx:230` | Blocked on §3 D1 IA decision (what happens to Discussions) — don't re-skin what may die |
| ClubRooms (Lounge) whole | `:243` | Same — IA decision first |
| ClubLiveTab whole (heavy `volt-500`, `gold-*`, `border-sand`) | `:247` | Converge with LiveSessionsSurfaceV2 (one LIVE surface, board 04/05 + L1) |
| AnnouncementCard v1 (`gold-600/700/800`, `font-display`) inside v2 feed | `CommunityClientV2.tsx:849` (pinned), `:1122` (in-feed) | AnnouncementCardV2 (system-post card, orange kicker) |

### B7. Splash + Upgrade
| Leak | Location | Fix |
|---|---|---|
| Splash renders on user-theme ground | `src/app/page.tsx` v2 branch / SplashV2 | Force dark full-bleed per board 09 regardless of `data-theme` |
| Upgrade long-form FTA narrative unconverted (compact paywall only) | `upgrade/page.tsx:336` → UpgradeV2 | v2 pass on the FTA pitch (gold lane, brief #6 register) |

---

## §3 The D-list — conflation / legacy-stacking findings

**D0. The meta-problem: four UI generations coexist in one tree.**
(1) v1 warm-sand/gold/volt system (the bulk), (2) the **19 `*V2.tsx` twin files** behind the flag, (3) the standalone `/cc` app-shell experiment (`src/app/cc/layout.tsx` + `cc.css` + `/cc/gallery` — Phase 0 foundation, now redundant with `src/components/cc/`), (4) orphaned pre-v2 components (below). Every finished conversion phase must end with **v1 twin deletion**, or the tree keeps stacking. **Recommendation:** add a "flag-removal endgame" phase to CONVERSION-PLAN — when a route's v2 is owner-approved, its v1 twin is deleted in the same PR, not kept as fallback. `/cc/gallery` stays (dev-only canon reference); `src/app/cc/layout.tsx`'s separate shell should collapse into the gallery. *Not an owner decision — engineering discipline.*

**D1. Community: four modes + two sibling routes = three generations of "the Club".**
Code has FEED · DISCUSSIONS · LOUNGE · LIVE (`ClubModeShell.tsx:115-119`), plus `/circles` as a separate route, plus `/community/changed-my-mind` as a standalone route. The canvas (board 04) has exactly **FEED · CIRCLES · LIVE**. Another lane is already consolidating to FEED+CIRCLES. Remaining open questions (all **owner decisions**):
- **Lounge**: canvas has no Lounge. Options: (a) becomes a permanent room under the LIVE tab, (b) dies — its topic rooms (`rooms.ts`, incl. the retired-"Options desk"-turned-"Main Circle" tile and `FREE_LOUNGE_ROOM_ID`) migrate to Circles-with-no-expiry or die with it. Recommend (b): Circles are the canvas's room model; a parallel non-expiring room system is exactly the stacking the owner is complaining about.
- **Discussions**: no canvas analog. Its threads are feed posts with a different chrome. Recommend: merge into FEED (post-type filter), delete `ClubDiscussions.tsx`.
- **`/community/changed-my-mind` standalone route**: canvas treats CMM as a feed post type + counters, not a destination. Recommend: keep the route as a filtered feed view (deep-linkable), drop it from nav; the CMM chip in the v2 feed already covers discovery.
- **Debate system**: `api/club/debate/*`, `lib/social/ticker-debate.ts`, `components/social/TickerDebate.tsx`, `StanceControl.tsx` — an older stance-generation mechanic that predates stances/CMM. The canvas has no debates; the raw/weighted sentiment module covers it. Recommend: retire the debate UI from research (leak B5) and feed; keep tables until data migration. **Owner decision** (feature removal).

**D2. Watch: three watchlists + three Kai Watch mounts vs the canvas's ONE Watch hub.**
Current: `/watchlist` (1,975-line personal client w/ embedded KaiWatch at `:1464`), `/watchlist/community` (1,137-line communal board), `/family/watchlist` (152-line separate canvas kit), `/alerts` (retitled "Kai Watch", mounts the same KaiWatch component at `AlertsClient.tsx:1349`), plus a third Kai Watch entry in research ("Set Kai Watch", `ResearchClientV2.tsx:1697`). The canvas (boards 06/17/18/19) puts **OVERVIEW · WATCHLIST · KAI WATCH · ALERTS under one Watch tab**. Recommendation:
- Build the Watch hub as one route (`/watchlist` becomes the shell; `/alerts` and `/watchlist/community` become sub-tabs; old URLs 301 into sub-tab deep links). Community Board maps to board 17's picks pattern (WATCHLIST sub-tab section), Kai Watch inventory = KAI WATCH sub-tab, C6 briefing = ALERTS sub-tab, setup detail stays `/alerts/e/[id]` → board 19.
- "Set Kai Watch" from research/watchlist rows stays (correct per board 14) — the *inventory* just gets one home.
- `/family/watchlist` stays separate by design (F6 family register) — not conflation.
- **Owner decision:** which URL wins as the hub (`/watchlist` vs `/watch`), and whether Alerts keeps a nav row during transition.

**D3. Alerts naming half-migrated.** `/alerts` page title is already "Kai Watch" (`alerts/page.tsx:40`, `alerts/loading.tsx:13` "Loading Kai Watch…") while the sidebar row still says "Alerts" (`DashboardSidebar.tsx:205`) and the canvas calls the sub-tab ALERTS with Kai Watch as a *sibling* tab. One feature, three names in flight. Fix inside D2's hub build: ALERTS = the daily briefing (board 18), KAI WATCH = setups inventory (board 06) — matching the canvas vocabulary exactly.

**D4. Learn/Practice: three lesson engines + duplicated chart surfaces.**
- Lesson engines: course lessons (`LessonEngine` — with a legacy video/html/iframe/mock fallback at `LessonViewerClient.tsx:78,529`), simulator scenario lessons (`/simulator/lessons/[scenarioId]`), and the `dev/lesson-audio` harness. Canvas has ONE learn system (boards 08/20/21) + a scored-scenario player in the Simulator brief. Recommend: course lessons = boards 20/21; sim scenarios stay but as the Simulator canvas's scenario player (distinct by design); kill the legacy lesson fallback path once content is migrated (**owner decision**: is any live lesson still on the legacy renderer?).
- `/chart` vs `/simulator` vs `components/fic/TradingView*` widgets: three chart stacks. Canvas standard = lightweight-charts + board 12 chrome + board 19 zone layer. Recommend: `/chart` folds into the Simulator suite (practice tab) or becomes a push-in from research; TradingView embeds in `components/fic/` retired. **Owner decision** (route removal).
- `/games` (candle-battle, trend-or-trap) overlap simulator scenarios conceptually — keep both (different loops), but they convert under one "Practice" umbrella in the Simulator canvas so Learn's nav shows one door, not four.

**D5. Persona homes diverging + a dead v1 home generation.**
`/dashboard` fans out: club→ClubHomeV2, free→FreeHome (v1), family/kid/teen→DashboardHomeClient (v1, FIC-heavy). Meanwhile a whole **orphaned v1 clubhome part-set has ZERO importers** (grep-confirmed): `src/components/dashboard/ClubHome.tsx`, `src/components/clubhome/ClubSplit.tsx`, `ClubRoom.tsx`, `TopInTheClub.tsx`, `YourSignals.tsx`, `TodayOneThing.tsx`, `TodayIn30.tsx`, `IndexChips.tsx`, `HomeMasthead.tsx` (+`YouStrip.tsx` one lingering ref). **Delete-now list — zero risk, pure tree hygiene.** Free/family/kid homes convert in Phases 4/5; until then they're honest C-grade, not leaks — but the kid/teen fall-through inside ClubHomeV2 itself (B3) should not wait for Phase 4.

**D6. Retired-product stubs and dev routes still user-reachable.**
- `/picks` + `/picks/[id]` redirect stubs are fine, but **`/picks/loading.tsx:22` renders a visible "Team Picks has moved" card** — a past-product tombstone shown to users. Kill the loading file (redirects don't need skeletons).
- `src/app/(admin)/admin/announcements/page.tsx:34` still offers **"Team Picks" (`/picks`) as an announcement link target** — admins can broadcast links to a retired product. Remove.
- `/parent-corner` redirect is still the *primary* link target in five live components (`ThisWeekPanel.tsx:254`, `onboarding-profile.ts:304`, `UpsellCard.tsx:203`, `DashboardTopBar.tsx:69`, `DashboardShell.tsx:80`) while the sidebar links `/family/corner` directly — unify all links to `/family/corner`, keep the redirect for old bookmarks only.
- `/club/preview` (dev harness, prod-404) and `/dev/lesson-audio` (dev workbench, prod-404): move behind the same dev-only convention as `/cc/gallery` or delete; they are route-tree cruft.
- Repo-root scratch files ship in the tree: `_probe.mjs`, `_probe2.mjs`, `_probe3.mjs`, `_shot.mjs`, `_shoot-spec.mjs`, `scratch-play2.mjs`, `vfy.mjs` — delete.

**D7. Brand register — where "FIC"/legacy naming leaks.**
The unified model (`src/lib/mode.ts:82-86`: FIC = family-mode wordmark inside Cheat Code Club) is *correct by owner decision*, and the solo/family fork in `DashboardHomeClient.tsx:802` + `ThisWeekPanel.tsx:116` ("This Week in the Club" vs "This Week in FIC") works. Remaining leaks:
- **Mixed email identity:** `src/lib/server/drips.ts:23` + `marketing.ts:135` send as `Cheat Code Club <hello@familyinvestingclub.com>` — CCC name on FIC domain (blocked on cheatcode.com DNS, a standing owner blocker; note in doc, can't fix in code).
- Admin FIC-named consoles (`/admin/fic-weeks` "This Week in FIC" h1, `AdminSidebar.tsx:71`, `admin/community/page.tsx:12,113` hardcoded "FIC Club"/"FTA Traders" rooms) — admin-only, cosmetic, rename in the Admin brief pass.
- `signup/page.tsx:9` redirects signup to familyinvestingclub.com — **owner decision**: where does club-mode signup live once cheatcode.com DNS moves (`checkout-sessions.ts:45` already has the TODO).
- The upgrade page itself documents the past two-name confusion (`upgrade/page.tsx:319-325`) — the fix is shipped; keep the comment.
- No "C◇C" logo component exists (grep-clean); `ClubMark.tsx` infinity mark is the single mark. No "Cheat Code OS"/"tradewithk" strings. Clean.

**D8. Two adjacent product generations grafted into the dashboard.**
- **Challenge/VIP** (`/challenge/*`, `/vip-room`, DashboardShell challenge banner): live and armed for Sept 1 — NOT removable; convert per canvases **after Sept 6** (owner decision #2 already logged in CONVERSION-PLAN §5). The only pre-freeze work allowed: the shell banner v2 re-skin (B1) since it renders inside converted chrome today.
- **Ownership Cards** (`/collection/*`, `/c/*`): keep by design; token-adoption only (brief #5). Not conflation — but its `volt` accents must map to orange in club mode during Phase 0 token adoption.

**D9. Nav IA is itself a v1 remnant** — 15+ sidebar destinations vs the canvas's 5-tab IA. See §4.

---

## §4 Proposed v2 nav / IA — the 5-bucket mapping

Current solo-club sidebar (from `DashboardSidebar.getNavItems`): Home · Discover · Club(+Feed/CMM/Circles) · Watchlist(+Community Board/My Watchlist) · **Learn** [Start Here/Courses/Live Classes/Flashcards + Practice: Chart/Simulator/Games] · **Markets** [Collection/Screener/News/Alerts] · **Account** [Leaderboard/Belts/My Progress/Refer] · FTA section · footer [Shop/Help/Settings/Admin]. Canvas IA: **Home · Discover · Club · Watch · You** (board 01), sub-tabs inside, Kai = FAB.

| Current item | v2 bucket | How | Owner decision? |
|---|---|---|---|
| Home | **HOME** | Board 01 (ranking rail, briefing, signals inbox, XP card) | — |
| Discover | **DISCOVER** | Board 02: FOR YOU · SCREENER · TRENDING sub-tabs | — |
| Screener (standalone) | **DISCOVER › SCREENER** | Route 301s into the sub-tab; nav row dies | — |
| News | **DISCOVER (newsroom foot)** | Board 02 puts the newsroom inside Discover; `/news` stays as push-in article hub, leaves top-level nav | ⚠️ YES — News loses its top-level door (kids currently reach it via nav) |
| Club/Community (+CMM) | **CLUB** | FEED · CIRCLES · LIVE (board 04); CMM = feed filter, not nav | Lounge/Discussions fate = D1 decisions |
| Circles | **CLUB › CIRCLES** | Route survives as deep link | — |
| Live Sessions / Live Classes | **CLUB › LIVE** | L1 schedule + L2 replays; leaves the Learn group | — |
| Watchlist (My + Community Board) | **WATCH** | Board 06 OVERVIEW · WATCHLIST · KAI WATCH · ALERTS; Community Board = board-17 picks section | Hub URL choice (D2) |
| Alerts | **WATCH › ALERTS** | C6 briefing = board 18; nav row dies | — |
| Kai Watch (currently inside /alerts + /watchlist) | **WATCH › KAI WATCH** | One inventory home | — |
| Ask Kai | **FAB** (already) | `/kai` = FAB full-screen; kid nav row stays (kids have no FAB) | — |
| My Progress / Belts / Leaderboard | **YOU** | Board 07 profile; Belts (board 22) + Ladder (R1) as push-ins from the YOU rank module + Home rail | ⚠️ YES — Leaderboard could argue for CLUB; canvas reaches it from Home/You, recommend YOU |
| Learn (Courses/Start Here/Flashcards) | **YOU › LEARN** entry (+ Home "continue" card) | Board 08 note: Learn is NOT in the 5-tab bar on the club canvas; teens/kids keep Learn in a primary slot (persona variant preserved) | ⚠️ YES — where the adult Learn door lives (You vs Home card); teen/kid slots unchanged |
| Practice (Chart/Simulator/Games) | **YOU › LEARN › PRACTICE** (Simulator suite) | D4 consolidation; `/chart` folds in | ⚠️ YES (route removal) |
| Collection | **YOU › COLLECTION** (push-in) | Canvas has no Collection tab; shelf reached from You | ⚠️ YES |
| Refer a friend | **YOU** row | — | — |
| Kid Missions | **kid slot 4** (persona variant, unchanged) | Per inventory persona schemes | — |
| Family | **parent slot 4** (persona variant, unchanged) | F1-F9 | — |
| FTA section | **sidebar tail, gold, unchanged** (desktop); mobile = YOU row | Hard-split identity survives by standing rule | ⚠️ YES (mobile placement) |
| Shop / Help / Settings / Admin | **footer** (desktop) / **YOU** rows (mobile); Settings gear also on YOU header (board 07) | — | — |

Net: 15+ top-level destinations → **5 tabs + persona slot variants**, every route still reachable (link-graph preserved, only nav placement changes). SidebarV2/MobileTabBarV2 already render the v2 *style* — this is the content change that makes them render the v2 *IA*.

---

## §5 Prioritized cleanup sequence — max v1-kill per unit work

1. **Skeleton + flash pass (hours, kills the most-seen leak).** Make `DashboardSkeleton` flag-aware (1 file → fixes 5 routes), rebuild the 4 `club-b-card` loading files, move `data-design` stamping to a root-layout inline script (kills the one-frame flash). Also delete `/picks/loading.tsx` (tombstone).
2. **Global chrome pass (1 lane).** CommandSearchV2 + NotificationsBellV2 + the two DashboardShell banners → after this, the frame around EVERY converted route is 100% canvas.
3. **Dead-code deletion (hours, zero risk).** The 9 orphaned clubhome v1 components (D5), root probe files, announcements "Team Picks" target, `/parent-corner` link unification. Pure tree hygiene, no design review needed.
4. **ScreenerSurfaceV2 (1 lane, kills 2 surfaces).** Fixes the Discover tab leak AND converts standalone `/screener` in one build.
5. **Research tab bodies (1 lane, biggest single B).** TechnicalsV2 / FundamentalsV2 / KaiReportV2 / LockedStateV2 / thesis card; retire TickerDebate from the tab per D1 (pending owner call on debates).
6. **Home completeness.** ChallengeSlotV2 + LiveNowStrip v2 (red→orange per design law) + kid/teen board variants.
7. **Community interiors — AFTER the FEED+CIRCLES lane lands.** AnnouncementCardV2 now (safe); Discussions/Lounge/Live interiors only after the D1 owner decisions, so nothing gets re-skinned twice or re-skinned then deleted.
8. **Watch hub consolidation (D2/D3)** — the biggest IA win: one build replaces three nav destinations with the canvas's Watch tab and converts `/watchlist`, `/watchlist/community`, `/alerts` together (Phase 3 as planned, but sequenced as one hub, not three routes).
9. **Nav IA switch (§4)** — flip SidebarV2/MobileTabBarV2 content to the 5-bucket map once Watch hub exists (the only bucket that doesn't exist yet as a single destination).
10. **Fetch the 7 new canvases** from the design project (none are local) → Phases 4/5 conversions: family, funnel, checkout, shop, FTA, news/simulator, help/settings/admin, onboarding. Challenge surfaces frozen until after Sept 6 (owner decision #2).
11. **Flag-removal endgame (D0).** Per-route v1 twin deletion as each conversion is approved; collapse `src/app/cc/` shell into the gallery; final state = zero `*V2` suffixes, one design system, flag deleted.

### Owner-decision register (from this audit)
1. Lounge fate (kill vs LIVE-tab room) — D1
2. Discussions merge into FEED — D1
3. CMM standalone route → feed filter — D1
4. Retire the debates system — D1/B5
5. Watch hub URL + transition nav — D2
6. `/chart` route removal into Simulator suite — D4
7. Legacy lesson-renderer retirement (any live content on it?) — D4
8. News loses top-level nav (kid access path) — §4
9. Adult Learn door placement (You vs Home) — §4
10. Leaderboard bucket (You vs Club) — §4
11. Collection placement (You push-in) — §4
12. FTA mobile placement — §4
13. Club-mode signup home once cheatcode.com DNS lands — D7
