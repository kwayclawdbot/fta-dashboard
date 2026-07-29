# Cheat Code UI convergence plan

## Scope and evidence

This plan covers the staged convergence of the live Next.js product with `FTA Club Dashboard Mockup.zip`. The archive was inspected in full: 26 HTML documents, `support.js`, seven supplied image assets, all `.dc.html` canvases, all standalone bundles, and all six named source exports. The source exports are the structural authority; screenshots/assets are visual evidence; standalone files are presentation-only bundles. The archive contains roughly 101 artboards and no production data or behavior.

PR 1 is foundations only. Existing Supabase reads/writes, RLS, Stripe, entitlements, XP, belts, alerts, Kai, simulator, learning, Family and FTA behavior remain unchanged.

## Route inventory and reference mapping

| Product area | Current route(s) | Major current composition | Data source | Reference | Decision |
| --- | --- | --- | --- | --- | --- |
| Home | `/dashboard` | `ClubHomeV2`, `TopInTheClub`, `TodayIn30`, `YourSignals` | `club/home-payload`, `club/today`, Supabase | App 01; dark/light source exports | Modify in PR 2; preserve server streaming |
| Discover | `/discover`, `/screener` | `DiscoverClient`, `discover/board`, `ScreenerSurface` | cached news, community board, `getDiscoverExtras` | App 02/15 | Modify in PR 2; keep kid gate |
| Ticker hub | `/research/[ticker]` | `ResearchClient`, research board/tabs/thread | market aggregate, Polygon, Supabase, Kai reports | App 03/12/13/14 | Replace composition in PR 2; keep meter/data loaders |
| Club | `/community`, `/community/changed-my-mind`, `/community/compose` | `ClubModeShell`, feed seed, community boards | Supabase feed/chat/reactions | Club 01–05; App 04 | Modify in PR 3 |
| Circles | `/circles`, `/circles/[slug]` | `CirclesSurface`, `CircleRoom` | migration 190 / Supabase | App 16; temporary-circle concepts | Modify in PR 3; retain lifecycle truth |
| Live | `/live-sessions`, community Live | schedule/RSVP surface, Zoom handoff | Supabase sessions/RSVPs | Club 07/08; Live + Leaderboard | Modify in PR 3; stage only where behavior exists |
| Watch | `/watchlist`, `/alerts` | watchlist canvas, `WatchRail`, `KaiWatch`, alert boards | Supabase watchlist, alerts engine, market data | App 06/17/18/19 | Modify in PR 4; retain free-tier meter |
| You/profile | `/u/[username]`, `/progress`, `/belts`, `/leaderboard` | public profile, `ProfileSurface`, belt ladder | minimized profile RPC, XP/belts | Club 09; App 07/22 | Modify in PR 4; preserve minor minimization |
| Learn | `/courses`, `/courses/[slug]/**`, `/missions` | `LearnSurface`, lesson engine | Supabase courses/progress, lesson schema | App 08/20/21; challenge-days export | Modify in PR 5; preserve resume/narration |
| Family | `/family/**`, `/parent-corner` | family canvas/rails/guardrails | Supabase family/profile permissions | Family and Family Nights exports | Modify in PR 6; preserve role gates |
| Challenge | `/challenge/**`, `/free-class/challenge` | mission components, Brief/Do/Share | challenge sequence/cohort/XP | 5-Day, Days, Family Challenge exports | Modify in PR 7; preserve artifacts/idempotency |
| Onboarding | `/onboarding/**`, `/start-here` | wizard/profile/first-run | Supabase profile/referral | Onboarding canvas | Modify in PR 7; logic work for 90-second opinion flow |
| FTA | `/fta/**`, `/picks/**`, `/vip-room` | FTA header/chat/courses/recordings | tier gates, Supabase | FTA Hub + Shop | Modify in PR 8; same shell/mode |
| News | `/news/**` | `NewsClient`, `NewsCard` | published Supabase feed | Newsroom + Simulator | Modify in PR 8 |
| Simulator | `/simulator/**` | chart/order/portfolio/lesson bridge | local engine + Supabase persistence | Newsroom + Simulator | Modify in PR 8; preserve practice engine |
| Commerce | `/shop/**`, `/pricing`, `/upgrade`, `/checkout/**` | shop browser, Stripe checkout | Supabase catalog, Stripe | Hub + Shop; Funnel + Checkout | Modify in PR 8; no invented scarcity |
| Utility/admin | `/help`, `/settings`, `/admin/**` | settings/help/admin shells | Supabase and server actions | Help + Settings + Admin | Modify in PR 8; prioritize operational clarity |

Routes not explicitly named above remain supported; no route is removed or renamed in PR 1. User-facing naming is standardized around Home, Discover, Club, Watch, You, Learn, Live, Family, FTA, Simulator, News, Shop, Settings.

## Canonical component plan

The shared vocabulary lives in `src/components/collective`. It is object-specific rather than a generic card abstraction. The five highest-reuse components are:

1. `ClubRankRail` / `TickerRankItem` — Home, Discover, ticker, Watch, News.
2. `CollectiveSignal` — ticker, Circles, Discover, posts, onboarding.
3. `OpinionObject` / `ChangedMyMindObject` — ticker, Club, profile, Circles.
4. `MemberReputationIdentity` — every social, live and profile context.
5. `KaiAnnotation` / `KaiWatchStateObject` — contextual Kai insight without a generic chat panel.

