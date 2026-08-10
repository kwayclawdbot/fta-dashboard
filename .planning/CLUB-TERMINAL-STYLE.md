# CLUB TERMINAL STYLE — THE LAW (ratified 2026-08-09)

The club-mode UI matches the owner's mockup board
(`Mobile app design consultation` uploads, board `ChatGPT Image Aug 7 … 10_07_23 AM.png`).
That board is the single source of truth for club screens — composition AND skin.
When building a new club surface: CROP the relevant phone out of the board,
read it at full resolution, itemize every object top-to-bottom, then build
exactly that. Never compose from memory, never translate into framework
defaults.

## Palette (club-dark tokens — already in globals.css, use tokens NEVER hex)
- Page `--paper` #050505 · Card `--card` #0D0F12 · Hairline `--sand` #1A1D22
- Raised well `--m800` #14161B · Ink white #F5F7FA · Soft cool-gray #8E97A5
- Price up `--price-up` #22C55E · down `--price-down` #F23645
- Brand accent (CTAs/active) `--accent-solid` #FF6B00
- Kai/violet `--kai-blue` #7C6BFF (KAI marks, analysis cards, portfolio chart)
- All colors via semantic tokens so club-light + family stay coherent.

## Typography (revised 2026-08-10 — board letterform audit)
The board's headlines are NOT Sora. High-zoom crops of "Good morning, Kway!",
"What are you looking for?", DISCOVER and the KAI MORNING BRIEF read as a
modern NEUTRAL grotesk (SF-Pro class): closed double-story 'a', single-story
hooked 'g', straight-tailed 'y', near-vertical terminals, tall x-height,
tight negative tracking on display sizes. Two candidates were loaded and
compared against the crops:
- **Inter — WINNER for display.** Same neutral skeleton as the board:
  closed apertures, vertical terminals, no mannered details. With tracking
  tightened a step (−0.035/−0.03/−0.025em on display-1/2/3) it sits on the
  board's headlines almost 1:1.
- Space Grotesk — rejected for display: its clipped/angled terminals,
  ink-trapped joins and idiosyncratic 'g'/'a' read quirkier than anything on
  the board. It stays loaded (`--font-space-grotesk` / `font-grotesk`) as the
  club stack's second face.

CLUB stack (scoped `[data-mode="club"]` via `--display-stack` /
`--track-display-*` in globals.css — family/fta keep Sora untouched):
- Display: Inter (700/800) — headlines 24-28px, card titles 16px, tickers
  13.5px; tight tracking per above. `font-display` + `text-display-*`
  resolve to this automatically; no component edits.
- Body: Inter — 12-13.5px, line-height 1.5-1.6
- Data: IBM Plex Mono — prices, %moves, timestamps, countdowns, tabular-nums
  (numerals NEVER move off mono in the remap)
- Section labels: WHITE BOLD CAPS ~13px, modest tracking (not tiny gray mono)
- Inline chip-row prefixes (filter groups, KAI INTERPRETATION-style): small
  soft-caps ~10.5px, +0.1em tracking, soft gray — inline before the chips,
  never a stacked form label

## Geometry & rhythm
- Cards rounded 14-16px, interior padding 14-16px — text NEVER flush to edges
- Rows: quiet rounded rows or hairline-separated ledgers — not cards-in-cards
- Page rhythm is UNEVEN by design: 18px inside a thought, 24-26px between
  sections. NEVER `space-y-*` uniform stacks.
- Bands (Kai read etc.) bleed full-width, square corners.
- Label→content 12px · title→sub 4-6px · sub→chart/bar 9-13px · bar→CTA 14px

