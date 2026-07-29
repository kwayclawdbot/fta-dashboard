# DELTA — the honest-data ledger

Everything in the canvases whose **content** cannot ship as drawn, with the substitution rule
that replaces it. A port lane reads this once, then has zero judgment calls left.

**Style is never in this ledger.** Colours, type, spacing, radii, shadows, layout — port those
exactly from `spec.md`. This file governs *what the pixels say*, not how they look.

---

## Substitution rules

| id | class of content | rule |
| --- | --- | --- |
| **R1 SCALE** | At-scale counts the product does not have (`26,480 members`, `2,341 listening`, `1.8K joined`, `152 replies`, `12,480 online`, `126 families`, `4,312 opinions`) | Bind to the real count. **Every such element ships with a designed below-floor state** (production is 9 tickers, 1–2 participants each, 3 positioned posts). Never render a founding number in a slot drawn for four digits — the below-floor state is a different composition, not the same one with a small number in it. Loading ≠ empty: skeleton while fetching, designed founding state when genuinely empty. |
| **R2 PRICE** | Quotes, deltas, levels (`$173.42`, `▲4.72%`, `R2 196`, `entered $158.20`) | Live market data binding. Never hardcode. Colour is `text-price-up` / `text-price-down`, no `dark:` variant. Price never sits on an orange field. |
| **R3 SENTIMENT** | Club sentiment percentages, splits, shift counts (`78%`, `32% BULLISH / 68% BEARISH`, `+14 shift today`) | Real aggregate from the club's own opinions. **Suppress entirely below the participation floor** — a "68% bearish" derived from 2 votes is a fabricated consensus. Lime = community sentiment only, never green/red. |
| **R4 VERDICT** | Any directive instruction the app issues: the drawn `BUY` / `SELL` meter, `BUY SIGNAL`, `SELL SIGNAL`, `Accumulate`, `Entry zone`, `invalidation below`, `Consider sizing down` | **Banned.** The app never tells a member to transact. Substitute the shipped scorecard vocabulary `Strong / Solid / Mixed / Weak` (`src/lib/research/grades.ts:510`, asserted by `grades.test.ts`), or `Bullish / Neutral / Bearish` framed explicitly as a **community stance**. Keep the layout — a two-ended meter, a signal chip, an alert card — and change the word. The one legitimate `BUY` in the codebase is `simulator/page.tsx:269` (a chart marker on the member's own filled paper order, paired with `SHORT`): leave it alone. |
| **R5 PERFORMANCE** | Published member accuracy: `Accuracy 71%`, `Accuracy 74%`, `Call accuracy 67%`, `✓ +6.4% / ✗ −2.1%` on recent calls, `June picks graded: 3W · 1L · avg +7.2%`, belt criteria phrased as `50%+ accuracy` | Testimonial / performance-claim territory. **Ship conviction and participation instead** — opinions posted, minds changed, people influenced, streak, circles hosted. Same tile, same numeral size, different metric. Belt criteria restate as participation + consistency, not an accuracy threshold. **Flag to owner; do not assume the ruling.** |
| **R6 OPTIONS** | `Options Basics` learn path, `Options desk` room tile, `Call flow surged 3.1x`, `Put flow rising`, `Call flow increase > 2x`, `strikes`, `implied move`, `Reading options flow like a Black Belt`, `Unusual options flow detected`, `@OptionsOG what strikes are you playing` | Equities-only was the decision. Remove or replace with an equities equivalent (volume expansion, relative volume, short interest, institutional flow-agnostic phrasing). Family Mode hides options **and** leverage — F2/F3 already draw that guardrail, keep it. Member handles containing "Options" are mock personas (see R7) and disappear with them. |
| **R7 PERSONA** | Mock members and avatars: `Marcus Hill`, `GM, Marcus 👋`, `MH`, `Tiffany R.`, `DeShawn K.`, `Aisha L.`, `OptionsOG`, `SwingTraderSam`, `ChartNerd33`, `LongTermLarry`, `ValueHawk`, `DataDive`, `Priya Nair`, `Marcus Bell`, `Sana Okafor`, `InsightSeeker`, `Coach Taylor`, `Coach Maya`, `Maya & JC`, the Hill family (`Angela`, `Jaylen · 15`) | Real session user / real member records. The greeting binds to the signed-in profile. Avatar initials derive from the real name. **Where there is no real member yet, the founding state (R1) governs the whole block — do not seed fake members.** |
| **R8 XP / BELT** | `XP 12,840 / 15,000`, `Black Belt`, `⚡ 1,240 XP`, `Level 9`, `🔥 16 day streak`, `Top 2% of 25,842 members`, `62% OF CLUB` distribution figures, `18,760 XP` family total | Real `xp_events` / belt derivation (`beltForXp`, `BeltBadge`). The belt **distribution** percentages on board 22 are a population statistic — compute from real membership or omit the column; do not ship the drawn ones. Belt purple is a belt colour, not UI chrome — allowed there and nowhere else. |
| **R9 COMMERCIAL** | Price points, plan names, feature bullets, trial terms, `Cancel anytime · Billed $99 after trial`, `Terms & Privacy Policy`, `Not investment advice. Opinions are the Club's, not brokers'.`, `Technicals refresh every 15 min · Not investment advice`, `Fundamentals from latest 10-Q · FY26 = consensus est.` | **Byte-identical to the shipped strings** (`NEWS_DISCLAIMER`, `COMMUNITY_DISCLAIMER`, `TRENDING_DISCLAIMER`, pricing/upgrade copy). Restyle only. Never retype a commercial or legal string out of the canvas — copy it from the codebase. Where the canvas adds a disclaimer the app lacks, that is an addition to review, not a substitution. |
| **R10 EDITORIAL** | Kai's prose: `Blackwell demand is even stronger than the Street expects.`, `Demand signals continue outrunning supply…`, `Tech leads as AI optimism pushes semis higher.`, `Cheaper than AMD on forward earnings despite 2x the growth`, `Kai for kids: "Earnings day is like a report card…"` | Runtime-generated per ticker/day. Never hardcode canvas prose as a string. The **slot** (line count, clamp, type token) ports exactly; the text is a binding. Design for the empty case — Kai has nothing to say about most tickers most days. |
| **R11 BACKTEST CLAIM** | `72% historical follow-through · 41 triggers`, `Breakout zone 176–178 · 72% historical follow-through`, `historically bullish`, `8 of 12 indicators bullish` | A quantitative claim about future odds. Ship only with a real computed source and its methodology visible; otherwise drop the element (keep the card, drop the stat line). Do not invent a backtest. |
| **R12 TIME** | `6:02 AM`, `2m`, `9:41 AM`, `last 2m ago`, `⏳ 6d 14h`, `updated 6:02 AM`, `created 4 days ago`, `LIVE · 41:26`, the `9:41` status-bar clock on `club-screens` | Real timestamps / real countdowns. The `9:41` status bar is a mockup device chrome artifact — **do not render it at all**; the app uses the OS status bar. |
| **R13 ASSET** | `Photo · hosts on stage`, `[ room photo ]`, `photo`, `Video · Coach Taylor on stage`, `Animated scene · 12s`, `Motion recap`, `HYPERSCALER CAPEX · $B/QTR` chart image | Placeholder art. Ship a real asset or a designed fallback that holds the same box. Never ship the placeholder label. |
| **R14 FINANCIALS** | `Revenue +114% YoY`, `$27B FY23 → $184B FY26E`, `75% gross margin`, `34x fwd P/E`, `A−` health grade, `Top 3% margins · fortress balance sheet` | Real fundamentals from the data provider; `FY26E = consensus est.` must stay attached. The `A−` grade and `Elite grower` label must come from the shipped grading function, not the canvas. |

---

## Per-board ledger

### `app-dark` / `app-light` (content identical across the two)

| board | drawn content | rule |
| --- | --- | --- |
| 01 HOME | `GM, Marcus 👋`, `MH` avatar, notification `12` | R7, R1 |
| | Top-in-club tiles `NVDA 78% ▲6`, `TSLA 64% ▲3`, `AMD 61% ▲12`, `AAPL 56% ▲2`, `PLTR 53% ▲9` | R3 (the % is club conviction, not price), R1 (rank rail assumes a populated leaderboard) |
| | `TODAY IN 30 SECONDS` + `Tech leads as AI optimism pushes semis higher.` | R10 |
| | `SPY ▲1.02% · QQQ ▲1.35% · VIX ▼4.21%` | R2 |
| | Signal rows `Kai Watch: Getting Close`, `Earnings in 3 days`, `24 new opinions` | R10, R1 |
| | `YOU · Black Belt · XP 12,840 / 15,000 · 87 SCORE` | R8, R5 (opinion score is a performance figure — confirm it is participation-derived) |
| 02 DISCOVER | `SMCI ▲324% · 1.2K watching`, `PLTR ▲210% · 2.3K watching`, `SOFI ▲167% · 889 watching` | R2, R1 |
| | Most-divisive donut `32% BULLISH / 68% BEARISH · 2.4K opinions` | R3, R1 |
| | `Black belts are watching` avatar row | R8, R1 |
| | `From quiet to loud` sparkline row (IONQ/APP/RIVN/LCID/OKLO) | R2, R1 |
| 03 TICKER · NVDA | `$173.42 ▲4.72% today` | R2 |
| | `826 watching now` + watcher avatars, `4,312 total opinions`, `1.8K members` circle | R1, R7 |
| | `71% BULLISH / 21% BEARISH`, `78% WEIGHTED SIGNAL`, `+14 shift today`, `88% Black Belts`, `#1 Club Rank` | R3, R5 (weighted-signal weighting must not be accuracy-derived) |
| | `Top voices · Highest reputation takes` | R5, R7 |
| 04 CLUB · FEED | Event rail `NVDA Earnings ⏳6d 14h · 1.8K joined`, `Fed Decision · 862`, `Tesla Robotaxi · 1.2K` | R1, R12 |
| | Post cards by `Marcus Hill / Black Belt`, `Tiffany R. / Blue Belt`, reaction counts `👍42 💬17 💡8`, `🔥31 💬12` | R7, R8, R1 |
| | `Kai Insight — Unusual options flow detected $AMD` | **R6** (delete outright), R10 |
| 05 LIVE · CLUB ROOM | `Hosted by Maya & JC · 2.3K in room`, `Photo · hosts on stage` | R7, R1, R13 |
| | `Room sentiment $NVDA 72% BULLISH ▲8% since open`, `34 Changed Bullish / 12 Changed Bearish` | R3, R1 |
| | Reaction counts `🔥128 ❤️89 ⚡64 👀52`, activity ticker entries | R1, R7, R12 |
| 06 WATCH | `28 symbols`, `6 active setups`, `This week: 17 companies`, `4 tickers shifted today` | R1 |
| | Getting-close checklist `Price above 176 ✓`, `Volume expansion ✓`, `Call flow increase ●`, `Est. Trigger: Today` | R2, **R6** (replace the call-flow condition), R11 |
| 07 YOU · PROFILE | `Marcus Hill`, `Top 2% of 25,842 members` | R7, R1 |
| | `87 OPINION SCORE`, `Influence 1.8x — your opinions carry 1.8x more weight` | R5 (confirm the multiplier is not accuracy-weighted) |
| | Strongest areas `Semiconductors Top 4% · AI & Tech Top 7% · Options Top 18%` | R1, **R6** (drop the Options row) |
| | Stat grid `142 Opinions · 71% Accuracy · 382 People Influenced · 47 Changed Minds · 6 Circles Hosted` | **R5** — replace `71% Accuracy` with a participation metric; the other four are shippable metrics with real bindings |
| | `Recent calls — NVDA ✓ +6.4% · TSLA ✗ −2.1%` | **R5** (graded win/loss on member calls is the sharpest performance claim on the canvas) |
| 08 LEARN | Path rows `Markets 101 L6 76%`, `Technical Analysis L4 58%`, `Options Basics L3 42%`, `Fundamentals L2 31%` | R8, **R6** (remove the Options Basics path) |
| | `Reading options flow like a Black Belt · 8 min` | **R6** |
| | `Your streak 🔥16 days in a row` | R8 |
| 09 SPLASH | `trade with your people`, `Reading the room…` | R9 (brand copy — confirm with owner before shipping as product copy) |
| 10 LOGIN | `25,842 members are already reading the room.` | **R1** — this is a marketing claim on a pre-auth screen; either bind to a real count or replace the line |
| | `By continuing you agree to the Terms & Privacy Policy.` / `Not investment advice. Opinions are the Club's, not brokers'.` | **R9 — verbatim from the codebase** |
| 11 PRICING | `$99 /yr`, `$8.25/mo`, `Annual −33%`, plan names, all feature bullets, `Start 7-day free trial`, `Cancel anytime · Billed $99 after trial` | **R9 — verbatim.** The canvas prices are a design placeholder; the shipped ladder is the authority |
| | `Black Belt analytics on your calls` bullet | R5, R9 |
| | `★★★★★ 4.8 · 12K ratings`, `25,842 members in the Club` | **R1** — a fabricated store rating cannot ship |
| | Testimonial `"Kai Watch alone pays for the year. Caught the NVDA break a day early." — DK` | **R1 + R5** — a fabricated testimonial containing a performance claim. Real attributed testimonial or remove the card |
| 12 TICKER · TECHNICALS | **`SELL`—`BUY` meter + `Technical signal: BUY`** | **R4 — the single most important substitution in the archive. Keep the meter; the pole labels and the verdict chip become the `Strong/Solid/Mixed/Weak` vocabulary.** |
| | `8 of 12 indicators bullish`, `RSI 62`, `MACD CROSS ▲`, key levels `R2 196 … S2 158`, `Ascending Triangle`, `Breakout zone 176–178 · 72% historical follow-through`, MA chips, `1.4x rel. volume` | R2, **R11** (the follow-through stat) |
| | `Technicals refresh every 15 min · Not investment advice` | R9 verbatim |
| 13 TICKER · FUNDAMENTALS | `A−`, `Elite grower`, `Top 3% margins · fortress balance sheet`, revenue bars, margins, `34x / 41x / 31x` peers, `Cheaper than AMD…` | R14, R10 |
| | `Fundamentals from latest 10-Q · FY26 = consensus est.` | R9 verbatim |
| 14 TICKER · KAI REPORT | **`Kai's verdict · Accumulate · 82% CONF`** | **R4** (`Accumulate` is a directive) + confidence must be a real model output, not a drawn number |
| | `Call flow surged 3.1x average` / `Institutional sweeps concentrated at the 180–185 strikes for August` | **R6 — delete the whole insight block or replace with an equities flow read** |
| | `Sentiment diverging from price — historically bullish`, `34% concentration risk`, `What would change Kai's mind` list (`Close below S1 (166)`, `guidance under $45B`, `signal falling under 60%`) | R10, R11, R2 |
| 15 DISCOVER · SCREENER | `14 MATCHES`, filter chips, result rows with price + signal %, most bullish/bearish columns, trending `+324% / +188% / …` | R1, R2, R3 |
| 16 CLUB · CIRCLES | Eight circles with countdowns and member counts (`1.8K`, `862`, `1.2K`, `940`, `612`, `505`, `488`, `390`) | **R1** — production has no circles at this density; the founding state is the ship state |
| | `Breakout rooms around one event or thesis. Every Circle expires — 30 days max, then the receipts get graded.` | R9 (product copy — keep, it is a rule statement not a claim) |
| 17 WATCHLIST · CLUB PICKS | `Pick #1 · entered $158.20 · +9.6% since` (and #2, #3) | **R5 + R2** — a published entry price with a running P&L is a track-record claim |
| | Member quotes attributed to `OG / VH / DD`, each `Black Belt` | R7, R8 |
| | `June picks graded: 3W · 1L · avg +7.2%` | **R5** — the strongest track-record claim on the canvas |
| | `Voted by Black Belts · graded at month end` | R8 |
| 18 WATCH · KAI ALERTS | **`BUY SIGNAL` / `SELL SIGNAL` card headers** | **R4** |
| | `Entry zone 173–176, invalidation below 166`, `Kai flags exit into strength above 14.80`, `Consider sizing down` | **R4** — these are instructions to transact |
| | `Call flow 3.1x ✓`, `Put flow rising` | **R6** |
| | `±8.4% implied move` | **R6** (implied move is an options-derived figure) |
| | `Yesterday · BUY SMCI · Triggered · +6.1% since` | **R4 + R5** — a graded alert outcome |
| | `Generated from your watchlist & positions · 6:02 AM`, `3 NEW` | R12, R1 |
| 19 ALERT · VIEW SETUP | `ENTRY 173–176`, `INVALID < 166` chart bands | **R4** — restate as the member's own condition definition (they set it), never as Kai's instruction |
| | `Call flow increase > 2x · 3.1x ✓` | **R6** |
| | `This setup historically: 72% follow-through · 41 triggers` | **R11** |
| | `Price above 176 resistance · 176.20 ✓`, `Volume expansion > 1.3x avg · 1.4x ✓` | R2 |
| 20 LEARN · PATH | `🔥16`, `⚡1,240 XP`, `Unit test · 40 XP`, `XP chest`, `80 XP` | R8 |
| | `Up next · Unit 3 — Options Basics · 6 lessons` | **R6** |
| | `Motion recap`, `Animated scene` nodes | R13 |
| 21 LEARN · MICRO LESSON | Question + four options + `+10 XP` | Content is real curriculum material — shippable. `Animated scene · 12s` is R13; XP is R8 |
| 22 BELTS · RANK SYSTEM | `62% OF CLUB / 21% / 10% / 5% / 1.6% / 0.4%` belt distribution | **R8** — compute or omit |
| | Belt criteria `10 graded calls · 50%+ accuracy`, `40 calls · 58%+`, `100 calls · 62%+ · influence 1.2x`, `250 calls · 66%+`, `500+ calls · 70%+` | **R5** — restate every threshold as participation + consistency, not accuracy |
| | `Keep 70%+ accuracy for 2 more months` | **R5** |
| | Example members `Tiffany R.`, `OptionsOG`, `DeShawn K.` | R7, R6 (handle) |
| | `Rank is earned from graded calls, not follower counts.` | R5 — the sentence itself asserts an accuracy-graded system; rewrite with the substituted criteria |
| 23 INSIDE A CIRCLE | `1,804 members · 312 online`, `152 replies`-class counts, reaction counts | R1 |
| | Posts by `OptionsOG / BB`, `Tiffany R.`, `DataDive`, `DeShawn K.` | R7 |
| | `@OptionsOG what strikes are you playing into the print?`, `implied move is only ±7.8%` | **R6** |
| | `Kai · Circle sentiment moved +6 pts bullish in the last hour · AUTO` | R3, R10 |
| | `HYPERSCALER CAPEX · $B/QTR` chart | R13 |
| | `Checks from Taiwan overnight — CoWoS capacity fully booked through Q2` | R10 (member-authored content; the slot ports, the text does not) |

### `family`

| board | drawn content | rule |
| --- | --- | --- |
| F1 FAMILY HOME | `GM, Hill Family 👋`, `Marcus / Angela / Jaylen · 15` roster with belts | R7, R8 |
| | `Family Level 4`, `⚡340 XP this week`, `2,040 / 3,000 XP`, `160 XP to Level 5`, per-member `⚡12,840 / 6,210 / 1,240` | R8 |
| | Challenge board `Jaylen +2.4% · Marcus +1.8% · Angela +1.2% · S&P +0.9%` | R2 (paper P&L must be real paper-account output), R1 |
| | `🏆 Jaylen leads — winner picks Friday dinner`, `WIN = ⚡+50` | Shippable mechanic; names are R7 |
| | `Kai for kids: "Earnings day is like a report card for a company."` | R10 |
| | `Everyone's learning. Nobody's margin-called.` | **R6** — the tagline references margin. Rewrite |
| F2 TEEN PAPER | `Paper portfolio · started with $10,000` → `$11,240 ▲+12.4% all time` | R2 |
| | **`67% Call accuracy`** | **R5 — on a minor's profile this is the least defensible performance claim in the archive. Replace with lessons/streak/participation.** |
| | `Next belt: Green · 1,240 / 2,000 XP`, trophies with XP | R8 |
| | Guardrail list `Paper trading only`, `Options & margin content hidden`, `Chat limited to Family Circle`, `App locks 9 PM – 7 AM` | **Must be real writes reflecting real settings — never a decorative ON pill.** Audit the schema first; report what does not exist rather than faking it |
| F3 PARENTAL CONTROLS | Every toggle (Money / People / Time), `Daily limit 45 min` | Real writes, as above. `Hide options & leverage content` is the R6 enforcement point |
| | Digest `3h 12m time in app · 6 lessons · +2.4% paper P&L · ⚡220 XP · 0 flags` | R1, R2, R8 — bind or omit the tile |
| | `80% of Jaylen's time was in Learn & the family challenge. 👍` | R10 |
| | Recent-changes log entries `· by Angela`, `· by Marcus` | R7, R12 |
| | `Guardrail changes notify both parents` | Product commitment — ship only if the notification actually sends |
| F4 FAMILY CIRCLE | Chat messages, `is typing…`, timestamps | R7, R12 |
| | `Kai · Mini-lesson: "What's an exit plan?" — 90s, Jaylen's level · ⚡+15` | R10, R8 |
| | `my $NVDA paper call is up 6% since Tuesday` | R2 (paper), R6 (the word "call" here means a stance, not an option — keep, but do not let it drift into options vocabulary) |
| | Live scoreboard `+2.4% / +1.8% / +1.2%` | R2 |
| F5 FAMILY LEARN | Track progress `2/4`, `DONE ⚡+90`, `⚡+30 / step`, `⚡340 Family XP this wk`, `11 lessons together`, `🔥16 week streak` | R8, R1 |
| | `Weekend family quiz · Sat 6 PM` | R12 (real schedule) |
| F6 FAMILY WATCHLIST | Vote tiles (NVDA/AAPL/NIKE/DIS/TSLA), `Cast your vote`, `VOTE = ⚡+10` | Real vote records; R1 below floor |
| | `Marcus ✓ / Angela ✓ / Jaylen…` voter avatars | R7 |
| | `Tonight · 7:00 PM — Kai preps a kid-friendly one-pager an hour before · ⚡+20 each` | R12, R10 |
| | Recently discussed `Discussed Tue / Mon / 4/28` | R12 |
| F7 FAMILY LIVE CLASS | `👥 126 families`, `+12` participants | **R1** |
| | `Video · Coach Taylor on stage`, `Coach Taylor` / `Coach Maya` | R13, R7 |
| | Live poll counts `42 / 31 / 27 / 18` | R1 — real poll results |
| | Up-next sessions `WED 7PM`, `SUN 5PM · Teens: Your First Watchlist · 13+` | R12 |
| F8 PARENT CORNER | Conversation starters, age bands, tips | Real curriculum content — shippable as drawn |
| | `🪙 1,240 earned`, mission XP `⚡150 / 100 / 75`, `2/3` progress, `Completed last week: Grocery Store Economics · all 3 joined · ⚡+120 paid` | R8, R1 |
| F9 TEEN PROGRESS | `LEVEL 9 · Rising Investor`, `⚡2,150 / 2,800 XP`, `16 day streak`, `24 lessons`, `7 badges` | R8 |
| | Skill mastery `85% / 60% / 45% / 70%` | R8 — derive from real lesson completion, not a drawn ring |
| | `Hill Family · FAMILY XP 18,760 · Next level: 22,000` | R8, R7 |

### `club-screens`

| board | drawn content | rule |
| --- | --- | --- |
| all boards | `9:41` status-bar clock | **R12 — do not render device chrome** |
| 01 CLUB · FEED | `12,480 members online` | **R1** |
| | Contributor rail `OptionsOG (LIVE) / ValueHawk / TechTactic / DataDive` | R7, R6 (handle) |
| | Top-in-club `+6.43% / +8.21% / +3.19% / +1.42%` | R2 |
| | `SwingTraderSam — I was wrong about TSLA` + `♡92 💬41` | R7, R1 |
| | `NVDA earnings thread 💚 152 new replies`, `HOOD to the moon? 🚀 89 new replies` | R1 |
| 02 CLUB · DISCUSSIONS | `152 new replies · 41 in thread now` | R1 |
| | Rooms-by-topic tiles: `Semis & AI infra 418 talking`, **`Options desk 262 talking`**, `Macro & rates 193`, `First 100 days 877` | **R6 — the Options desk tile does not ship.** Also R1 on every talker count. (Style note, not content: the plan already rules the four saturated tile colours out — that is a style decision recorded in `CANVAS-V2-ADOPTION-PLAN.md` §0.2, not a DELTA item) |
| | `89 replies · ♡214`, `127 replies · live poll` | R1 |
| 03 CHANGED MY MIND | `SwingTraderSam · 6h · TSLA · BEAR → BULL`, `♡92 💬41` | R7, R1, R12 |
| | `Where the Club updated its thinking` / `strong opinions, loosely held` / `The Club rewards the update, not the ego.` | Product copy — shippable, and worth preserving verbatim |
| | `RESPECT` reaction | Ships as a real reaction type — needs a schema row, not a decorative pill |
| 04 TICKER THREAD | `$1,024.31 · +62.06 (+6.43%)` (a stale pre-split NVDA price) | **R2** |
| | `Bullish 78% / Bearish 15% / Watching 7%` | R3 |
| | Comments by `ChartNerd33`, `LongTermLarry` with `♡124 💬34` | R7, R1 |
| | `Trade` button | **R4** — the app does not route to a transaction from a sentiment surface |
| 05 SHARE YOUR CALL | Stance + post-type controls, `184 / 2,000` counter, `$NVDA` binding | Mechanic ships as drawn. The drafted thesis text is R10 |
| | Post type `Chart` | Ships; `Changed my mind` type must write the same record the R03 destination reads |
| 06 THE LOUNGE | `42 in Main Circle right now`, `+9` avatars | R1 |
| | Messages from `Marcus Bell`, `Priya Nair`, `Sana Okafor`, `TechTactician is typing` | R7, R12 |
| | `Shared research — MI300 adoption curve · +1.16%` | R2, R13 |
| | `Kai flagged the same setup as May '23` | R10, R11 |
| 07 LIVE ROOMS | `Live now · 2,341 in room` | **R1** |
| | `w/ OptionsOG`, `w/ MacroMike` | R7, R6 |
| | `Fed Day Debrief · 58 min · NVDA, TSLA, SOFI` | R12 |
| 08 IN THE ROOM | `2,341 listening · hosted by OptionsOG`, speaker roles | **R1**, R7 |
| | `● LIVE · 41:26` | R12 |
| | `NVDA $1,024.31 · +6.43%` | R2 |
| | Room chat lines | R7 |
| 09 MEMBER PROFILE | `InsightSeeker · Level 9 · Signal Sharer · 1,240 / 2,000 XP` | R7, R8 |
| | Stats `Signals Shared 142 · Upvotes 1,387 · Comments 328 · **Accuracy 74%**` | **R5** — the first three are participation metrics and ship; `Accuracy 74%` does not |
| | Badge grid, watchlist rail | R8, R1 |

---

## Owner decisions this ledger is waiting on

1. **R5 — member performance.** Publishing accuracy is a testimonial/performance claim.
   The canvas puts it on the member profile (71%), the club-screens profile (74%), a minor's
   teen account (67%), the belt criteria (50–70% thresholds), the picks ledger
   (`3W · 1L · avg +7.2%`) and recent calls (`✓ +6.4%`). This lane assumes **substitute with
   conviction/participation everywhere** until ruled otherwise. It is one decision that
   unblocks six boards.
2. **R11 — backtest claims.** `72% historical follow-through · 41 triggers` needs a real
   computed source or the stat line drops.
3. **R9 — pricing.** The canvas draws `$99/yr` with a 7-day trial and a `4.8 · 12K ratings`
   badge. The shipped ladder and the real store rating are the authority; confirm the
   pre-auth member-count line on board 10 can be bound rather than removed.