Also defined: `TickerQuickSheet`, `CircleObject`, `SignalRow`, `LiveStage`, `FamilyProgressPath`, `XpAwardMoment`, and `BeltProgressObject`. These are deliberately flexible silhouettes with typed semantic props.

## Token and brand plan

- Keep `data-theme="light|dark"` and `data-mode="club|family|fta"` as the two axes.
- Light warm paper is canonical; dark translates the same hierarchy onto warm charcoal.
- New work uses `action`, `surface`, `surface-raised`, `ink`, `soft`, `border`, `price-up/down`, `stance-*`, `kai`, `rank`, `fta-metal`, and `family-progress` semantics.
- Historical `gold-*` mode remapping remains a migration bridge only.
- Sora is display, Inter is UI/body, IBM Plex Mono is market/system data.
- Kaushan/Caveat are removed from the global product runtime. Campaign art may own one-off lettering locally.
- The canonical mark is one orange circular signal button with a centered diamond. The former infinity/two-loop mark is retired.
- Club umbrella copy uses “Collective minds become the signal.” Family-only positioning stays within Family Mode.

## Design-system conflicts found

- A partial convergence system already exists, but several board-specific helpers duplicate grammar concepts.
- Historical `gold-*` utilities produce orange in Club mode and create semantic debt.
- The prior infinity mark contradicts the supplied single-button diamond direction.
- Script/marker fonts were globally loaded and used for ordinary route mastheads.
- Many surfaces still use card-first containment, multiple competing pill rails, and board-local primitives.
- Green is occasionally overloaded beyond price; touched routes must separate price and stance semantics.
- Route vocabulary still overlaps (`Watch`/watchlist/Kai Watch; Club/community); navigation changes require a dedicated audited pass.

## Data and logic gaps

Visual-only in PR 1: tokens, typography, logo, shared primitive contracts, copy, documentation. Later visual-only work can reuse current rank, watch, news, session, XP and profile payloads.

Product logic/data required later:

- reputation-weighted opinion aggregation distinct from raw sentiment;
- calibrated Opinion Score, category expertise and persisted opinion weight;
- opinion timeline event joins across earnings/news/price/Circle events;
- measured “moved the Collective” attribution;
- Circle activity diameter, lifespan state and archive summary;
- reliable live-room presence/reactions where sessions currently hand off to Zoom;
- structured opinion fields for conviction, horizon and invalidation;
- attention acceleration and quiet-to-loud baselines;
- member influence/top-voice ordering that is not follower-based.

These must be implemented with migrations/RPCs and permission review in their owning PRs; no production mock data should stand in for them.

## Motion plan

Use the existing Framer Motion wrapper and reduced-motion policy. Animate only state: rank reorder, signal redistribution, opinion transitions, Circle life, Kai Watch state, XP count, belt progression, quick-sheet rise, and challenge completion. Prefer transform/opacity; never delay task completion.

## Testing and screenshots

Every PR runs `npm ci`, lint, build, grade/watch/setup tests, status/import/case checks, and any new domain tests. Route work adds tests for the affected permissions and state machines. Screenshot matrix: 390×844 and 1440×1000 light/dark for changed Club routes; Family mobile/desktop light; FTA canonical theme plus mobile where member-facing. Use seeded/fixture data and record unavailable authenticated states honestly.

## Staged PR plan

1. Foundations: this document, semantic tokens, typography/brand cleanup, canonical objects, parity validation and migration note.
2. Core Club Loop: Home, Discover, ticker hub/quick sheet, signals/opinions/top voices.
3. Community: varied feed objects, Circles, Live and cashtag UI.
4. Watch and Identity: Watch/Kai Watch, alerts, profile/reputation, XP/belts.
5. Learning: path-first home, spoken/visual lessons, resume and challenge integration.
6. Family: household home, shared progress/watchlist, guardrails, Family Circle/digest.
7. Challenge and Onboarding: 90-second first opinion; Day 1–5 Brief/Do/Share and artifacts.
8. FTA and secondary: FTA, Newsroom, Simulator, commerce, Help, Settings and Admin.

## Risks and open questions

- The archive named in the brief says “Mockup 2,” while the supplied local file is `FTA Club Dashboard Mockup.zip`; its contents match every named source reference and were used as the authority.
- Authenticated screenshot fixtures need a supported local seed/login path or reviewer credentials.
- Decide whether `/research/[ticker]` remains the public user-facing URL while its label becomes “Ticker,” or receives a non-breaking alias.
- Confirm the exact weighting formula, calibration window, expertise taxonomy and compliance language before PR 2.
- Confirm whether live rooms will remain Zoom handoffs or gain native presence before implementing `LiveStage` behavior.
- Confirm Circle default lifespan and archival retention before PR 3.

## Migration note for later routes

New or touched route code should import canonical objects from `@/components/collective`, use semantic color names, and avoid new board-local generic cards. Existing legacy utilities may remain until their owning staged PR. Do not mechanically rewrite untouched routes or business logic.
