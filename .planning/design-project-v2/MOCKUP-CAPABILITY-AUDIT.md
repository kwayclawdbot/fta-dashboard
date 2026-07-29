# Mockup Capability Audit — Cheat Code App (design-project-v2)

Audited 2026-07-28. Primary subject: `cc-app-export-src.html` — the canonical "Cheat Code App" canvas, 23 numbered phone artboards (dark theme, all styles inline). Sibling mockups covered at the end for coverage mapping only.

Reading key for the tables: **element** = what is drawn on the artboard · **implied capability** = the product feature it commits us to · **data it needs** = backend entities/jobs/feeds required to make it real.

---

## Primary canvas: per-artboard audit

### 01 Home — main dashboard, first tab of 5-item nav (Home · Discover · Club · Watch · You)

| Element | Implied capability | Data it needs |
|---|---|---|
| "GM, Marcus 👋" + "MH" avatar | Authenticated user profile, personalized greeting | users table, display name, avatar |
| Bell icon with "12" badge | Notification center with unread counts | notifications table + unread counter |
| "Top in the Club" rail — 5 ranked ticker tiles, each with rank badge (1–5), conviction % (NVDA 78%…PLTR 53%) and green "▲ 6" movement | Live club-wide ticker ranking by "member attention & conviction" (its own subtitle) with rank-change deltas | opinions + watchlist/attention events per ticker → ranking aggregation job, snapshotted so rank deltas can be computed |
| "TODAY IN 30 SECONDS" card with orange play button + one-line summary | Daily generated market briefing with an audio/video player (C6 "briefing" analog) | daily briefing generation job (text + audio asset), publish schedule |
| SPY ▲1.02% / QQQ ▲1.35% / VIX ▼4.21% chips on the briefing card | Index quote strip | market data: index quotes |
| "Your signals" list — NVDA "Kai Watch: Getting Close" (+), TSLA "Earnings in 3 days" (badge 2), SMCI "24 new opinions" (→) | Personalized signal inbox that merges heterogeneous sources: Kai Watch setup state, earnings calendar proximity, opinion-activity spikes on followed tickers | per-user follow/watch list joined against kai_watch setup states, earnings calendar feed, opinion counts per ticker per day; per-row unread badges |
| "See all" on Your signals | Full signals list screen | same feed, paginated |
| "YOU · Black Belt · XP 12,840 / 15,000" progress bar + circular "87 SCORE" ring | Belt rank, XP progression, and a personal opinion score surfaced on home | belts/XP ledger + opinion-score computation (see 07/22) |
| 5-tab bottom nav | App shell: Home / Discover / Club / Watch / You | — |

Theater flags: the ▲ arrows on the ranking tiles are **rank movement**, not price — easy to misbuild as price change. Ticker "logo" letters are colored initials (no logo asset pipeline shown). Everything else on this board is a real feature claim.

### 02 Discover — discovery tab (browse what the Club is watching)

| Element | Implied capability | Data it needs |
|---|---|---|
| Search + filter icon buttons | Ticker/member search, filter sheet | symbol search index |
| "Rising fast — attention over the last 24h" cards: SMCI ▲324%, sparkline, "1.2K watching" | Attention time series per ticker with 24h growth % and watcher counts | attention/watch events per ticker, hourly rollups, sparkline series |
| "Most divisive" card: NFLX 32% bullish / 68% bearish conic ring, avatar stacks, "2.4K opinions" | Divisiveness metric = bull/bear split across opinions, ranked to find the biggest split | opinions with stance per ticker → split computation + divisiveness ranking |
| "Black belts are watching" row of 5 tickers | Belt-filtered attention aggregation (what top-ranked members watch) | watchlist entries joined with member belt |
| "From quiet to loud — names the Club just woke up on": 5 mini sparklines (IONQ, APP, RIVN, LCID, OKLO) | Attention-acceleration detection (low base → spike) | attention series + acceleration/z-score job |
| "See all" links per section | Drill-in list screens per discovery module | paginated variants of the same aggregations |

Theater flags: the avatar stacks beside BULLISH/BEARISH are anonymous grey circles — decorative, not a real "who voted" surface. Sparklines are hand-drawn SVG paths (need real series).

### 03 Ticker · NVDA — ticker detail, Overview (default tab; 12/13/14 are its other tabs)

