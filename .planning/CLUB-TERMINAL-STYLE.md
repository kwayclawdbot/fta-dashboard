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

## Typography
- Display: Sora (700/800) — headlines 24-28px, card titles 16px, tickers 13.5px
- Body: Inter — 12-13.5px, line-height 1.5-1.6
- Data: IBM Plex Mono — prices, %moves, timestamps, countdowns, tabular-nums
- Section labels: WHITE BOLD CAPS ~13px, modest tracking (not tiny gray mono)

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
| /belts | 2 | TODO — App-Light board 22 kit, needs terminal skin |
| /progress | 2 | TODO — ProfileSurface (board 07 light kit) |
| /referrals | 2 | TODO (commercial copy byte-preserved) |
| /news (+ /news/[slug]) | 2 | TODO |
| /courses (+ [slug], lesson viewer) | 2 | TODO — shared with family; branch on mode |
| /live-sessions | 2 | TODO — shared with family; branch on mode |
| /flashcards | 2 | TODO — shared with family; branch on mode |
| /start-here | 2 | TODO |
| /chart | 2 | TODO — App-Light board 03 kit |
| /simulator (+ /lessons, /simbot) | 2 | TODO — shared with family/teen; branch on mode |
| /games (+ candle-battle, trend-or-trap) | 2 | TODO — shared with family/kid; branch on mode |
| /screener | 2 | IN FLIGHT — concurrent agent owns this pass |
| /circles (+ [slug]) | 2 | TODO — light board-16 kit; rings anatomy already established |
| /club-index | 2 | TODO — lowercase wordmark head needs terminal caps |
| /vip-room | 2 | TODO — clubhome BoardSection already; verify against law |
| /research/thesis/[id] | 2 | TODO — thesis object surface |
| /help | 2 | TODO |
| /upgrade | 2 | TODO (commercial copy byte-preserved) |
| /pricing | 2 | TODO (commercial copy byte-preserved) |
| /family (+ circle, corner, leaderboard, learn, live, members, overview, teen/[memberId] + guardrails/progress, tonight, watchlist) | 3 | Family-only — untouched by design |
| /parent-corner | 3 | Family-only — untouched |
| /missions | 3 | Kid missions — family/teen navs only; untouched |
| /fta/chat, /fta/courses, /fta/recordings | 3 | FTA gold register — own mode, outside club law |
| /picks | 4 | Redirects to /watchlist/community |
| /picks/[id] | 4 | Redirects to /watchlist/community |
