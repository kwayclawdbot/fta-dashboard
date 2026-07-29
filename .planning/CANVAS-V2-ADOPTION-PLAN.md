# Canvas v2 — full app adoption plan

**Source of truth:** `.planning/design-project-v2/` — `Cheat Code App.dc.html` (dark),
`Cheat Code App Light.dc.html` (light), `Cheat Code Family.dc.html`, `Club Screens.dc.html`,
`Cheat Code Directions.dc.html`. Standalone twins on Desktop are byte-identical renders
(1600×7732 / 1600×3102) — same content, inlined assets.

**Status of the app today:** the light-primary redesign shipped to production 2026-07-27
(commits `652f731`, `a8a489c`). This plan is the *next* pass — adopting the canvas UI/UX
across every surface. It is additive to the shipped system, not a replacement of it.

---

## 0. BINDING RULES (violating any of these fails review)

### 0.1 Compliance — non-negotiable
- **NEVER render a directive verdict.** The canvas draws a `BUY` badge on
  `Ticker · Technicals`. **Do not implement it.** The shipped scorecard uses
  `Strong / Solid / Mixed / Weak` (`src/lib/research/grades.ts:510`) and
  `grades.test.ts` asserts it never uses "buy". If a strength read is needed next to
  price, use the existing verdict vocabulary or `Bullish / Neutral / Bearish` as a
  **community stance**, never as the app's own instruction.
  - The one legitimate `BUY` is `simulator/page.tsx:269` — a chart marker for the
    member's own filled paper order, paired with `SHORT`. **Leave it alone.**
- **No options content in Club surfaces.** The canvas shows an "Options desk" room,
  "Options Basics" in Learn, and options post types. Equities-only was the decision.
  Family Mode explicitly hides options/leverage — keep that.
- **Member performance is a claim.** The canvas shows `Accuracy 74%` on profiles and
  `Call accuracy 67%` on teen accounts. Publishing member accuracy is testimonial /
  performance-claim territory. Ship **conviction and participation** unless the owner
  explicitly rules otherwise. Flag, do not assume.
- **Preserve every disclaimer verbatim.** `NEWS_DISCLAIMER`, `COMMUNITY_DISCLAIMER`,
  `TRENDING_DISCLAIMER`, pricing/upgrade terms. Restyle only.

### 0.2 Colour law (already shipped — do not regress)
```
green/red = PRICE only      lime = COMMUNITY SENTIMENT only
orange    = BRAND + ACTION  kai blue = Kai/AI only
```
- **Price never sits on an orange field.** Proven illegible three times.
- **Purple is dropped from the system** (R1 decision). The canvas uses a purple
  "Options desk" tile — do not adopt.
- The canvas's four saturated room tiles (green/purple/orange/blue) compete with price
  semantics. Use ONE accent + type weight to differentiate rooms instead.

### 0.3 Token gotchas (each cost a lane to rediscover — do not repeat)
- `text-volt-*` is **frozen** across themes (~2.5:1 on dark). In club mode the **gold ramp
  IS volt orange and it flips** → use `text-gold-600/700` for orange TEXT. Orange FILLS
  keep `bg-volt-500`.
- Price colour: `text-price-up` / `text-price-down`. **Never** write a `dark:` variant.
- `globals.css` has **no `@layer`** → `.f0-ledger-row` beats Tailwind utilities.
  `items-start` on a row silently does nothing; use `self-*` on children.
  Resting padding is `--f0-row-pad`.
- Never `text-ink` on a white/orange/kai fill (flips near-white in dark) → `text-night-950`.
- Standalone hairlines: `f0-rule-top` / `-bottom` / `-left`, `f0-frame`. Not bare `border-sand`.

### 0.4 Loading ≠ empty
The original defect: components rendered their founding branch while a client fetch was
in flight. Every surface must distinguish **loading** (skeleton) from **empty** (designed
founding state). `useClubData` accepts a server `seed`; prefer seeding over client fetch.

### 0.5 Founding state is mandatory, not optional
Every canvas screen is drawn at scale — `26,480 members`, `2,341 listening`,
`126 families`, `12,480 online`, `152 replies`. **Production is 9 tickers with 1–2
participants each and 3 positioned posts.** Every adopted screen ships with a designed
below-floor state or it does not ship.

---

## 1. WHAT THE CANVAS ADDS (gap analysis vs shipped)

### 1.1 New destinations that do not exist today
| Surface | Canvas ref | Notes |
| --- | --- | --- |
| **Changed My Mind** (destination) | Club Screens 03 | `ChangedMyMind.tsx` exists but is buried in the ticker page. Canvas makes it a tab with a **RESPECT** reaction and the line "The Club rewards the update, not the ego." Strongest single idea in the archive. |
| **Belts / Rank system** | App 22 | White→Yellow→Green→Blue→Purple→Black. Belt data exists (`beltForXp`, `BeltBadge`); there is no screen. NOTE: belt purple is a *belt colour*, not UI chrome — allowed. |
| **Circles** | App 19, Family F4 | Sub-groupings of the Club. Not in the build at all. |
| **Rooms by topic** | Club Screens 02 | Semis & AI Infra / Macro & rates / First 100 days, each with live talker counts. Today the Lounge is undifferentiated. |
| **Kai Report** (ticker tab) | App 14 | Canvas ticker tabs = Overview·Technicals·Fundamentals·**Kai Report**. We shipped …·**News**. Consider Kai Report as a 5th tab. |
| **Learn Path** (journey visual) | App 20 | Winding node path. We have a Journey tab, not the visual. |
| **Micro-lesson** | App 21 | "The company beat earnings but the stock dropped 8%. Why?" + choices. |