## Component anatomy (established, reuse — don't reinvent)
- Ticker rows: real logo tile (CompanyLogo/BrandTile via /api/market/logo),
  bold ticker Sora, mono price, green/red move, line sparkline (month drift
  colors the curve; day move colors the %; they may disagree — that's correct)
- Setup cards (Kai Watch): urgency tiers 17/14.5/12.5px Sora, mono uppercase
  state chip, Entry/Stop/Target/R:R StatGrid, quoted Kai's-read line
- Sentiment: "NN% Bullish" green band / segmented bull-neutral-bear bar
- Charts: candlesticks intraday (tf feed), area/line daily; dotted grid,
  right price rail, session stamps
- Circle rings: conic segmented neon rings + real countdown ("8d left")
- Tabs: violet (--kai-blue) 2px underline active; pills for timeframes
- CTAs: solid orange rounded pill; secondary = dark bordered pill

## Hard rules
1. REAL DATA ONLY. An object with no data source renders only when its data
   exists — exact layout, unwired prop — never a fabricated number/curve.
2. Family / teen / kid surfaces stay byte-for-byte untouched; club branches
   via mode (useAppMode/server door), kid+free walls always preserved.
3. Semantic tokens only; zero hardcoded surface hex in components.
4. Keep all existing functionality (metering, gates, RLS walls, interactions).
5. Accuracy/reputation framed as track record, never performance promises.

## Redesign audit (2026-08-09)

Every route under `src/app/(dashboard)/`. Classes: **(1)** already
terminal-styled · **(2)** club-reachable, NEEDS redesign · **(3)** family /
kid / FTA-only (untouched by this design) · **(4)** dead / redirect.
Future passes update the Status column in place.

| Route | Class | Status |
|---|---|---|
| /dashboard | 1 | Ratified (clubhome kit — MarketPulse/YourSignals vocabulary) |
| /discover | 1 | Ratified (concurrent screener/discover pass in flight) |
| /community (+ /compose, /changed-my-mind) | 1 | Ratified (ClubCommunityScreen, board kit) |
| /kai | 1 | Ratified |
| /alerts (+ /alerts/e/[id]) | 1 | Ratified |
| /research/[ticker] | 1 | Ratified (ClubRead / ClubStockHead / KaiReportPanel) |
| /watchlist (+ /watchlist/community) | 1 | Ratified |
| /u/[username] | 2 | DONE 2026-08-09 — club server-door branch, terminal profile; family render byte-identical |
| /leaderboard | 2 | DONE 2026-08-09 — club terminal ledger (mono ranks/XP, belts); family podium/cards untouched |
| /settings (SettingsSurface) | 2 | DONE 2026-08-09 — club white-caps section labels, dark cards, uneven rhythm; family render + all controls untouched |
| /belts | 2 | DONE 2026-08-09 — club terminal ledger (dark card, mono XP thresholds, accent "you are here"); family board-22 render byte-identical |
| /progress | 2 | DONE 2026-08-09 — club terminal ProfileSurface branch (caps YOU mast, identity head w/ accent-gradient XP bar, mono stats ledger, badges shelf, StanceChip track-record rows); family/kid render byte-identical |
| /referrals | 2 | DONE 2026-08-09 — club terminal masthead (no case transform on the commercial headline) + white-caps section labels, dark link card; every commercial string byte-identical, wiring untouched |
| /news (+ /news/[slug]) | 2 | TODO |
| /courses (+ [slug], lesson viewer) | 2 | DONE 2026-08-09 — club terminal course cards (mono progress meters, orange CTAs), syllabus as dark-card lesson ledger, lesson viewer caps mast + white-caps labels + violet tab underline; all gates/XP/quiz wiring shared, family/kid render byte-identical (useAppMode branch) |
| /live-sessions | 2 | DONE 2026-08-09 — club terminal event rows (dark 14px cards, mono when-lines) + white-caps section heads via LiveSection wrapper; RSVP/XP/tier/track gates + recording player untouched; family render byte-identical |
| /flashcards | 2 | DONE 2026-08-09 — club caps mast, dark Daily-5 card, white-caps "Study sets" over terminal deck rows, caps session head; SRS writes + once-a-day XP gate untouched; family/kid render byte-identical |
| /start-here | 2 | DONE 2026-08-09 — club terminal onboarding checklist (caps mast, dark next-step card, white-caps section label, dark step cards w/ mono ordinals, accent-edged next step); orientation writes + 6/6 celebration + kid branch untouched |
| /chart | 2 | DONE 2026-08-09 — club terminal chrome (semantic orange Load CTA, white-caps TRY label, flat dark chart well); board-03 composition + chart engine untouched; family classes byte-identical |
| /simulator (+ /lessons, /simbot) | 2 | DONE 2026-08-09 — club terminal chrome (mono eyebrows, caps masts, white-caps rail labels, pattern ledger in dark card); engine/tick loop/persistence, scenario scoring/XP, simbot bridge + free/kid walls untouched; family/teen render byte-identical |
| /games (+ candle-battle, trend-or-trap) | 2 | DONE 2026-08-09 — club terminal hub (caps mast, dark record card, white-caps "The reps", terminal hub cards, no pips); game engines untouched (candle-battle/trend-or-trap pages mount engines only), free-tier lock + server gate untouched; family/kid render byte-identical |
| /screener | 2 | DONE 2026-08-10 (rev 2, chip-first) — filter card + label-over-control form skeleton KILLED; filters are now flowing chip rows straight on the page (board's KAI INTERPRETATION vocabulary): soft-caps inline group prefixes (UNIVERSE · SIZE · PRICE + MOVEMENT · ACADEMY), self-describing raised-well pills, pill-wrapped native selects for long lists (quiet while "Any", accent-lit when live), compact rounded-full mono pill-wells for thresholds with identity-carrying mono affixes ($, 1D %, VOL ≥ ×, RSI ≤); disclosure is an inline caps control, no card chrome; re-verified under the club Inter display stack — masthead/headline/labels read like the board; filters logic, AI parse, saved screens + 20-cap, free meter, FTA gate, kid redirect all byte-preserved; shared surface, tokens carry family/club |
| /circles (+ [slug]) | 2 | TODO — light board-16 kit; rings anatomy already established |
| /club-index | 2 | DONE 2026-08-09 — terminal caps masthead; ratified ClubIndex ledger untouched |
| /vip-room | 2 | DONE 2026-08-09 — audited against the law, no deviations: tokens only, board-11 pricing card, accent pill CTAs, mono timestamps, uneven rhythm; commercial copy byte-preserved, gate untouched |
| /research/thesis/[id] | 2 | DONE 2026-08-09 — club thesis object: white-caps section labels (updates + sections + discussion), mono provenance/price stamps kept, price ramp stays the only green/red; RPC reads, kid walls, verbatim disclaimer untouched; family render byte-identical |
| /help | 2 | DONE 2026-08-09 — club terminal ledger: caps mast + white-caps section heads (HelpSection wrapper); ticket ledger/cards already ride --card/--sand; bot, ticket writes, single support address untouched; family render byte-identical |
| /upgrade | 2 | TODO (commercial copy byte-preserved) |
| /pricing | 2 | DONE 2026-08-09 — club chrome via new <ModeSwap/> client door (server page): mono eyebrow + white-caps section labels; every price/plan/entitlement/disclaimer string byte-identical in both subtrees; checkout URL, matrix, kid redirect untouched |
| /family (+ circle, corner, leaderboard, learn, live, members, overview, teen/[memberId] + guardrails/progress, tonight, watchlist) | 3 | Family-only — untouched by design |
| /parent-corner | 3 | Family-only — untouched |
| /missions | 3 | Kid missions — family/teen navs only; untouched |
| /fta/chat, /fta/courses, /fta/recordings | 3 | FTA gold register — own mode, outside club law |
| /picks | 4 | Redirects to /watchlist/community |
| /picks/[id] | 4 | Redirects to /watchlist/community |
