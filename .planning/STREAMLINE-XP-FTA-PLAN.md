# Streamline + XP Belts + FTA Section — Master Plan (2026-07-23)

Owner directives (2026-07-23 session): execute the full 21-item declutter audit, make XP/levels an always-visible belt system, rebuild leaderboards (family AND individual, weekly/monthly/all-time), and create clear FIC vs FTA separation in nav + pages, with FTA getting its own Discord-vibe chat, course library, and live-class recordings under one umbrella.

Execution: 3 sequential Opus lanes (they share nav/community files — never parallel). Lane order matters: declutter first (clears the ground), then XP/leaderboards, then FTA section.
Coordination: community-watchlist lane (COMMUNITY-WATCHLIST-PLAN.md) must land FIRST. Audit items 12 & 16 touch watchlist surfaces — sequenced into Lane 1 only after it ships.

---

## LANE 1 — DECLUTTER (audit-driven; all items owner-approved)

Community page:
1. Remove ThisWeekSnapshot from right rail; collapse feed AnchorCard to a one-line pinned strip ("This Week: {class_title} → Open" linking /dashboard?tab=this-week).
2. Chat: rename "Live Rooms" → "Club Chat" everywhere; convert to a collapsible drawer component available on BOTH /community and /chart (shared instance pattern, me/tier props supplied by each page; chart needs profile+tier fetch + drawer affordance; realtime policies untouched). FTA Traders room moves OUT to Lane 3's FTA chat page; Club Chat drawer = FIC Club + Free Lounge rooms only.
3. Remove HouseRulesLink from rail (rules live on Home kid card + /help).
4. Delete the community right-rail aside entirely → full-width feed.
5. NotificationOnboard: remove /community from INTENT_ROUTES auto-fire.

