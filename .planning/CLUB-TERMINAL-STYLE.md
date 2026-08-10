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
| /alerts (+ /alerts/e/[id], /alerts/s/[id]) | 1 | Ratified · IA rebuilt 2026-08-10 (see "Alerts UX audit") — 3 tabs NOW/HISTORY/RECORD, one card vocabulary, legacy hash remap |
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
| /screener | 2 | DONE 2026-08-10 (rev 3, board-composed) — rebuilt from the DISCOVER phone crop, not restyled: ONE plain-English ask bar in the board's query-bar anatomy (violet spark mark, run arrow; replaces the keyword-input + NL-card pair — an unparsed ask degrades to the same name search), active filters as removable accent chips flowing under the bar (KAI INTERPRETATION register) behind a single compact "Filters · N" trigger; the FULL filter set moved into a bottom sheet (phones, MobileTabBar More-sheet pattern: backdrop/grabber/drag-dismiss) / right side panel (desktop), grouped roomy in the pill/well vocabulary with a live "Show N matches" accent CTA; result rows are the board's discover result anatomy verbatim (40px round logo · font-display bold name · soft mono meta = cap + the current sort's reading · green "% Bullish" dot line off the shared attention ledger, only when a real read exists · mono ticker · bold mono price · TickerSpark real closes · gold watchlist star = the family_watchlist add; no-family = no star); no stray font classes on ticker rows (display/mono only — club renders Inter); universe load discipline, NL parse, presets, saved screens + 20-cap + free meter, FTA Academy gate in-sheet, kid walls, sort + pagination all same code paths; the old per-row suggest/alert buttons retired from rows (rows deep-link to research where both live, ratified discover-row precedent); shared surface, tokens carry family/club · REV 4 2026-08-10: result rows now EXPAND in place (accordion, one open, chevron rotates, filter-sheet height discipline) — real 1m closes chart in ClubStockHead's daily vocabulary (dotted grid + right price rail, fetch-on-expand w/ module cache, no bars = stated line never a fake curve), mono stat strip of only the metrics the row carries, % Bullish when the ledger reads, then an action row: "+ Watchlist" (the star's family_watchlist write, state-reflecting), "Ask Kai" (useKaiSheet openKai w/ ticker chip + seeded query; hidden on free), "Set alert" (SetAlertButton, research's kid/teen gate; preset alert keeps its original !isKid gate), "Open research →" accent link now carrying the row's deep link; collapsed anatomy + star byte-identical, sort/pagination/meters/saved screens/NL parse untouched |
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

## Production sweep 2026-08-10

Full-app cohesiveness sweep of every club-reachable surface (type · tokens · geometry · chrome · states). Family/teen/kid/FTA renders byte-identical throughout — every fix is a club branch, a club-only file, or a `[data-mode="club"]`-scoped token. One line per fix:

- globals.css — kai ramp de-hardcoded: `--color-kai-300..700` now read raw `--kai-*` vars (`:root` keeps the cobalt literals); club-DARK block remaps the whole ramp to the board violet (kai-500 ≡ `--kai-blue` #7C6BFF, text-end 600/700 lifted for AA on `--card`), so every `bg/text/ring/border-kai-*` on the terminal (alerts rail, Kai pointers, FAB, report panels) follows the violet with zero component edits; also fixes the previously-undefined `var(--kai-300)` in the `.f0-kai-*` card inset.
- FloatingKaiButton — collapsed sliver's hardcoded cobalt shadow `rgba(37,99,255,.4)` → `color-mix` off `--kai-blue`, so the tucked FAB shadow is violet on the terminal.
- /leaderboard — club branch off the shared uniform `space-y-4` wrapper onto uneven terminal rhythm (mast→rail 24 · rail→board 14 · board→"How rank works" 28); family wrapper string byte-identical.
- /referrals — club branch off uniform `space-y-4` onto per-section margins (mast→link card 24 · share 24 · stats/how-it-works 28); family wrapper + all commercial strings untouched.
- /flashcards — picker's club branch off uniform `space-y-8` onto mt-6/mt-6/mt-7 section rhythm (Daily-5 card, Today's review, Study sets); family stack untouched.
- /courses — FreeCoursesView club branch off uniform `space-y-8` onto mt-7 sections + mt-8 upsell band; family/free default render byte-identical.
- /games — club branch off uniform `space-y-8` (record card mt-6, "The reps" mt-7) and the record card's hero session count moved off `font-display text-display-2` onto mono bold 28px tabular in club only.
- ClubStockHead (research/[ticker], club-only) — hero price off `font-display` extrabold onto `font-mono` bold 34px; the ±move line gains `font-mono`; StatWell figures (P/E, EPS…) `font-display` → `font-mono`; Community Sentiment `NN%` numerals onto mono tabular ("Bullish" word stays display).
- MarketPulse (clubhome kit) — ticker-card price `font-display 17px extrabold` → `font-mono 16px semibold`; the day-move % gains `font-mono` (law: prices/%moves never off mono).
- YourSignals (clubhome kit) — watchlist-mover day-move % onto `font-mono` 12.5px tabular.
- ClubIndex ledger — conviction % off `font-display extrabold` onto `font-mono` 13px semibold tabular.
- ClubWatchlistBoard (club-only) — five `rounded-2xl` (24px) cards brought onto the 14-16px card law (`rounded-[16px]`); Total Value money figure `font-display` → `font-mono` 32px bold tabular.
- PickCard (alerts, terminal-ratified shared surface) — "%since issued", the 17px R:R figure, and the stake's `$risk`/`$reward` amounts all onto mono tabular.
- TickerDiscussion composer — club branch: gold-hover underline textarea → raised-well input (`rounded-[10px] border-sand bg-card`, accent focus); family underline string byte-identical.
- ThesisObjectClient — both composers (update + section/discussion reply) club-branched off the `border-b … focus:border-gold-400` underline onto the raised-well + accent-focus vocabulary; family strings byte-identical.
- CirclesSurface — open-a-circle form fields club-branched off `f0-rule-bottom … focus:border-gold-600` underline onto raised-well + accent focus.
- CircleRoom — thread composer club-branched off the same gold-hover underline onto raised-well + accent focus.
- Chrome audit (DashboardTopBar / DashboardSidebar / MobileTabBar / More-sheet) — verified fully token-driven: midnight ramp → terminal cool grays, gold actives → lifted orange text-end, `font-display` → Inter under the club stack; no deviations, no edits needed. KaiPanel/KaiSheetProvider ride `--kai-blue`/`kai-*` and now follow the violet via the ramp fix.
- States audit — every club-reachable loading/empty/error path checked: all skeletons are card-shaped on tokens, empties are stated FoundingLine/EmptyCard objects, no unstyled fallbacks found.
- Token audit — zero hardcoded surface hex in club renders (only `text-[#1A1614]`-on-`volt-500` CTA ink, a deliberate mode-invariant constant pairing shared with PillTabs); no `f0-input`/`f0-label` form idioms remain on club-reachable surfaces.
- Verification — `npx tsc --noEmit` clean; eslint on all touched files: no new errors (3 pre-existing `set-state-in-effect` errors at HEAD in flashcards/CircleRoom/FloatingKaiButton are untouched).

## Alerts UX audit 2026-08-10

Owner verdict on /alerts: "lacking and half put together." Audited as ONE
experience (AlertsClient ~2,640 lines, page.tsx, e/[id], s/[id],
components/alerts/*). The screen accreted across at least four passes
(board-06/18/19 canvas pass · CheatCodeDoors card-language pass ·
SetupGraphCard/AlertLevelChart graphic pass · ResolvedLedger +
OutcomeShareBoard pass) and each pass ADDED a surface without retiring the
one it superseded. Findings:

1. **Redundant nav objects.** Overview drew FOUR NavCards (My watchlist /
   Kai Watch / Kai Daily / Opinion changes). Two of them were buttons to
   sibling TABS already on the SegmentedRail directly above; the other two
   were routes already carried by the inline WatchRail in the header. Every
   destination existed twice on one screen; the rows were pure filler.
2. **Two stacked systems in one History tab.** ResolvedLedger (a
   hairline-separated compact ledger vocabulary) sat ABOVE the chronological
   event/broadcast feed (the Kai-Watch card anatomy: urgency-tiered heads,
   StatePill, StatGrid, KaiRead). Same room, two unrelated visual systems,
   and resolutions were pulled OUT of time while everything else was
   grouped by day.
3. **Header duplicated.** WatchHead's "Kai's alerts for you" status band
   (icon ring · bold line · readings · N-new pill) was re-drawn inside the
   History tab as a second band ("Everything Kai has sent you") with the
   same anatomy and the same N-new count — one thought said twice.
4. **The same setups wore two costumes.** Live Kai Daily setups rendered as
   SetupGraphCards on Overview AND as PickCards on the Kai Daily tab — two
   full card vocabularies for one object, one tab apart, with no stated
   relationship.
5. **Record tab printed its outcomes twice.** OutcomeShareBoard (share
   cards, capped at 12, pointing at "the full ledger below") was followed by
   OutcomeSection re-listing the SAME graded outcomes as CardLink rows — a
   leftover of the pre-share-card winners/losers sections (its unused
   `rank`/`icon` props gave the accretion away).
6. **Five tabs for three thoughts.** Overview/Kai Daily/My watches all
   answer "what is Kai on right now"; the member's mental model (owner's
   words) is NOW → HISTORY → RECORD. "My watches" management is a secondary
   affordance, not a peer destination; Kai Daily is a section, not a room.
7. **Orphaned/legacy pieces.** board.tsx still exported SectionPills for
   this screen (superseded by SegmentedRail — still legitimately used by
   /watchlist/community, kept there); NavCard existed only for the
   redundant Overview rows; AlertsClient carried DirChip/OutcomeSection row
   styles outside the ratified card anatomy.

**Rebuild (same date):** three tabs — NOW (SetupGraphCard board → Getting
Close → compact "Your watches" management with all edit affordances → Daily
Brief blocks incl. sample/empty state), HISTORY (ONE chronological surface:
resolved setups + fired events + broadcasts merged, all in the Kai-Watch
card anatomy, one search, day buckets, resolved rows deep-link /alerts/s/),
RECORD (track-record stats band on top, then the All/Wins/Losses share-card
board with show-more instead of a silent cap, then the never-scored
observational split). Legacy hashes (#overview/#daily/#watch/#live →
now, #history → history, #track → record, #kai-nl → now + scroll) remap in
the existing hash effect. NavCards, ResolvedLedger, OutcomeSection, DirChip
and the duplicate History band deleted; NavCard removed from board.tsx.
All plumbing preserved: rule toggle/digest/delete writes, alert_prefs
digest + hub_seen_at, setup follows, strategy tuner, free LockedState +
adult gate, /e/ and /s/ detail pages, verbatim compliance lines.