| Element | Implied capability | Data it needs |
|---|---|---|
| ★ (gold) + ↗ share in header | Add/remove watchlist; share ticker externally | watchlist membership; share links |
| "#1 in the Club ›" chip | Per-ticker club rank, tappable to ranking | ranking aggregation (same as 01) |
| $173.42 ▲4.72% + intraday area chart + 1D/1W/1M/3M/1Y/ALL pills | Quote + historical/intraday chart | market data: quotes + OHLC per timeframe |
| Avatar stack + "826 watching now" | **Realtime presence count on a ticker page** | presence service (who has this ticker open / watching) |
| Avatar pins "TR" "KD" "OG" positioned ON the chart, each ringed in a different belt color (orange/purple/green) | Member takes pinned to the chart timeline — opinions anchored to a timestamp (and implicitly price), rendered with belt-colored rings | opinions with created_at → chart-coordinate mapping; belt color per author. **Decision needed:** this is either a real "takes on the chart" pin system or decoration; as drawn (3 static pins, belt-ringed per board 22's legend) it reads as a real feature |
| "Where the club stands · Raw sentiment": 71% BULLISH / 21% BEARISH with dot clusters | Raw (unweighted) sentiment split per ticker; note 71+21 ≠ 100 → a neutral bucket exists | opinions with stance incl. neutral → split computation |
| Center ring "78% WEIGHTED SIGNAL" (orange conic ring) | **Belt-weighted conviction score** distinct from raw sentiment — the app's core number | opinions × per-member influence weight (belt/accuracy) → weighted aggregation job; weights from belt engine |
| Stat row: "4,312 Total opinions" · "+14 › Shift today" · "88% Black Belts" · "#1 › Club Rank" | Opinion volume, day-over-day sentiment shift, belt-cohort sentiment (% of Black Belts bullish), rank — each tappable | daily sentiment snapshots (for shift), belt-filtered aggregation, rank |
| "Active circle" card: NVDA Earnings · 7 days left · 1.8K members · **Join Circle** button | Ticker↔Circle association + join action from ticker page | circles linked to tickers, membership join |
| "Top voices — highest reputation takes" section header | Reputation-ranked opinion list per ticker | opinions ranked by author reputation/score |

Theater flags: the watcher/member avatar stacks are grey placeholder circles. The dot-cluster "crowd" visualization under 71%/21% is a rendering of real data (dot count ∝ share), not a separate feature.

### 04 Club · Feed — community tab, FEED sub-tab (FEED · CIRCLES · LIVE)

| Element | Implied capability | Data it needs |
|---|---|---|
| Sub-tab bar FEED / CIRCLES / LIVE + "+" compose button | Club section with three surfaces + post creation | — |
| "Happening now" rail: circle cards with ⏳ countdowns (6d 14h / 1d 20h / 10d 3h) and joined counts | Circle discovery inline in feed with live countdowns | circles with expiry timestamps + member counts |
| Composer "What's your take? — Share an opinion, chart, or question" with 📈 🖼 attach icons | Post composer supporting text, chart attachment, image attachment | posts table + media storage + chart-snapshot attachment |
| Opinion post: author + **belt chip** ("Black Belt") + **$NVDA cashtag** + relative time + ··· menu | Feed posts with belt-badged identity and ticker tagging (cashtags link to ticker pages) | posts, author belt join, cashtag→ticker entity linking |
| Reaction row 👍 42 · 💬 17 · 💡 8 · 🔖 | Multi-type reactions, comments, bookmark/save | reactions (typed), comments, bookmarks |
| "Changed my mind" post: badge + stance transition "Bearish → Neutral" + explanation text | **Opinion-revision entity**: a first-class post type recording prior stance → new stance, celebrated in UI | opinion revisions referencing the member's previous tracked stance; renders both states |
| Kai Insight card in-feed: 🐋 "Unusual options flow detected · $AMD ›" | AI-generated system posts injected into the social feed | Kai insight generation (options-flow detection) → feed items with deep link to ticker |

Theater flags: none significant — every element here is a feature claim.

### 05 Live · The Club Room — live room (LIVE sub-tab surface)

| Element | Implied capability | Data it needs |
|---|---|---|
| "LIVE NOW" badge + "Market Open · The Club Room · Hosted by Maya & JC · 2.3K in room" + **Join** | Scheduled/recurring live rooms with hosts and live listener counts | live sessions (schedule, hosts, state), realtime room occupancy |
| Large "Photo · hosts on stage" stage area with host chips, "JC 🎙" mic indicator | **Video (or at least camera-on) stage**, not just audio — with active-speaker indication | live media infra (stage video/audio), speaker state events |
| "Room sentiment" card: $NVDA 72% BULLISH + sparkline + "▲ 8% since open" | **In-room live sentiment poll on a ticker**, tracked as a time series during the session | in-room stance votes → per-room per-ticker series |
| "34 Changed Bullish / 12 Changed Bearish" counters | In-room mind-change events counted live (ties to the opinion-revision entity) | revision events scoped to room + session window |
| Reaction pills 🔥 128 · ❤️ 89 · ⚡ 64 · 👀 52 › + 💬 button | Live emoji reactions with counts; room chat | realtime reaction events, room chat channel |
| Activity feed: "DeShawn K. asked about semis exposure · now", "Aisha L. shared a chart · $SMCI · 1m" | In-room activity stream (questions, chart shares) with cashtags | room events (question, share) with ticker links |

Theater flags: the stage is an explicit placeholder ("Photo · hosts on stage") — media stack unspecified (Zoom SDK per FTA live-sessions arch is the likely reuse). Everything else is real feature surface.

### 06 Watch — watch tab, OVERVIEW sub-tab (OVERVIEW · WATCHLIST · KAI WATCH · ALERTS)

| Element | Implied capability | Data it needs |
|---|---|---|
| 4 sub-tabs + ✕ close | Watch section shell | — |
| "My Watchlist · 28 symbols ›" row | Personal watchlist with count | watchlist entries |
| "Kai Watch · 6 active setups" row with badge "2" | Kai Watch setup inventory with unread/triggered badge | kai_watch setups per user + state changes |
| "Earnings Calendar · This week: 17 companies ›" | Earnings calendar scoped to user's symbols | earnings calendar feed joined to watchlist |
| "Opinion Changes · 4 tickers shifted today ›" | Watchlist-scoped sentiment-shift digest | daily sentiment snapshots filtered to watchlist |
| "Getting close" card: "NVDA Bullish Break · 2/3" ring, checklist "✓ Price above 176 · ✓ Volume expansion · ● Call flow increase", "Est. Trigger: Today" | **Multi-condition setup engine with per-condition live status and a trigger-time estimate** | condition engine evaluating price/volume/options-flow rules in near-realtime; an estimator for "Est. Trigger" (nontrivial — needs a model or heuristic) |
| Second row "TSLA earnings setup · 1/3 conditions · 3 days" | Multiple concurrent setups incl. event-anchored ones | setups keyed to earnings events |

Theater flags: "Est. Trigger: Today" is the one element that implies a predictive model nobody has spec'd — flag as scope risk, not decoration.

### 07 You · Profile — profile tab

| Element | Implied capability | Data it needs |
|---|---|---|
| ⚙ settings | Settings screen | — |
| "Marcus Hill · Black Belt ★ · Top 2% of 25,842 members" | Belt + percentile rank across the whole membership | belt engine + member ranking |
| "87 OPINION SCORE" ring | A single composite reputation score (0–100) | scoring model over graded calls (accuracy, volume, recency) |
| "Influence 1.8x — your opinions carry 1.8x more weight" | **Explicit influence multiplier** feeding the weighted signal (03) | per-member weight derived from belt/score; must be the same number the aggregation job uses |
| "Strongest areas": Semiconductors Top 4% · AI & Tech Top 7% · Options Top 18% | **Per-sector/topic accuracy percentiles** | calls tagged by sector/topic → per-sector grading + percentile ranking |
| Stat row: 142 Opinions · 71% Accuracy · 382 People Influenced · 47 Changed Minds · 6 Circles Hosted | Career stats incl. two social-graph metrics: how many people your takes influenced, and how many mind-changes you caused | graded calls; influence attribution events (who changed stance after reading/interacting with your take — needs an attribution rule); circles hosted count |
| "🔥 Your streak · 16 days in a row" | Daily activity streak | streak ledger |
| "Recent calls": NVDA "Bullish · called the bounce · ✓ +6.4%", TSLA "Bearish · early on the fade · ✗ −2.1%" | **Call grading vs. subsequent price outcome** with win/loss mark and % move | opinions → grading job comparing stance to price change over a defined window |

Theater flags: "382 People Influenced" and "47 Changed Minds" imply an attribution system that is genuinely hard (what counts as influencing someone?) — real feature claim, high spec risk.

### 08 Learn — learn hub (reached from nav; Learn is not in the 5-tab bar on this canvas — likely lives under You/Home entry or replaces a tab in family mode)

| Element | Implied capability | Data it needs |
|---|---|---|
| "Your paths": Markets 101 Level 6 76% · Technical Analysis L4 58% · Options Basics L3 42% · Fundamentals L2 31% | Multiple parallel curricula with levels and completion % | courses/units/lessons + per-user progress |
| "Continue: Reading Earnings Reports · Lesson 5 of 8" | Resume-where-you-left-off | progress pointer |
| "Your streak 🔥 16 days" | Learn streak (shared with 07's streak) | streak ledger |
| "Up next": 🎧 "Why conviction beats prediction · 12 min" · 📖 "Reading options flow like a Black Belt · 8 min" | Mixed-media lesson types (audio + reading) with durations, recommendation queue | content items typed audio/article + recommender (or curated queue) |

Theater flags: none — straight LMS surface.

### 09 Splash — app launch screen

| Element | Implied capability | Data it needs |
|---|---|---|
| Brand mark + "trade with your people" + "Reading the room…" loader | Branded cold-start with data preload ("reading the room" = fetching club state) | bootstrap API |

Pure theater otherwise.

### 10 Login — auth screen

| Element | Implied capability | Data it needs |
|---|---|---|
| "Continue with Apple" / "Continue with Google" | OAuth (Apple required for iOS) | Apple + Google auth providers |
| Email field + "Sign in" | Email auth (magic link or password — unspecified) | email auth flow |
| "25,842 members are already reading the room" | Live member-count social proof | member count endpoint |
| "Join the Club →" | Registration flow | signup |
| "Terms & Privacy… Not investment advice. Opinions are the Club's, not brokers'." | Compliance copy baked into auth | legal pages |

### 11 Pricing — paywall (modal: ✕ + "Restore")

| Element | Implied capability | Data it needs |
|---|---|---|
| "Restore" | Restore purchases (App Store IAP requirement) | IAP receipt validation |
| "Annual −33% / Monthly" toggle | Two billing periods | products/prices (RevenueCat/Stripe) |
| Club Pro $99/yr ($8.25/mo) feature list: weighted signal + full sentiment history · Kai Watch unlimited setups & alerts · every live room + **room replays** · **Black Belt analytics on your calls** · **host your own Circles** | Pro entitlement gates on: weighted signal & history depth, Kai Watch quota, live-room access + replay library, personal call analytics, circle hosting | entitlement flags checked by each subsystem; room recording/replay storage |
| Member (Free) tier: feed, opinions & raw sentiment · **1 Circle** + open live rooms · **3 Kai Watch setups** | Free-tier quotas: 1 circle membership(?)/hosting, 3 setups; raw sentiment visible but weighted signal gated | quota enforcement |
| ★★★★★ 4.8 · 12K ratings · 25,842 members · testimonial card | Social proof modules | ratings snapshot (can be static), member count |
| "Start 7-day free trial · Billed $99 after trial" | Trial subscription | IAP trial config |

Theater flags: ratings block is marketing static. The tier lists are the **entitlement spec** — the gap analysis should treat each ✓ as a gate to implement.

### 12 Ticker · Technicals — ticker detail tab 2 (tabs: Overview · Technicals · Fundamentals · Kai)

| Element | Implied capability | Data it needs |
|---|---|---|
| SELL↔BUY gauge, "Technical signal: BUY · 8 of 12 indicators bullish" | Composite technical signal from a fixed indicator battery | computed indicators (12) per ticker → vote/aggregate |
| RSI · 14D = 62 on a 30/70 scale; MACD "CROSS ▲" | Individual indicator readouts incl. event states (cross) | indicator computation pipeline |
| "Key levels": R2 196 · R1 184 · price · S1 166 · S2 158 | Support/resistance computation | pivot/level calculation from OHLC |
| "Pattern detected: Ascending Triangle · Breakout zone 176–178 · **72% historical follow-through**" | Chart-pattern recognition **plus historical follow-through statistics** | pattern detector + backtest archive of past detections with outcomes |
| MA20/50/200 above/below chips + "1.4x Rel. volume" | Moving-average posture + relative volume | MAs + volume baselines |
| Footer "Technicals refresh every 15 min · Not investment advice" | Stated refresh SLA + compliance line | 15-min recompute job |

Theater flags: none decorative; the pattern-detector + follow-through stat is the heaviest lift here.

### 13 Ticker · Fundamentals — ticker detail tab 3

| Element | Implied capability | Data it needs |
|---|---|---|
| "A−" badge + "Financial health · Elite grower · Top 3% margins · fortress balance sheet" | Fundamental letter-grade scoring model with percentile framing and a label taxonomy | fundamentals dataset → scoring model + peer percentiles |
| Revenue bars $27B FY23 → $61B → $130B → "$184B FY26E" (+114% YoY) | Historical financials **plus consensus estimates** | financial statements feed + consensus estimates feed |
| Margin bars: 75% gross · 62% op · 49% FCF | Margin computation/display | income statement + cash flow data |
| "Valuation vs peers · Fwd P/E": NVDA 34x · AMD 41x · AVGO 31x + line "Cheaper than AMD on forward earnings despite 2x the growth rate." | Peer-set comps **plus generated one-line narrative takeaway** | peer mapping, forward estimates; narrative = template or LLM job |
| Footer "Fundamentals from latest 10-Q · FY26 = consensus est." | Sourcing disclosure | filing-derived data pipeline |

### 14 Ticker · Kai Report — ticker detail tab 4 (the AI surface)

| Element | Implied capability | Data it needs |
|---|---|---|
| 🐋 "Kai's verdict · updated 6:02 AM" → "**Accumulate**" + "82% CONF" ring | Per-ticker AI verdict with confidence, regenerated daily at a fixed time | Kai verdict job (per ticker, scheduled), verdict taxonomy (Accumulate/Hold/…), confidence score |
| Verdict paragraph ("Demand signals continue outrunning supply… one caveat below.") | Generated thesis prose | LLM generation grounded in the evidence below |
| Evidence card: "Call flow surged 3.1x average — institutional sweeps at 180–185 strikes for August" | Options-flow analytics (sweep detection, strike concentration) | options flow feed + analytics |
| Evidence card: "Sentiment diverging from price — Club conviction rising while **short interest** quietly unwinds" | Cross-signal divergence detection mixing **internal club sentiment** with market data | club sentiment series + short-interest feed + divergence logic |
| "34% — Watch: concentration risk — Top 3 customers = 34% of revenue" | Filing-derived risk callouts | 10-K/10-Q customer-concentration extraction |
| "What would change Kai's mind": close below S1 (166) on volume · data-center guidance < $45B · **Club weighted signal falling under 60%** | Falsification conditions attached to the verdict — machine-checkable, referencing technicals, fundamentals guidance, and the club's own weighted signal | stored invalidation conditions monitored by the condition engine; note the AI verdict consumes the club signal (tight coupling) |
| Footer buttons "Set Kai Watch" / "Share report" | One-tap conversion of the report into a monitored setup; shareable report | create kai_watch setup from verdict conditions; share/deeplink |

Theater flags: none — this board is the densest capability claim in the canvas.

### 15 Discover · Screener — screener sub-tab of Discover (FOR YOU · SCREENER · TRENDING)

| Element | Implied capability | Data it needs |
|---|---|---|
| Filter chips "Tech ✕ · Mkt cap > $10B ✕ · Signal > 70% ✕ · + Filter" | Screener whose filter dimensions mix market data (sector, mkt cap) **with the club's weighted signal** | screening engine over market snapshot joined with per-ticker club signal |
| "14 MATCHES · SORTED BY CLUB SIGNAL · Save screen" | Result count, club-signal sort, **saved screens** | saved screen configs per user |
| Result rows: ticker · price · day % · signal % (78/74/71) | Combined quote + signal result list | joined dataset |
| "Club's most bullish" / "Club's most bearish" lists | Signal leaderboards both directions | signal ranking |
| "Trending in the club": 🔥 SMCI +324% · IONQ +188% · … APP −12% | Attention-trend list with negative movers | attention deltas (same series as 02) |

### 16 Club · Circles — CIRCLES sub-tab of Club

| Element | Implied capability | Data it needs |
|---|---|---|
| "+ Start a Circle" | User-created circles (Pro-gated per board 11) | circle creation flow + entitlement check |
| Manifesto line: "Breakout rooms around one event or thesis. **Every Circle expires — 30 days max, then the receipts get graded.**" | Time-boxed groups with hard expiry and a **post-expiry grading job** ("receipts" = calls made inside) | circles with max-30-day TTL; grading job that scores the circle's thesis/calls at expiry |
| Circle rows: name + category tag (Semis/Macro/EV/Thesis/Energy/Health/Crypto) + countdown + member count | Circle directory with taxonomy, live countdowns, member counts | circle metadata, category taxonomy |
| Event-anchored circles (NVDA Earnings, Fed Decision) vs thesis circles (AI Capex Cycle) | Circles optionally bound to a market event date or a free-form thesis | optional event linkage (earnings/Fed calendar) |
| "+ Start yours — 30 days on the clock" card | Creation entry with TTL messaging | — |

### 17 Watchlist · Club Picks — WATCHLIST sub-tab variant showing official picks

| Element | Implied capability | Data it needs |
|---|---|---|
| "Official club picks · JULY — Voted by Black Belts · graded at month end" | **Monthly official pick slate chosen by belt-gated vote, graded on a schedule** | monthly pick election restricted to Black Belts; month-end grading job |
| Pick rows: "Pick #1 · entered $158.20 · +9.6% since" + live price + day % | Entry-price tracking and running P&L per pick | pick entities with entry price/date → performance computation vs live quotes |
| Signal ring per pick (78% / 74% / 66%) | Club weighted signal shown on picks | signal aggregation |
| Attributed quote per pick ("Data-center backlog covers the whole year…" — OG, Black Belt) | Pick rationale authored by a named Black Belt | pick → author take linkage |
| "📊 June picks graded: 3W · 1L · avg +7.2% ›" | Historical pick-grading archive with W/L record | graded past slates, drill-in screen |

### 18 Watch · Kai Alerts — ALERTS sub-tab

| Element | Implied capability | Data it needs |
|---|---|---|
| "🐋 Kai's daily alerts for you — Generated from your watchlist **& positions** · 6:02 AM" + "3 NEW" | Personalized daily alert batch at fixed time; **"positions" implies brokerage/holdings linkage** (only mention of positions in the whole canvas — flag for scope decision, SnapTrade lane exists) | daily alert generation job scoped to user's watchlist (+ positions source if built); unread counts |
| BUY SIGNAL card: "Bullish break setup completed 3 of 3 conditions. Entry zone 173–176, invalidation below 166." + evidence chips "RSI reset ✓ · Call flow 3.1x ✓ · **Club shift +14 ✓**" | Typed alerts (BUY) carrying entry/invalidation levels and mixed evidence incl. club sentiment shift | condition engine results + club sentiment deltas rendered as chips |
| SELL SIGNAL card: distribution pattern, "exit into strength above 14.80", chips "Lower highs ✗ · Club 61% bearish · Put flow rising" | SELL-type alerts with pattern rationale | pattern detection + put-flow analytics + club sentiment |
| HEADS UP card: "Earnings in 3 days. Implied move ±8.4% — the Club flipped 24 opinions this week. Consider sizing down." | Non-directional risk alerts using **options-implied move** + opinion-revision volume | earnings calendar, implied-move calc from options chain, revision counts |
| Per-alert actions: "View setup" / "Share to Club" / "Dismiss" | Alert → setup detail (19); alert → feed post; dismissal state | deep links, share-to-feed composer, per-user alert state |
| "Yesterday — BUY SMCI · Triggered · +6.1% since ›" | **Alert outcome tracking** (performance since trigger) | triggered-alert log + price-since computation |

### 19 Alert · View Setup — Kai Watch setup detail / alert arming

| Element | Implied capability | Data it needs |
|---|---|---|
| Header: "NVDA Bullish Break — Kai Watch setup · created 4 days ago" + "3/3 LIVE" badge | Setup entity with lifecycle (created → conditions filling → live/triggered) | kai_watch setups with state machine |
| Annotated chart: green entry band + dashed levels + red invalidation band + "ENTRY 173–176" / "INVALID < 166" labels + live price dot | Chart rendering with setup levels drawn as zones | OHLC series + setup levels → chart annotation layer |
| Conditions list with live readings: "Price above 176 resistance — 176.20 ✓" · "Volume expansion > 1.3x avg — 1.4x ✓" · "Call flow increase > 2x — 3.1x ✓" | **Realtime condition evaluation showing current measured value against threshold** | condition engine emitting current values, not just booleans |
| "Notify me" toggles: "Push when all conditions hold" (on) · "Invalidation warning (close < 166)" (on) · "**Club sentiment shift ±10 pts**" (off) | Per-setup notification preferences incl. a sentiment-shift trigger — club data as an alertable signal | per-user per-setup notification prefs; push infra; sentiment-delta monitor |
| "📜 This setup historically: 72% follow-through · 41 triggers ›" | Backtested stats for the setup archetype with drill-in | setup-archetype backtest archive |
| Footer: "Alert armed ✓" primary CTA + "Share" | Arm/disarm state; share setup (to Club or externally) | setup arming state, share flow |

### 20 Learn · Path — gamified curriculum path (Duolingo-style)

| Element | Implied capability | Data it needs |
|---|---|---|
| Header chips "🔥 16" streak + "⚡ 1,240 XP" | Streak + XP wallet in learn context | streak + XP ledger |
| "Unit 2 · Markets 101 — Reading Earnings Reports" + "Guide" button | Unit structure with a reference guide per unit | curriculum content |
| Path nodes: ✓ completed ("What moves price", "EPS & revenue") · ★ current ("Guidance > results") · 🔒 locked ("Implied move") · 🏆 "Unit test · 40 XP" · 🎁 "XP chest" · 🎬 "Motion recap" | Node-typed progression: lessons, gated unlock order, unit test with XP reward, loot-style XP chest, **animated video recap node** | lesson graph with node types + unlock rules; XP grants; recap video assets |
| "🔒 Up next · Unit 3 — Options Basics · 6 lessons · 80 XP" | Unit sequencing with XP preview | curriculum ordering |

Theater flags: 🎁 XP chest implies a reward-randomization or claim mechanic — small but real.

### 21 Learn · Micro Lesson — in-lesson quiz screen

| Element | Implied capability | Data it needs |
|---|---|---|
| ✕ close + "3/5" progress | Lesson step progression | lesson step state |
| Prompt "The company beat earnings but the stock dropped 8%. Why?" + "Animated scene · 12s" placeholder ("EPS BEAT ✓ / −8%") | Short animated explainer clip per question | animation/video assets pipeline |
| Answer options A–D (single-select, B highlighted) | Multiple-choice quiz engine with correctness | question bank with answers |
| "+10 XP" + "Check" button | Per-question XP on correct check | XP grant on answer validation |

### 22 Belts · Rank System — belt ladder explainer

| Element | Implied capability | Data it needs |
|---|---|---|
| Manifesto: "Rank is earned from **graded calls**, not follower counts. Your belt travels with you everywhere." | Reputation derives exclusively from call grading; belt is a global profile attribute | grading pipeline as the root input |
| Ladder with quantitative gates: White (joined + first opinion) 62% of club · Yellow (10 graded calls · 50%+ acc) 21% · Green (40 · 58%+ · 1 sector top-25%) 10% · Blue (100 · 62%+ · **influence 1.2x**) 5% · Purple (250 · 66%+ · **hosted a Circle**) 1.6% · Black (500+ · 70%+ · **weighted signal voter**) 0.4% | **Belt engine with explicit promotion criteria** mixing call counts, accuracy thresholds, sector percentiles, influence multiplier milestones, circle hosting, and a Black-Belt-only right: voting weight in the weighted signal (and Club Picks per 17) | belt evaluation job over graded calls + sector percentiles + hosting history; population distribution stats; entitlements per belt |
| "How belts show up": avatar ring = belt color everywhere · Black Belts get the orange live-node dot · belt chip beside name on every post · "🔥×7" streak flair | Global identity rendering rules driven by belt | belt → UI token mapping (the chart pins on 03 use these ring colors) |
| "🎯 Next: Red-stripe Black Belt — keep 70%+ accuracy for 2 more months" | Post-Black progression via **sustained accuracy over time windows** | time-windowed accuracy tracking |

### 23 Inside a Circle — circle interior (chat workspace)

| Element | Implied capability | Data it needs |
|---|---|---|
| Header: circle avatar + "NVDA Earnings · ⏳ 6d 14h · 1,804 members · **312 online**" + 📌 + 👥 | Circle header with countdown, membership, **online presence count**, pinned items, member list | circle metadata + presence + pins |
| Channel bar: **# takes · # charts · # receipts · 🔊 live** | Multi-channel structure per circle incl. an audio ("live") channel — Discord-shaped | channels per circle; voice channel infra |
| "📌 Circle thesis: Blackwell demand > guidance. **Graded at close on ER day.** ›" | Pinned thesis entity with a grading date bound to the market event — the object the expiry grading job (16) scores | thesis entity + grade schedule |
| Messages: author + belt chip ("BB") + timestamp + body with $NVDA cashtag | Belt-badged chat with ticker linking | messages, belt join, entity linking |
| Reactions on messages: 🔥 24 · 🐂 18 · 💡 7 (note 🐂 = bull-stance reaction) | Typed reactions incl. stance-flavored ones | reaction types |
| "↩ 6 replies · last 2m ago" | Threaded replies with recency | message threads |
| DataDive message with embedded "HYPERSCALER CAPEX · $B/QTR" bar chart | Chart/image posts inside circle chat | media attachments (chart images) |
| 🐋 "Kai · Circle sentiment moved **+6 pts bullish** in the last hour · AUTO" | **Kai bot auto-posting per-circle sentiment moves** — circle-scoped sentiment series + automated system messages | circle-scoped stance tracking, hourly delta detection, bot posting |
| "@OptionsOG what strikes are you playing…" + "OptionsOG is typing…" | @mentions + typing indicators | mention notifications, realtime typing events |
| Composer: "+ · Message # takes · 📈 · ➤" | Channel-scoped composer with chart attach | — |

Theater flags: the capex bar chart is a hand-drawn placeholder (real feature = chart attachment, not auto-charting). Everything else is feature surface.

---

## Sibling mockups — coverage map

### Cheat Code App.dc.html
Screens: identical 23 artboards, identical labels (01 Home … 23 Inside Circle). Relation: this is the designer-canvas source of the primary; `cc-app-export-src.html` is its export — same content, no separate audit needed.

### Cheat Code App Light.dc.html
Screens: the same 23 artboards (01 Home … 23 Inside Circle), light theme. Relation: light-theme twin of the primary canvas — no new functionality, doubles the theming requirement (light + dark tokens for every surface above).

### Cheat Code Family.dc.html
Screens: F1 Family Home · F2 Teen Account (paper) · F3 Parental Controls · F4 Family Circle · F5 Family Learn · F6 Family Watchlist · F7 Live Class · F8 Parent Corner · F9 Teen Progress. Relation: warm-register Family Mode variant of home/learn/circle/watch/live for supervised households — reuses belts/XP/streaks/circles/Kai, and **adds** capabilities absent from the primary canvas: paper-trading portfolios ($10k simulator), parental guardrails with audit log (content filters, chat scoping, follow approvals, downtime/daily limits, weekly digest), a never-expiring private family circle, family voting on the watchlist, family missions/challenges (beat the S&P), and kid-register Kai.

### Cheat Code 5-Day Challenge.dc.html
Screens: 1 Minute-0 Confirmation · 1B Questionnaire · 2 Day-0 First Win · 3 August HQ · 4 Cohort Forming · 6 Challenge Day 1 · 6 Day-3 Offer · 6B Day-4 Screener · 6C Day-5 Routine · 7 Finisher. Relation: the Sept 1 challenge acquisition/activation journey (free, no card) layered on the primary app's XP/streak/community systems — signup → first-win mission → August pre-season HQ (simulator rep, weekly beats, pre-season badge) → cohort countdown w/ SMS arming → Day 1 mission + cohort leaderboard → Day-3 soft pitch (the conversion event).

### Cheat Code Challenge Days.dc.html
Screens: 15 artboards, D1–D5 each as Brief → Do → Share. Relation: the five challenge missions as guided 3-step flows that manufacture the primary app's core entities — D1 builds a watchlist from brands you use, D2 produces a Kai-graded research card that becomes a **tracked opinion**, D3 runs the community vote that elects a Cohort Pick (Club Picks precursor), D4 = screener day, D5 = routine day; each Share step posts an artifact to the feed for XP.

### Club Screens.dc.html
Screens: 01 Club Feed · 02 Club Discussions · 03 Changed My Mind · 04 Ticker Thread · 05 Share Your Call (composer) · 06 The Lounge · 07 Live Rooms · 08 In the Room · 09 Member Profile. Relation: earlier/alternate iteration of the primary's community surfaces (maps to boards 03/04/05/07) with a different nav (Discover · Home · Live · Learn · Profile); its unique extra detail is the full **opinion composer** — stance selector (Bearish/Neutral/Bullish), post types (Thesis / Risk / Chart / Changed my mind), character limit, draft saving — plus topic rooms, live-room replays/reminders, and a badge-based profile that predates the belt system.

### Cheat Code Directions.dc.html
Screens: brand-direction turns 2–9 (day/night theme pair; 8 type/palette directions; 4+10 loud type studies; 5 marker-ink directions; two-ink systems 8a–8c; full-saturation 9a–9c) rendered on a repeated home-card collage. Relation: pure visual-direction exploration for the same app — no functionality beyond what the primary canvas already implies; not an input to the gap analysis.

### boards/
54 PNG exports (dark-r*, light-r*, family-r*, club-r*, challenge-r*, days-r*) — raster grabs of the canvases above; no additional screens.

---

## Capability rollup

Deduplicated master list of every distinct backend capability the primary canvas implies. Artboard numbers refer to the primary canvas.

### Opinions / conviction system
- **Opinion entity with stance (bullish/neutral/bearish), ticker tag, prose, media** — the atomic unit everything aggregates. (03, 04, 07, 23)
- **Opinion-revision entity ("Changed my mind")**: prior stance → new stance with rationale, first-class post type, counted everywhere (feed badge, room counters, watch digest, profile stat). (01, 04, 05, 06, 07, 18)
- **Call grading job**: stance vs. subsequent price move over a defined window → ✓/✗ + % outcome; root input to belts, scores, picks and circle receipts. (07, 17, 22)
- **Influence attribution**: "382 People Influenced", "47 Changed Minds" — rules for crediting a member when others adopt/flip after their take. High spec risk. (07)
- **Opinion composer** with attachment types; sibling Club Screens adds the full spec (post types Thesis/Risk/Chart/Changed-my-mind, drafts, char limit). (04)

### Signals / aggregation
- **Raw sentiment split per ticker** (bull/neutral/bear %, opinion counts). (02, 03, 15)
- **Weighted signal per ticker**: opinions × member influence weight (belt/accuracy) → the 78% ring; Black Belts are explicitly "weighted signal voters". Pro-gated with history. (01, 03, 11, 14, 15, 17, 22)
- **Daily sentiment snapshots + shift deltas** ("+14 shift today", "4 tickers shifted today", "Club shift +14 ✓" as alert evidence, "±10 pts" as alert trigger). (03, 06, 18, 19)
- **Belt-cohort aggregation** ("88% Black Belts", "Black belts are watching"). (02, 03)
- **Attention ranking + acceleration**: club-wide ranked rail with rank deltas, 24h "rising fast" %, "quiet to loud" detection, trending lists with negative movers. (01, 02, 15)
- **Divisiveness metric** (biggest bull/bear split). (02)
- **Circle-scoped and room-scoped sentiment series** (hourly deltas in circles, since-open series in rooms). (05, 23)

### Circles (time-boxed rooms)
- **Circle entity**: name, category taxonomy, optional event anchor (earnings/Fed), member count, 30-day max TTL with live countdown. (03, 04, 16, 23)
- **Circle lifecycle + expiry grading job**: "receipts get graded" — thesis + member calls scored at expiry / event close. (16, 23)
- **Pinned circle thesis** with grade date. (23)
- **Multi-channel structure per circle** (# takes / # charts / # receipts / 🔊 live voice channel). (23)
- **Circle chat**: belt-badged messages, typed reactions (incl. 🐂 stance reaction), threads, @mentions, typing indicators, chart/image posts, Kai bot auto-posts. (23)
- **Hosting**: user-created circles, Pro-gated; hosting feeds belt criteria. (11, 16, 22)
- **Membership quotas**: Free = 1 Circle. (11)

### Live rooms
- **Scheduled live rooms** with hosts, join, live occupancy counts (2.3K in room). (04, 05, 11)
- **Stage with video/camera + active-speaker indication**. (05)
- **In-room live sentiment polling** per ticker with time series + mind-change counters. (05)
- **Live emoji reactions + room chat + activity stream** (questions, chart shares). (05)
- **Room replays** (Pro entitlement; sibling Club Screens draws the replay library + reminders). (11)

### Kai AI surface (verdicts, watches, alerts, condition engine)
- **Per-ticker Kai verdict job**: daily scheduled (6:02 AM), verdict taxonomy + confidence %, generated thesis prose, evidence cards, filing-derived risk callouts, "what would change Kai's mind" falsification conditions that reference both market data and the club's weighted signal. (14)
- **Kai insight feed items**: auto-generated posts (unusual options flow) injected into the social feed and circles. (04, 23)
- **Kai daily alert batch**: personalized from watchlist (& "positions" — flag: implies holdings link, only mention in canvas), typed BUY / SELL / HEADS UP, entry zone + invalidation levels, evidence chips mixing technicals, options flow and club shifts, implied-move callouts, dismiss/share actions. (18)
- **Alert outcome tracking**: triggered log + performance-since-trigger. (18)
- **Condition engine**: multi-condition setups evaluated in near-realtime with current measured values vs thresholds (price levels, volume multiples, options-flow multiples, club-sentiment deltas), state machine (created → n/m → live/triggered → invalidated), "Est. Trigger" estimate (scope risk). (06, 14, 18, 19)
- **Setup-archetype backtests**: "72% historical follow-through · 41 triggers". (12, 19)

### Watch / setups / alert arming
- **Personal watchlist** (add via ★, counts, drives Kai alerts + earnings calendar scoping). (01, 03, 06, 18)
- **Kai Watch setup inventory** with per-user quota (Free 3 / Pro unlimited) and badges. (06, 11, 14, 19)
- **Setup detail with annotated chart** (entry/invalidation zones drawn on price). (19)
- **Per-setup notification preferences** (all-conditions push, invalidation warning, sentiment-shift trigger) + arm/disarm. (19)
- **Watchlist-scoped digests**: earnings calendar (17 this week), opinion changes. (06)
- **Official Club Picks**: monthly slate voted by Black Belts, entry-price P&L tracking, attributed rationale quotes, month-end grading with W/L archive. (17)

### Belts / reputation / influence
- **Belt engine** with explicit promotion gates (call counts, accuracy thresholds, sector top-25%, influence milestones, circle hosting, sustained-accuracy stripes) + club-wide distribution stats. (22)
- **Opinion score (0–100)** composite + member percentile ("Top 2% of 25,842"). (01, 07)
- **Influence multiplier (e.g. 1.8x)** — the exact weight consumed by the weighted-signal aggregation. (07, 22)
- **Per-sector accuracy percentiles** ("Semiconductors Top 4%"). (07, 22)
- **Belt rendering rules everywhere**: avatar ring color, belt chip on posts, Black-Belt orange live dot, streak flair — incl. belt-colored pins on ticker charts. (03, 04, 22, 23)
- **Belt-gated rights**: weighted-signal voting, Club Picks voting. (17, 22)

### Learn / XP
- **Multi-path curriculum** (4 paths × levels × % complete), unit/lesson graph with node types (lesson, unit test, XP chest, motion recap), unlock ordering. (08, 20)
- **Quiz engine**: multi-step micro lessons, MCQ with check, per-question XP, animated scene assets. (21)
- **Mixed-media content**: audio lessons, readings, animated recaps with durations. (08, 20, 21)
- **XP ledger** (grants from lessons, tests, chests) + **daily streak** shared across learn/app. (01, 07, 08, 20, 21)

### Presence / realtime
- **Per-ticker presence** ("826 watching now"). (03)
- **Per-circle online counts** ("312 online") + typing indicators. (23)
- **Live room occupancy + realtime reactions/chat/speaker events**. (05)
- **Live member-count** on login. (10)
- **Realtime feed/badge updates** (unread counts, "3 NEW"). (01, 06, 18)

### Market data (quotes, technicals, fundamentals, options flow)
- **Quotes + intraday/historical OHLC** with timeframe switching; index quotes (SPY/QQQ/VIX). (01, 03, 12, 15, 17, 19)
- **Technicals pipeline** (15-min refresh): 12-indicator battery + composite BUY/SELL gauge, RSI, MACD cross, MA20/50/200 posture, relative volume, support/resistance levels, chart-pattern detection with historical follow-through stats. (12, 19)
- **Fundamentals pipeline**: financial statements from filings, consensus estimates, margin computation, health letter-grade model, peer comps (fwd P/E) with generated narrative, customer-concentration extraction. (13, 14)
- **Options analytics**: unusual-flow / sweep detection, call/put flow multiples, strike concentration, implied move. (04, 06, 14, 18, 19)
- **Short interest feed**. (14)
- **Earnings/macro event calendar** (earnings dates, Fed decision) feeding signals, circles, alerts. (01, 06, 16, 18)

### Social feed
- **Club feed** with composer (text/chart/image), cashtag→ticker linking, belt-badged authors, typed reactions, comments, bookmarks, ··· moderation menu. (04)
- **Post types** incl. Changed-my-mind and Kai system posts. (04)
- **Share-to-Club** from alerts/reports; external share of tickers/reports/setups. (03, 14, 18, 19)
- **Top voices**: reputation-ranked takes per ticker. (03)
- **Notification center** (bell + unread). (01)

### Pricing / Pro tier
- **Auth**: Apple/Google OAuth + email; registration; compliance copy. (10)
- **Subscription**: Club Pro $99/yr (or monthly), 7-day trial, restore purchases (IAP), cancel anytime. (11)
- **Entitlement gates**: weighted signal + sentiment history (Pro) vs raw sentiment (Free); Kai Watch quota 3 vs unlimited; live-room access + replays; "Black Belt analytics on your calls"; circle hosting; Free = 1 Circle. Every gate must be enforced by the owning subsystem. (11)
- **Social proof data**: member count, ratings snapshot, testimonials. (10, 11)

Cross-cutting flags for the gap analysis: (1) the weighted signal, influence multiplier, and belt engine are one tightly-coupled loop (grading → belt → weight → signal → Kai verdict/alerts consume signal) and must be designed together; (2) "positions" on board 18 and "Est. Trigger" on board 06 are the two elements that imply systems nobody has spec'd (brokerage link, trigger-time prediction); (3) "People Influenced / Changed Minds" attribution needs a definition before it can exist; (4) the Light canvas doubles theming work but adds zero capabilities; (5) Family mode (sibling) adds paper trading + parental-controls subsystems entirely absent from the primary canvas.