### 1.2 Structured contribution (replaces the generic composer)
Canvas `Club Screens 05`: post requires a **stance** (Bearish/Neutral/Bullish) and a
**type** (THESIS / RISK / CHART / CHANGED MY MIND), with a 2,000-char body and `$TICKER`
binding. Today `ResearchObjectCompose` is a text box. This is the highest-leverage
community change after Changed My Mind.

### 1.3 Ticker tile
Black rounded square, letter mark, delta beneath. Compact, distinctive, reusable at any
density. Better than logo+row for dense "top in the club" strips. Adopt as a primitive.

### 1.4 Family Mode — the standout, build this first
`Cheat Code Family.dc.html` is a product spec, not a skin:
- **Guardrails** (F3): paper-only, hide options & leverage, chat limited to Family Circle,
  approve who they follow, live rooms listen-only, downtime 9PM–7AM, daily limit.
  **"Guardrail changes notify both parents."**
- **Parent digest**: time in app, lessons, paper P&L, XP earned, flags.
- **Family Challenge** (F1): beat the S&P on paper; winner picks Friday dinner.
  Stakes that are not money.
- **Family Watchlist vote** (F6): "Which company should we learn about tonight?" with
  cast-your-vote avatars → Kai preps a kid-friendly one-pager.
- **Parent Corner** (F8): age-banded tips (6–8 / 9–12 / 13+), conversation starters.
- **Family missions** paying XP to every member.
- Register: warm gold-orange, **no purple** — the canvas already honours this.

### 1.5 Deliberate divergence — radial gauges
The canvas leans hard on donuts/dials (68/32, 78, skill rings, belt arcs). We chose one
cream arc for club score and bars/numerals elsewhere. **Recommendation: keep our
restraint.** Most canvas gauges encode a single number a bar carries more legibly, and
stacked beside price data they compete. Keep the gauge for **club sentiment** only.

---

## 2. EXECUTION LANES

Foundation first — it is singular. Then surfaces in parallel.

### L0 — Foundation (blocking; one agent, must land before the rest)
- `TickerTile` primitive (1.3).
- `StanceControl` + `PostTypeControl` primitives (1.2).
- `RespectAction` (the Changed-My-Mind reaction).
- Any new f0/club2 CSS the canvas needs — **only this lane may edit `globals.css`**.
- Do NOT add gauges beyond the existing score dial.

### L1 — Family Mode (highest value; build from `Cheat Code Family.dc.html`)
F1 Family Home · F2 Teen paper account · F3 Parental controls · F4 Family Circle ·
F5 Family Learn · F6 Family Watchlist vote · F7 Family live class · F8 Parent Corner ·
F9 Teen progress. Warm gold, no purple. Guardrails must be **real writes**, not UI —
audit the schema first and report what does not exist rather than faking it.

### L2 — Community: Changed My Mind + structured contribution
Promote `ChangedMyMind` to a destination with RESPECT. Rebuild the composer to require
stance + type. Rooms by topic (single accent, not four).

### L3 — Ticker: Kai Report tab + tile adoption
Add Kai Report as a 5th tab. **Do not add a BUY badge.** Adopt `TickerTile`.

### L4 — Belts + Circles destinations
Belt ladder screen from real `xp_events`; Circles if the schema supports it, otherwise
report the gap — do not invent tables.

### L5 — Learn: path visual + micro-lesson
Journey node path, micro-lesson format. Preserve all progress/XP writes.

### L6 — Pre-auth: Splash / Login / Pricing
Canvas designs these; we only restyled pricing. **Commercial copy verbatim.**

---

## 3. DEFINITION OF DONE (per lane)
1. `npx tsc --noEmit -p tsconfig.json` clean.
2. `npx next build` compiles.
3. Grep own files: no `paper-card`, no `bg-card` content boxes, no equal-column CONTENT
   grids, no `bg-white`/`text-black`, no `dark:text-volt-*`, no hex in classNames.
4. **Both themes verified** at 390px in a real browser — not just compiled.
5. Founding/below-floor state designed and screenshotted.
6. Loading state distinct from empty state.
7. Every disclaimer and commercial string byte-identical to before.

## 4. KNOWN OPEN ITEMS CARRIED FORWARD
- `briefCore` is the sole long pole (~2.9s), gating the whole board. Its own Suspense
  boundary is the next real speed win.
- Only **Home** was visually verified after the redesign; 7 surfaces built but unexamined.
- No market-calendar source → ActionBand slot P3 permanently empty.
- `club_missions` (migrations 180/181) live only on unmerged `lane/canvas-rebuild-a`.
- `~/Downloads` is TCC-blocked for Terminal.app; stage files via `~/Desktop`.