Removals/merges:
6. Delete orphan /simulator/leaderboard (also drop TopBar title-map row). Superseded by Lane 2 leaderboards.
7. /family → redirect to /family/overview (repoint the 3 router.replace("/family") guards); delete old roster page.
8. Remove duplicate orientation-deck card on start-here (checklist step keeps it).
9. TopBar menu: merge Profile+Settings rows → one Settings row.
10. BadgeCase shelf: remove from /settings and /family/members (keep /progress + /u/[username]).
11. Settings: "Danger Zone" → "Account"; fold replay-tour link into adjacent section.
12. Pattern Practice: /simulator/lessons becomes a tab inside /simulator ("Trading Floor" | "Pattern Practice"); remove its card from Games hub (Games = arcade only); update 2 dashboard card links.
13. Fold walkthrough video on start-here into its checklist step (no hero embed).
14. Referrals: demote to compact card on /family/overview + keep route; sidebar item renamed to disambiguate from Members invite.
15. Home: demote ClubActivityStrip below family strip, cap 2 rows; academy "This Week" rail renamed ("Your live class + drills" style) so only FIC tab owns "This Week".
16. Parent Corner + Home parent strip: shrink to compact rows + "Full overview →" (Family Overview = authoritative per-child view). NOTE: touches family_watchlist reads — reconcile with shipped community-watchlist schema.
17. Progress: single link target for the two watchlist tiles (merge into one tile); leave course bars (revisit later).
18. Live Classes: track filter hidden unless tab has >6 sessions.
19. Theme unification: convert hardcoded "midnight" pages (/family/*, /settings, sim leaderboard if any survive) to standard token palette (paper/ink/sand/card vars — works in both light/dark). No new palettes.

## LANE 2 — XP BELTS + LEADERBOARDS

Belt system (rebrand existing levels; keep xp thresholds in src/lib/xp.ts, map level→belt):
- Ladder (OWNER-SET 2026-07-23): White → Yellow → Blue → Purple → Black (5 belts). Map existing level thresholds onto the 5 belts with degrees within each belt (e.g. "Blue II") since levels exceed belt count. Black = top tier, hard to reach.
- Always-visible: TopBar belt chip (belt color + XP progress bar to next belt) for self, all viewports (mobile: compact in TopBar or More-sheet header).
- Everyone else's: belt indicator wherever names/avatars appear — subtle belt-colored ring/dot on Avatar.tsx (do NOT add text chips everywhere — we just decluttered); full belt name on hover/profile/leaderboards. Feed authors, comments, chat, leaderboards, family strips, /u/[username].
- Belt-up = existing level-up celebration re-skinned (belt ceremony moment via useCelebrate); belt shown on public profile BadgeCase page.

Leaderboards (replaces the 3 old boards; audit item 10 superseded):
- One /leaderboard feature, two dimensions × three periods: Families | Individuals × Weekly | Monthly | All-time.
- Data: xp_events timestamped sums; family = AVG of member XP (standing owner rule) applied per-window; all-time = existing totals. New SECURITY INVOKER/DEFINER RPCs consistent with family_xp_leaderboard patterns; indexes on xp_events(created_at).
- Individuals board: opt-out not needed (community posture), belts + avatars + kid/teen/adult AgeBadge; kid-vs-kid friendly competition = owner-wanted.
- Family-internal ranking (old /family/leaderboard) folds in as a "My family" filter or stays as slim family tab; sim-return metric optional toggle (from deleted sim board) if cheap.
- Nav: Leaderboard becomes a proper nav item (it was a near-orphan); mobile placement per getNavItems single source.

## LANE 3 — FIC / FTA SEPARATION + FTA HUB

- Nav: hard visual separation — FIC club items (default) vs "FTA — Trading Academy" section (gold/PRO treatment, distinct header, divider). FIC-only families see locked FTA section teaser → /upgrade. Menu + page-level FTA badging (consistent gold accent header strip on FTA pages).
- FTA hub surfaces under the section:
  1. FTA Chat — dedicated page, Discord-vibe (dark-leaning treatment within token system, channel-style layout, member list/presence if cheap, always-on). Reuses chat_messages realtime + FTA Traders room (moved from Club Chat drawer). FTA members only (app-level gating per posture).
  2. Course Library — FTA courses grouped/branded (existing /courses filtered surface or FTA-scoped library view).
  3. Live Class Recordings — recordings-first FTA view (existing live-sessions recordings, FTA-scoped).
- FIC pages stay warm-paper; FTA pages get the premium gold-accent identity. Tier gating unchanged (TIER_ACCESS matrix in src/lib/tier.ts).

## LANE 4 — KAI INTEGRATION (owner directive 2026-07-23; runs after Lane 3)

Two features, one persona: Kai (CheatCode's AI analyst brand) becomes the platform's research engine. Education-first compliance posture everywhere (same as /help bot: educational analysis, REFUSES personalized financial advice, age-aware register — kids use this platform). Uses existing ANTHROPIC_API_KEY (already in Vercel prod).

### 4A. Kai Research Reports
- Deep-dive, image/graphic-rich report per ticker, attached to community-watchlist ticker pages (/research/[ticker] gets a "Kai Research Report" section) and usable as the analysis page for admin picks.
- Generation: admin-triggered from the watchlist admin console ("Generate Kai report" per ticker) → server-side job (claude-sonnet-5, streaming to DB) → structured report stored (kai_reports table: sections JSONB + generated assets refs + model/version + generated_at). Regenerate = new version, history kept.
- Report anatomy (rich, premium): hero (logo, live price header, sector); Business-in-plain-English; The Numbers (Polygon financials/fundamentals + server-rendered SVG charts — revenue/margin bars, 1Y price chart with key-level annotations); Moat & Thesis; Risks (honest, education-first); "Explain it to your kids" section (family pedagogy); discussion questions (feeds FIC weekly rhythm); sources/links footer. Charts = data-driven SVG components from Polygon bars via existing /api/market proxy (no client-side keys), logos via existing branding proxy. Optional Higgsfield hero art behind a flag (off by default — credits).
- Member view: beautiful long-form report page (both themes, mobile), belt-gated nothing — all members read; free tier locked out with existing UpsellCard posture.

### 4B. Ask Kai chat
- /kai (nav: "Ask Kai" with Kai branding) — ChatGPT-style streaming chat, members-only.
- Tool-use loop server-side: get_quote, get_bars (→ Kai embeds an inline interactive chart component in the reply), company_info, ticker_search, polygon news headlines (→ embedded link cards). Messages stream (SSE/edge route); markdown + embedded chart/link blocks render in chat.
- Persistence: kai_chat_threads/kai_chat_messages per user (RLS own-rows), thread list sidebar, new-thread button.
- Cost/rate caps (DEFAULTS — owner can retune): FIC 15 messages/day/member, FTA 60/day; caps enforced server-side, friendly "come back tomorrow / upgrade" state. Model claude-sonnet-5; cap tool rounds per message.
- Compliance guardrails in system prompt: educational research only, no personalized buy/sell advice, no performance promises, age-aware tone (kid accounts get simpler register), never "SuperTrend" (brand rule: CheatCode Trend Clouds) if indicators come up.
- ALSO (optional companion, non-platform): local Claude Code skill `kai-research-report` in the owner's skills dir that runs the same report pipeline from the CLI for owner-run extra-deep dives, publishing via the admin RPC. Build last; skip if time-boxed out.

## LANE 5 — SIMBOT INTEGRATION (owner directive 2026-07-23; after Lane 4)

Source: https://github.com/Andwelecoffie2012/simbot — "SIMBOT" 736KB self-contained HTML trading simulator (synthetic multi-asset engine w/ FVG-physics scenarios, sim clock w/ speed, orders/R-accounting/sizing, EMA/RSI, ~18 price-action lessons, own XP ladder, localStorage). Owner chose FULL integration + reskin + dedupe.

1. Host same-origin under public/sim/ (SI-lesson pattern); new Practice surface "Simbot" (tab alongside Trading Floor | Pattern Practice); iframe + ftaBridge wiring.
2. XP bridge: Simbot internal XP stays internal (its economy balances its own game); award PLATFORM XP on defined milestones only (lesson completions, first profitable R-multiple trade, level-ups) via ftaBridge — amounts consistent with existing lesson/quiz XP so belts/leaderboards aren't inflated. Persistence moves from bare localStorage to per-user key namespacing (or bridge-synced) so shared family devices don't collide.
3. Reskin: token palette (paper/ink/sand/card + gold accents), both themes, typography to platform stack, mobile 390px pass. Keep its chart/engine internals untouched — reskin is CSS/chrome, not engine surgery.
4. Lesson dedupe: its 18 price-action lessons vs teens W2 curriculum — map overlaps; where a Simbot lesson duplicates a platform lesson, the Simbot lesson becomes the INTERACTIVE COMPANION (platform lesson links "Practice this in Simbot" deep-link; Simbot lesson links back to the full lesson). No content deleted from either; cross-linked, not duplicated in nav.
5. LIVE-DATA MODE (phase 1 of feasibility verdict): add "Live Market" mode fed by the existing /api/market proxy (delayed ~15min, honestly labeled) — real tickers, real delayed bars/quotes driving Simbot's chart+order layer; P&L marked on delayed prices; synthetic engine stays for nights/weekends/fast-forward. Replay mode (real historical days from Polygon aggregates) = phase 2 stretch. True real-time websockets = deferred (needs Polygon realtime plan + relay service — owner cost decision).
6. Flag to owner: source repo is PUBLIC GitHub — consider making private if proprietary.

## LANE 6 — STOCK SCREENER (owner directive 2026-07-23; after Lane 5)

Goal: members discover new stock picks in-app; feeds the community-watchlist pipeline.
- Data architecture: nightly Vercel cron (CRON_SECRET pattern) pulls Polygon grouped-daily (ALL US tickers, ONE call) + cached ticker details/financials → screener_metrics table in Supabase (universe filtered to liquid names ~$300M+ mcap; cols: price, chg 1d/5d/1m/3m, vol vs 20d avg, mcap, sector, 52w-high/low distance, RSI14, EMA20/50 state, gap%). UI queries the table — zero per-user API load, instant filters.
- /screener UI: preset screens front and center (family-friendly: "Big brands at new highs", "Steady dividend payers", "Momentum movers", "Oversold quality", "Volume surges") + custom filter builder (FTA tier gets the advanced technical filters; FIC gets presets + basics — tier differentiation). Results rows: logo, price, chg, spark, mcap, sector + actions: "Add to family watchlist" / "Suggest to community" / "Ask Kai" deep-link (Lane 4 tie-in).
- Education-first framing: every preset explains WHAT it finds and WHY it matters (no "hot picks" register); kid-visible.
- Free tier: LockedState.
- Effort: 1 migration + 1 cron route + 1 page + presets ≈ one lane.

## LANE 7 — HELPER-CONTENT EXPIRY + TOUR REFRESH (owner directive 2026-07-23; after Simbot-live + screener-redesign fixes land)

7A. Helper-note expiry framework: instructional "how to use this" notation across the app auto-hides for seasoned users.
- Central hook (e.g. useNewMemberHints): visible only while account is "new" — first_login + 24h window (profiles.created_at or first tour fire; pick the robust signal) — AND not manually dismissed (per-hint key in localStorage + optional profiles jsonb). After 24h: hidden by default, each spot keeps a tiny "?" affordance to re-open (help stays reachable, never re-imposed).
- Sweep and wrap ALL instructional notation: screener "How to use a screener" explainer, watchlist ladder/how-it-works copy, community house-rules/education banners, Ask Kai intro/disclaimer blurb (the not-advice disclaimer line itself stays permanently — compliance, only the how-to blurb expires), Simbot intro overlays, live-classes explainers, start-here re-visit hints, any "New!" chips. Inventory first, list what was wrapped in the report.
7B. App tour refresh for the new app: AppTour steps rewritten for current nav/layout — Community (full-width feed + Club Chat drawer), Community Watchlist, Screener, Leaderboard + belt chip, Ask Kai, Practice group incl. Simbot tab, FTA section (FTA parents), role-aware as before (kid/teen/parent variants; kids: no locked/upsell surfaces in tour). Introduce tour_version (profiles.tour_completed_at → keep, add tour_version int): bump to v2 so EXISTING members see the updated tour ONCE on next login ("See what's new" framing on the intro step for returning users vs "welcome" for new).
- Walkthrough video on start-here: OUTDATED (old layouts). Do NOT re-record in this lane (heavy Playwright+voicebox pipeline); hide the stale video behind the checklist link with an "updated tour available" pointer to ?tour=1, and flag re-record as owner-visible follow-up.

## LANE 8 — ONBOARDING QUESTIONNAIRE UPGRADE + KAI PERSONALIZATION (owner directive 2026-07-23; after Lane 7 — both touch onboarding surfaces)

8A. Questionnaire (ENHANCE EXISTING — do not rebuild): mig 075 family_profiles (household/experience/goals/hear_about) + skippable onboarding steps + /onboarding/profile backfill + deriveRecommendations already shipped. Gaps to close per owner ask:
- Add "trading vs investing interest" question (both/either scale) + explicit # of family members + ages breakdown if household field doesn't already capture it (inspect first; additive migration only if needed).
- Ensure the questionnaire fires on FIRST login for EVERY entry path: funnel signup, admin invite claim, Stripe-webhook membership, family-member invite — not just the funnel path. Presented as a warm 4-5 step flow (existing skippable posture stays — never a hard wall, but prominent on first login until completed or dismissed twice).
- Answers feed: deriveRecommendations home card (exists), admin CRM (exists), and NEW → Kai (8B).
8B. Kai knows every user: 
- System-prompt injection per request: display_name (address them by name), age register (exists), belt/level, family profile data (experience, goals, trading-vs-investing interest, household) — so answers shape Kai's depth and examples.
- Conversation memory: threads already persist; add cross-thread continuity via kai_user_memory (per-user rolling summary, own-row RLS): after each chat session (or every N messages), a cheap Haiku pass updates a compact "what Kai knows about this user" summary (topics discussed, stocks they follow, stated goals, comprehension level); injected into future system prompts. Cap size; user-visible + clearable from /kai settings ("What Kai remembers about you" — transparency, family-appropriate).
- Privacy: kid accounts — memory works but summary generation prompt forbids storing personal details beyond learning context; parents can view/clear a kid's Kai memory from family settings.

GITHUB (owner ask, ALREADY SATISFIED): app lives on its own private repo github.com/kwayclawdbot/fta-dashboard (origin, main), Vercel auto-deploys from it — confirmed 2026-07-23. No action.

## LANE 8R — ONBOARDING WIZARD REBUILD (owner clarification 2026-07-23: questionnaire IS the signup flow)

Owner-corrected vision: the profile questionnaire is not a dashboard card — it is THE new-account process. Full-screen multi-page gamified wizard (one question per page, progress bar, big tappable choice cards, true/false quick checks), for EVERY entry path (funnel, admin invite, Stripe webhook claim, family-member invite). Flow: welcome splash → who's joining (adults/kids/ages) → experience (MC) → 3-4 true/false knowledge checks (engagement + comprehension calibration → seeds Kai memory/register depth) → goals (multi-select) → focus (trading/investing/both) → username (reuse existing) → avatar pick (reuse 30-PNG picker) → invite step (parents only: referral link share, reuse referral system; kids skip) → celebration → dashboard (tour v2 fires). Kid variant: age-appropriate questions, no invite/business steps. Funnel register STOPS setting onboarding_complete=true — everyone routes through the wizard. Per-question quiet "skip"; flow itself default-mandatory. Answers → family_profiles (+ knowledge-check score → comprehension seed in kai_user_memory or profile field). Dashboard FamilyProfileHome card demotes to backfill-only for pre-wizard members. Coordination: runs parallel to Lane 9 — MUST NOT touch research/screener/watchlist/social files.

## LANE 9 — ROBUST TICKER RESEARCH PAGES (owner directive 2026-07-23; planned, awaiting/assumed go; after Lane 8)

Vision: every ticker's /research/[ticker] becomes a WallStreetZen-class research page — robust fundamental + technical data, VISUAL-first, progressive disclosure to avoid information overload. Education-first register (family platform).

Data reality (design within what we own — no new vendors):
- Polygon (existing key): ticker details (mcap/sector/desc), quarterly+annual financials (income/balance/cash-flow), dividends, splits, news, 2y daily bars, delayed quote. NO analyst ratings/price targets/estimates (Benzinga add-on — future owner cost decision; page design leaves a slot).
- Already computed in-house: screener_metrics + screener_history (11,455 tickers: RSI14, EMA20/50 states, vol ratios, %chg windows, 52w-window distances, closes/volume history) — reuse, don't refetch.
- Existing on the page: Kai Research Report section, community research notes, watchlist actions.

Page architecture (progressive disclosure — summary first, depth on demand):
1. HERO: logo, name/ticker/exchange chip, live delayed price + day change, 52w range position bar, watchlist/community/Ask-Kai actions (exist).
2. SCORECARD STRIP (the anti-overload device): 4 visual grade tiles — Value · Growth · Health · Momentum — each a 0-5 ring/gauge computed from transparent rules (e.g. Growth = revenue CAGR + margin trend; Health = debt/equity, current ratio, FCF positivity; Momentum = RSI/EMA states/52w position from screener_metrics; Value = P/E,P/S vs own history — honest "insufficient data" state when financials sparse). Tap a tile → its checks.
3. CHECKS PANEL (WallStreetZen pattern): each grade expands to plain-English pass/fail/neutral checks ("Revenue grew in 3 of last 4 quarters ✓", "More cash than debt ✓", "Trading below its 20-day average ✗") — every check has a one-line "why this matters" (education-first; kid-readable). All rule-based, all explainable, no black box.
4. PRICE + TECHNICALS: interactive chart (daily, 1M/3M/1Y/2Y ranges) with EMA20/50 overlay toggles, RSI gauge dial, key stats row (vol vs avg, gap, distances) — from screener data + bars.
5. FUNDAMENTALS VISUAL: revenue & net-income bars (8 quarters), margin trend line, dividend history if any, balance-sheet strength visual (assets vs liabilities), FCF trend — SVG components in the platform chart style (reuse Kai-report chart components where possible).
6. ABOUT: plain-English business description (Polygon desc, trimmed), sector/industry chips, "Explain like I'm 10" toggle for kids (static derivation or Kai-report kids section when one exists).
7. NEWS: recent headlines as link cards (existing news tool from Ask Kai plumbing).
8. EXISTING SECTIONS KEPT: Kai Research Report (deep dive), community research notes (wiki), Pick Record context if community pick.
9. NAV/ENTRY: every ticker mention app-wide (screener rows, watchlist cards, leaderboard of picks, Simbot live mode, Kai chat inline) links to /research/[ticker] — audit + wire the missing ones.

OWNER REFERENCE SCREENSHOTS (2026-07-23, ~/Desktop/Screenshot 2026-07-23 at {1.53.53, 1.54.19, 2.03.12, 2.03.25, 2.03.34} PM.png — Ziggma dark portfolio + BIO stock page; WallStreetZen TSLA rating/valuation/financial-health). Design directives distilled from them (binding for the build):
- Grade presentation = WSZ "component grades": circular LETTER-GRADE badges (A-F, colored ring arc) for the 4 dimensions — not 0-5 dots. Overall verdict = one gauge/dial hero (like Zen Rating) with a plain-English label — education register, NOT buy/hold/sell language (compliance): use "Strong / Solid / Mixed / Weak" wording.
- Checks presentation = Ziggma Strengths/Weaknesses twin cards: green-check strengths, red-minus weaknesses, each 1-2 plain-English sentences (their exact register: "Solid industry growth: …projected growth rate of 7.67%"). Our "why this matters" line folds INTO the sentence, not a separate tooltip.
- Timeframe chips WITH returns baked in (1W -5.2% · 1M -7.7% · 3M -3.5% · 1Y +12.6%) above the price chart — cheap from screener_history.
- Key-stats grid under chart: P/E, P/B, P/S, PEG (computable from Polygon financials + price), 52w low/high, mcap, div yield. "Fair value" slot OMITTED v1 (no DCF — don't fake it); leave layout slot + "coming soon" only if design needs it, else drop.
- Financial charts, concrete specs: (a) quarterly Revenue+NetIncome paired bars + Profit-Margin line on secondary axis (WSZ profit-margin panel); (b) Assets vs Liabilities paired bars + Debt/Equity line (WSZ); (c) Revenue and EPS annual bars, gray-out slot for estimates left EMPTY v1 (no analyst feed); (d) PE vs Industry vs Market comparison lines — computable IN-HOUSE: sector median PE from our own 11,455-ticker universe (screener sector + computed PE), market median likewise. Quarterly|Yearly toggle like both refs.
- Company profile card (Ziggma right-rail style): industry, exchange, CEO, website, address, trimmed description.
- Free-tier lock presentation = WSZ pattern: check cards visible but detail line locked ("Join FIC to read more") — tease the existence, lock the substance (consistent w/ current UpsellCard posture; kids never see locks).
- Peer comparison tab (Ziggma) = PHASE 2, not v1. Sentiment grade = NOT feasible (no analyst/sentiment feed) — 4 dimensions only, don't fake a 5th/6th.
Anti-overload rules: max 4 grade tiles above the fold; sections collapsed by default below chart (remember open-state per user); tooltips not walls of text; mobile = stacked cards w/ sticky summary; helper hints go through Lane 7's useNewMemberHints.

SOCIAL-FIRST LAYER (owner directive 2026-07-23 — integral to Lane 9, same build):
- ticker_sentiment table: one vote per member per ticker, like|unlike (UI language: 👍 "Like" / 👎 "Not for me" — family register, no bull/bear jargon for kids; adults/teens can see "bullish/bearish" subtitle via register derivation). Changeable/removable vote, forge-proof RLS (PK user_id+ticker, auth.uid() insert/update own row).
- Social bar in the research-page HERO (not buried): like/unlike counts + your vote state + comment count (jumps to thread) + contributor count. Same bar component reused on: community-watchlist cards, watchlist family cards, screener rows (compact count-only variant), pick record rows.
- ONE thread per ticker: community_ticker_comments (exists from watchlist lane) is THE canonical thread everywhere — research page renders it in full; every other surface deep-links into it. No parallel comment systems.
- Research contributions: elevate the existing wiki notes with a lightweight type chip on post: Thesis · Risk · News · Chart note · Question (default plain note). Contributor attribution = existing Avatar + belt dot + AgeBadge. Contribution feed on the research page groups by type filter chips. Profanity filter + admin moderation reuse.
- Community-consensus surfaces: (a) community watchlist board gains sort "Most liked" + a "Community Favorites" strip (top 5 by net likes, 7d window + all-time toggle — reuse windowed-RPC pattern from leaderboards); (b) screener gains a sortable "♥ Community" column (count from ticker_sentiment, joined cheaply — precompute counts into screener_metrics nightly OR a small materialized aggregate, builder's choice, must stay instant); (c) research page shows "N of M members like this" plain-English line.
- Feed integration: activity-card engine (existing) fires a card when a ticker crosses like-milestones (10/25/50 net likes, deduped per milestone) — "The club is warming up to NVDA" — links to research page.
- XP: NO XP for likes (anti-spam). Contributions ride the existing community-XP cap. 
- Aggregation queries must be definer-RPC or precomputed — never N+1 per row on screener/board.
- Kid posture: kids vote + comment like everyone (owner rule: kid likes visible); kid comments through existing profanity + moderation.
Server design: /api/research/[ticker] aggregate route (or server component) composing Polygon fundamentals (cached 24h in a research_fundamentals table or KV — decide) + screener_metrics + bars; grades computed server-side in src/lib/research/grades.ts (unit-tested rules, versioned so grades can evolve).
Free tier: hero + chart visible, scorecard/checks/fundamentals behind UpsellCard (funnel bait posture consistent w/ watchlist).
Kids: full read access, simpler check copy via register derivation; no upsells.

## LANE 10 — IN-HOUSE NEWS SECTION (owner directive 2026-07-23; FEASIBILITY: HIGH; after Lane 9)

Feasibility verdict: HIGH — all inputs already owned. Polygon news endpoint (already wired as Ask Kai's news_headlines tool) supplies real third-party headlines WITH per-article ticker tags; screener_metrics/history computes daily movers/volume-surges/52w-breakouts across 11,455 tickers; Kai generation pipeline (sonnet/haiku + grounded structured output) is proven from Lane 4. What this is NOT: real journalism/scoops — it's grounded market-data narration + curated external links; label it honestly ("Club Newsroom", AI-generated tag).

1. Schema (next migration): news_articles (slug, title, dek, sections JSONB, tickers text[], kind market_wrap|ticker_event|sector_spotlight, model, generated_at, published). RLS read-authenticated, service-role write.
2. Generation crons (CRON_SECRET pattern, bounded cost ≈ $1-3/day):
   - Market Wrap 2x/day (pre-open ~13:00 UTC using screener overnight data + indices via Polygon; post-close ~21:30 UTC): sonnet-5, one article — indices, sector rotation (computed from our universe), top movers w/ WHY when derivable (earnings/news headline join), education-first framing.
   - Ticker events daily post-close: rank day's notable events from screener_metrics deltas (|chg|≥8%, vol_ratio≥3, new 52w high/low crossings) → top 6-8 get short haiku-4.5-written event notes grounded in the metric + any matching Polygon headline; every article tickers[]-tagged.
   - Optional weekly sector spotlight (sonnet) — phase 2.
3. /news section: feed page (cards: kind chip, title, dek, ticker chips linking to /research/[ticker], generated-date, AI-generated + educational disclaimers), filter by ticker/kind, nav entry (fold into scheme B judiciously — possibly under Community umbrella or top-level; builder proposes). Article page renders sections + a "tickers in this story" rail w/ live quotes + social bar (Lane 9 component).
4. Ticker pages: research page News section (Lane 9) becomes TWO stacked groups: "From the Club Newsroom" (in-house articles tagged w/ ticker) + "Around the web" (Polygon headline link cards, title+source+timestamp attribution only — never scraped full text; copyright-safe).
5. Compliance: every article footer = educational-not-advice + AI-generated disclosure; no price predictions; kid-readable register derivation for a "family recap" variant later (phase 2).
6. Free tier: newsroom visible (funnel bait — news is shareable), research-page deep links hit existing gates. Kids: full read.

## LANE 11 — UX REFINEMENT BATCH (owner directives 2026-07-23 eve). Split: 11A now (parallel-safe), 11B after Lane 10 (research-page tabs).

11A (must NOT touch research/[ticker] page, /news pages, src/lib/news, vercel.json — Lane 10 owns those):
1. ALL stock cards clickable → /research/[ticker] app-wide (family watchlist cards, community board cards, favorites strip, screener cards ALREADY link — audit rows vs cards, dashboard strips, pick surfaces; whole-card click, inner action buttons stopPropagation).
2. Watchlist board cards: comment button expands the ticker's canonical thread INLINE on the card (count → tap → full list + composer inline, no navigation; reuse thread components; lazy-load on expand).
3. /kai mobile fit: page must fit the viewport exactly (100dvh + safe-area insets; composer visible without scrolling; thread scrolls internally). Verify 390x844 + a short viewport.
4. BELT VISIBILITY EVERYWHERE (supersedes Lane 2 deferral): belt shown at every user name/avatar — belt-color ring on Avatar (feed authors, comments, chat, family strips, leaderboards, profiles, pick attributions). NO N+1: batch via one definer RPC (or maintained profiles.lifetime_xp column w/ trigger — builder's choice, must be O(1) queries per surface). CRITICAL DISTINCTION: FTA tier = metallic GOLD treatment (existing tier ring/chip) and must read clearly different from YELLOW belt (make yellow belt amber-honey, gold = metallic sheen/double-ring; verify side-by-side).
5. All usernames clickable → /u/[username] everywhere (audit: feed, comments, chat, leaderboards, pick cards, contribution attributions).
6. /u/[username] profile page gains: favorite stocks (their liked tickers via ticker_sentiment), their community picks/promotions + performance, public contributions summary. Kid-minimization rules preserved (server-side strip stays).
7. Community watchlist board: "Community Favorites" becomes a TAB next to Pick Record (not a strip above Our Research). Rename "Pick Record" → "Performance" everywhere (nav labels, tabs, headings, route can stay).
8. HOME PAGE REDESIGN: reassess dashboard vs all new features. Direction: Home = daily command center — belt/XP progress hero strip, today's market pulse (indices + top movers linking research pages), community heat (favorites/most-liked + latest activity), Ask Kai entry, This Week anchor, continue-learning shortcut, family strip. Remove/merge stale blocks (audit vs Lane 1 items 15/16 state). Role-aware (parent/teen/kid variants). Keep it FAST (parallel fetches, skeletons) and ≤6 blocks per role.
9. TOUR NAVIGATION: App Tour steps must SHOW the actual pages — auto-navigate (router.push) to each step's route before spotlighting (Community→Watchlist→Screener→Kai→Practice etc.), returning to /dashboard at finish. Persist step index across navigations (localStorage) so the tour survives route changes; mobile: same flow (no More-sheet-only highlighting).
10. Migration numbering: next free is 118+ (117 = Lane 10).

11B (after Lane 10 lands): research page TABS — restructure /research/[ticker] from long vertical scroll into tabs: Overview (hero, gauge+grades, strengths/weaknesses, key stats) | Charts & Technicals | Financials | News (Club Newsroom + Around the web) | Community (thread + contributions + social) — Kai report lives in Overview or its own tab per length; deep links (?tab=community) + the comment-count jump target updated; mobile = swipeable/sticky tab bar; preserve all Lane 9/10 content, zero data changes.

## LANE 12 — NEWS NAV PROMOTION + PAGE-SPEED PASS (owner directives 2026-07-23 night; after 11A+11B land — they're rewriting home/research, don't optimize mid-rewrite)

12A. News = its own top-level nav row ("News", Newspaper icon) for all roles incl. free — NOT nested under Community (owner: on mobile Community is a tab-bar button, so nesting buried it). Desktop sidebar top-level; mobile: top-level row in More sheet (tab-bar slots stay as-are unless 11A's home redesign changed them — reassess then). Community group loses the sub-item.
12B. PAGE-SPEED PASS (measure → fix → re-measure, report honest numbers):
- Measure first: TTFB + LCP + hydration on key routes (home, community, watchlist board, research/AAPL, screener, kai, news) mobile-throttled, median-of-3.
- Fix candidates (apply what measurement justifies): client-fetch waterfalls → server components/parallel fetches; Next caching (revalidate/fetch-cache) on market-proxy + aggregate routes; dynamic import heavy chart/SVG components (research charts, screener table) so first paint isn't blocked; screener initial payload (don't ship 11k rows to client — server-paginate or stream the first page); logo image optimization (next/image, caching headers on the branding proxy); DB: verify indexes behind hot RPCs (get_home_state, get_community_board, research aggregate, screener selects); bundle analysis for accidental heavy imports; skeletons already exist — keep felt-speed consistent.
- Vercel Pro CONFIRMED ACTIVE (owner 2026-07-23) — screener cron maxDuration=300 honored, cold starts already on Pro infra. Lane 12B is therefore pure code-level optimization; if measured TTFB still shows cold-start spikes, consider a warming ping or Fluid compute settings, but don't blame the plan tier.

## LANE 13 — SOLO-MEMBER EXPERIENCE + WELCOME EMAIL SERIES (owner directives 2026-07-24)

13A — SOLO/INDIVIDUAL (non-parent) members must feel fully welcome (platform is family-first today; solo adults get forced through family framing):
- Onboarding wizard: "who's joining" gains a first-class "Just me" path → skips kid/ages questions, creates the family row silently as a solo household (data model unchanged — family of 1; no "family" language surfaced to them), invite step reframed ("invite a friend" / skippable), celebration + recommendations solo-toned.
- Copy/register audit app-wide for solo members (household adults=1, kids=0 → derive isSolo): Home (no family strip/Parent Corner nags; family-XP = their XP so leaderboards Just Work), nav (Family group hidden or renamed "My Account"-ish for solo), This Week parent-corner fields de-parented, community AgeBadge stays adult, upgrade/FTA pitches solo-toned, report cards/kid features never nag. Audit + fix pass w/ file list. No schema change expected; deriveRegister/deriveRecommendations gain solo awareness.
- Marketing/free-class funnel: quiz + result pages get solo-friendly branches (currently assumes "your family").
13B — WELCOME EMAIL SERIES (after 13A; visually robust, engaging; Resend domain live, SMTP live, RESEND_API_KEY in Vercel):
- 5-email drip: D0 welcome ("your first 10 minutes" — tour/watchlist/Kai), D1 meet-Kai + research pages, D3 community+belts (social proof), D5 screener+simbot practice, D7 week-one recap w/ their actual XP/belt (merge data) + what's-next. Variants: parent-with-kids vs solo adult vs FTA (gold). Kid accounts get NO emails (parents only).
- Visual system: hand-built responsive HTML (no framework dep): warm-paper palette, logo header, belt-color accents, big CTA buttons → app deep links, screenshot/illustration blocks (reuse marketing-site shots in fic-marketing/img or generate clean SVG blocks), footer w/ unsub (HMAC pattern from campaigns lane) + physical-address compliance.
- Infra: email_drips table (member, sequence, step, scheduled_at, sent_at, variant) + trigger on wizard completion + daily cron (CRON_SECRET pattern) sending due steps via Resend API; idempotent; respects notification_prefs email toggles + unsub; admin visibility page minimal (list + counts in admin CRM).
- Test: send full series to owner email (kwayclawdbot@gmail.com) for visual approval; zero real-member sends until owner approves the look (feature-flag drip_enabled in app_settings default false → owner flips or tells me).

## Standing constraints (all lanes)
- Opus subagents build; commits conventional style + Co-Authored-By Claude Fable 5; no git add -A.
- LazyMotion barrel (import { m } from "@/lib/motion"); full motion only for drag/layout.
- Both themes via token palette; mobile 390px; loading skeletons for new routes; adult-first register.
- npm run build green → push → poll Vercel → Playwright live-verify → zero e2e residue.
- Migrations continue from current max; RLS posture: simple SELECT + app gating + definer RPCs.
