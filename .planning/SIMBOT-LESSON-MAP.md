# Simbot ↔ Teens Curriculum — Lesson Dedupe Map (Lane 5)

Each of Simbot's **20** built-in price-action lessons (grouped in 9 stages, stage
8 = optional "Beyond the Basics") mapped against the **teens** platform
curriculum (`fic-teens-foundations`, verified read-only against Supabase project
`zvkercqohmmeyofycbgr`). Where a Simbot lesson overlaps a platform lesson, the
Simbot lesson becomes the **interactive companion**: it deep-links "Read the full
lesson →" back to the platform lesson (`target="_top"`, same-origin), and the
platform lesson gets a "Practice in Simbot" link (snippets in SIMBOT-WIRING.md).
Nothing is deleted from either side — cross-linked, not duplicated.

Deep-link route: `/courses/fic-teens-foundations/{moduleId}/{lessonId}`
(the exact UUIDs live in `public/sim/index.html` → `window.FTA_LESSON_LINKS`).

| # | Simbot id | Stage | Simbot title | → Overlapping platform lesson (teens) | Relationship |
|---|-----------|-------|--------------|----------------------------------------|--------------|
| 1 | `fight` | 0 | Price is a fight | **What Moves a Price: Supply & Demand** (w2l2-supply-demand) | overlap — why price moves (buyers vs sellers) |
| 2 | `time` | 0 | A candle is a slice of time | **Anatomy of a Candlestick** (w2l4-candle-anatomy) | overlap — what a candle is; secondary: Charts & Timeframes (w2l6) |
| 3 | `read` | 0 | Reading a candle | **Reading a Candle: Who Won?** (w2l5-reading-candles) | direct match |
| 4 | `body` | 1 | Big body, big meaning | **Reading a Candle: Who Won?** (w2l5-reading-candles) | overlap — body/close conviction |
| 5 | `doji` | 1 | Wicks are rejection | **Anatomy of a Candlestick** (w2l4-candle-anatomy) | overlap — wick anatomy/rejection |
| 6 | `engulf` | 2 | Two candles, one story | **Chart Patterns & Indicators** (w3l1) | overlap — multi-candle patterns |
| 7 | `pinbar` | 2 | The pin bar | **Chart Patterns & Indicators** (w3l1) | overlap — reversal pattern |
| 8 | `swings` | 3 | Swing highs and swing lows | **Trend Structure: Higher Highs & Higher Lows** (w2l7-trend-structure) | direct match |
| 9 | `trend` | 3 | Trend is a staircase | **Trend Structure: Higher Highs & Higher Lows** (w2l7-trend-structure) | direct match |
| 10 | `range` | 3 | Ranges and breakouts | **When Levels Break: Role Reversal & Breakouts** (w2l9-role-reversal) | overlap — breakouts |
| 11 | `levels` | 4 | Support and resistance | **Support & Resistance: The Floor and the Ceiling** (w2l8-support-resistance) | direct match |
| 12 | `flip` | 4 | The flip | **When Levels Break: Role Reversal & Breakouts** (w2l9-role-reversal) | direct match — role reversal |
| 13 | `fake` | 4 | Real level or coincidence? | **Support & Resistance: The Floor and the Ceiling** (w2l8-support-resistance) | overlap — validating levels |
| 14 | `trendline` | 5 | Drawing a trend line | **Trend Structure: Higher Highs & Higher Lows** (w2l7-trend-structure) | overlap — connecting structure |
| 15 | `stop` | 6 | Where you are wrong | **The 1-2% Rule & Position Sizing** (w5l1) | overlap — stops/risk |
| 16 | `rmultiple` | 6 | Counting in R | **The 1-2% Rule & Position Sizing** (w5l1) | overlap — risk units |
| 17 | `sizing` | 6 | How many shares? | **The 1-2% Rule & Position Sizing** (w5l1) | direct match — position sizing |
| 18 | `checklist` | 7 | Putting it together | **The First-Trade Checklist** (w6l2) | direct match |
| 19 | `replay` | 7 | Practise blind | **Paper Trading Setup** (w6l1) | overlap — deliberate practice |
| 20 | `fvg` | 8 | Fair Value Gaps | — **UNIQUE** — | advanced; no teens equivalent — no cross-link |

## Coverage summary
- **19 of 20** Simbot lessons map to an overlapping teens lesson (companion cross-links live).
- **1 unique**: `fvg` (Fair Value Gaps, stage 8 "Beyond the Basics") — Simbot-only, intentionally not cross-linked.
- Platform lessons that overlap and should get a **"Practice in Simbot"** link (dedupe, other direction): `w2l2-supply-demand`, `w2l4-candle-anatomy`, `w2l5-reading-candles`, `w2l6-charts-timeframes` (opt.), `w2l7-trend-structure`, `w2l8-support-resistance`, `w2l9-role-reversal`, `w3l1`, `w5l1`, `w6l1`, `w6l2`. → snippets in **SIMBOT-WIRING.md**.

## Platform-only lessons (no Simbot equivalent — untouched)
`w1l1` Compounding · `w1l2` How the Stock Market Actually Works · `w2l1-market`
The Stock Market: Buying & Selling · `w2l3-ta-big-idea` TA: The Big Idea ·
`w3l2` Earnings & Catalysts · `w4l1` Calls & Puts · `w4l2` Options Grow/Vaporize ·
`w5l2` Psychology & the Journal. (These are investing/mechanics lessons Simbot's
pure price-action ladder does not cover — no action needed.)

## Notes
- Mapping is by **concept**, not 1:1 slug — several Simbot micro-lessons collapse
  into one broader platform lesson (e.g. `stop`/`rmultiple`/`sizing` → the single
  1-2% Rule lesson). That is deliberate: Simbot teaches these as separate hands-on
  reps; the platform teaches them as one written lesson.
- Deep-links target the **teens** track (the trading-mechanics curriculum that
  overlaps price action). Adult members using Simbot will still see the teens
  lesson link — acceptable, and the teens copy is age-neutral enough. If a future
  adult-track price-action curriculum ships, extend `window.FTA_LESSON_LINKS`.
