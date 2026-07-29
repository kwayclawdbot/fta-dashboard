# ui-v3 Design Grammar

Written from the one screen actually translated so far — **"01 Home"** — element by
element. Every value below is a real px/token in `src/ui-v3`, not an aspiration.
When the next screen is translated, this file gets amended from *that* artboard;
it is never extended by invention.

---

## 1. Type voices

Four families. Each has a job, and the jobs do not overlap.

| Voice | Family | Where it is allowed | Concrete uses on Home |
| --- | --- | --- | --- |
| **Display** | `--font-display` Barlow Condensed, **italic**, 700–800, uppercase | Brand and screen identity only. Never body copy, never data. | Wordmark 19px/800/`.02em`; `ScreenPlaceholder` name 26px/800/`.04em` |
| **Body** | `--font-body` Instrument Sans, 400–800 | Human sentences, headings, and any number a person *reads* rather than *scans*. | Greeting 26px/700/`-.02em`; subtitle 13px `--text-dim`; panel headline 14.5px/700/lh 1.3; brief line 12px/500; signal text 12px `--text-dim`; caption 10.5px `--text-faint`; conviction 11px/700; "See all" 11px/600 |
| **Mono** | `--font-mono` IBM Plex Mono, 400–600 | Machine truth: tickers, deltas, quotes, XP, and every section eyebrow. | Eyebrow 9.5px/600/`.16em`/uppercase; strip ticker 10px/600; row ticker 11px/600; delta 9px; index chip 9.5px; XP line 10px; ring value 13px/600 |
| **Script** | `--font-script` Kaushan | Section marks on other artboards. **Unused on Home** — do not introduce it here. | — |

Numerals that sit in a column or want to line up carry `data-numeric`, which opts
into `tabular-nums` (base.css). Prose numbers do not.

---

## 2. Spacing rhythm

The screen is built on an **18px gutter** and a small set of vertical steps.
There is no 8pt grid — the artboards use odd values deliberately, and they are
preserved.

- **Gutter:** `--space-18` left/right/top of the content well. The Top-in-the-Club
  strip is the one element that bleeds past it (`margin-inline: -18px` +
  matching padding) so it can scroll to the screen edge.
- **Section separation:** `--space-16` before a section that opens with an
  eyebrow; `--space-14` before a gradient panel.
- **Inside a section head:** eyebrow → caption `--space-3`; head → content
  `--space-10` (rows) or `--space-11` (strip, of which 7px is pip clearance).
- **Between siblings:** signal rows `--space-7`; strip cards `--space-9`; top-bar
  actions `--space-12`; brand lockup `--space-9`.
- **Inside containers:** signal row `10px 12px`; strip card `9px 0`; brief panel
  `14px 15px`; YOU panel `13px 15px`; nav `10px 8px 16px`.

---

## 3. Radius scale

Radius encodes size class, not decoration. Larger container → larger radius.

| Token | Applied to |
| --- | --- |
| `--radius-6` | Index chip |
| `--radius-8` | Small ticker tile (26px), notification badge, count pill |
| `--radius-10` | Large ticker tile (34px), YOU diamond mark |
| `--radius-12` | Signal row |
| `--radius-14` | Top-in-the-Club card |
| `--radius-16` | Gradient panel (both tones) |
| `--radius-full` | Brand mark, avatar, rank pip, play button, signal ring |
| `--radius-2/3` | Knockout glyphs, progress bar and its fill |

`--radius-34` exists in the tokens because the mockup **board** draws each screen
as a phone card. That frame is presentation of the artboard, not app chrome, and
is deliberately **not** reproduced.

---

## 4. Where `--accent` is permitted

Accent (`#FF7A1A`, identical in both themes) is **rationed**. On the whole Home
screen it appears in exactly these roles:

1. **Brand** — the mark disc, the "Club" eyebrow, the YOU diamond.
2. **The single accent run inside an eyebrow** — "TOP IN *the club*". One run per eyebrow, maximum.
3. **Lead state** — rank 1 only: accent border + `0 0 12px rgba(255,122,26,.18)` halo + accent pip. Ranks 2–5 are `--surface-2`.
4. **The one primary action in a region** — "See all", the play button.
5. **Live counts** — notification badge, signal count pill. Both on `--accent-on` text.
6. **Progress** — the XP bar fill (`linear-gradient(90deg, var(--accent), #FFB25E)`) and the ring's filled arc.
7. **The active nav slot** — glyph + label, weight bumped to 700.

Accent is **never** a body text color, **never** a surface fill behind reading
text, and **never** applied to more than one element in the same row. Market truth
uses `--positive` / `--negative`; everything else is the neutral text ramp
(`--text` → `--text-muted` → `--text-dim` → `--text-faint`).

Glyphs *knocked out* of an accent shape use `var(--bg)` (brand diamond, play
triangle). Text *sitting on* accent uses `var(--accent-on)` (badges, pills, rank-1
pip). These are different tokens in light theme — do not swap them.

---

## 5. Card and panel patterns

Only two container treatments exist. There is no third.

**Flat card** — `--surface` + `1px solid --border` + a radius from §3. No shadow,
ever. Used by the strip card and the signal row.

**Gradient panel** (`GradientPanel`) — a warm diagonal wash + `1px solid
--accent-soft` + `--radius-16`. Exactly two tones, both from the artboards:

- `brief` — `linear-gradient(120deg, #2A1208, #1A0E12 55%, #17141A)` (light: `#FFE9D6 → #FFF1E4 55% → #FFFFFF`)
- `you` — `linear-gradient(110deg, #241009, #17141A 70%)` (light: `#FFEEDD → #FFFFFF 70%`)

These stops have no semantic token — they are one-off washes — so they live as
theme-scoped custom properties inside `GradientPanel.module.css` and nowhere else.

**Shadows are halos, not elevation.** `--shadow-1..3` are all
`0 0 Npx rgba(255,122,26,…)`. Nothing on this screen is lifted off the page.

---

## 6. Eyebrow / section-header pattern

`SectionEyebrow` is the only way a section opens:

```
mono · 9.5px · 600 · .16em · uppercase · --text
  [optional] one <EyebrowAccent> run
  [optional] right-aligned action, 11px/600/--accent, same baseline
  [optional] caption, 10.5px/--text-faint, 3px beneath
```

---

## 7. Tile / pip / ring patterns

**`TickerTile`** — a ticker's identity square. Two sizes only: `lg` 34px/radius-10/15px
and `sm` 26px/radius-8/11px, both weight 800, showing the ticker's first letter.
Colors come from `src/ui-v3/ticker-palette.ts`, which is a **mockup-derived lookup**
of issuer brand pairs. Those hexes are theme-literal (identical light and dark).
Unknown tickers fall back to the artboards' own neutral pair —
`var(--surface)` / `var(--text-muted)` — which is how AAPL is drawn. Never
synthesise a brand color for a ticker the design never drew.

**`RankPip`** — 15px disc, `position:absolute; top:-7px; left:8px`, so its parent
must be positioned and must reserve 7px of clearance. `--surface-2` /
`--text-muted`, except rank 1 which is `--accent` / `--accent-on`.

**`SignalRing`** — 48px `conic-gradient(var(--accent) 0 P%, var(--border) P% 100%)`
around a 38px `--surface` disc holding a mono 13px value and a 6.5px/`.08em`
`--text-dim` caption. The primitive never derives its own number; the caller
supplies `pct`, `value`, and `label`.

---

## 8. Nav pattern

`BottomNav` — `border-top: 1px solid --border`, `background: --bg`, padding
`10px 8px 16px`, five equal `flex: 1` slots. Each slot is a 15px typographic
glyph (`⌂ ◎ ✦ ▣ ◉` — text, not an icon set) over a 9px/600 label, `--text-faint`.
The active slot flips both to `--accent` and the label to 700. Active is derived
from `usePathname`, and it is the only client-side state on the screen.

---

## 9. Composition rules for UNMOCKED screens

When you build a screen that has no artboard:

1. **Compose only from `src/ui-v3/components`.** No new visual invention — no new
   colors, gradients, radii, shadows, or type sizes that are not already in
   `tokens.css` and used above.
2. **Follow the grammar, not your taste.** A section opens with `SectionEyebrow`.
   A list is flat cards. A "you / today" moment is a `GradientPanel`. A ranked
   strip is `TickerTile` + `RankPip`. A percentage is a `SignalRing`.
3. **Ration accent by §4.** If a screen wants a second orange thing in a region,
   the answer is no.
4. **Keep components pure.** All data access goes in an adapter beside
   `src/ui-v3/home-data.ts` and arrives as a view model. Components take props.
5. **Never fill a hole with a fabricated metric.** If a field has no real source,
   the view model returns `null` and the component omits the element. Placeholder
   numbers are how a design lies.
6. **If a needed component does not exist — STOP and flag it.** Do not improvise a
   new pattern and do not adapt an old component. Request the artboard.

---

## 10. Known gaps in this grammar

Recorded so the next screen does not have to rediscover them.

- **No member "score" metric exists.** The artboard's ring is labelled `SCORE`;
  the data layer has nothing behind it, so the ring is driven by belt progress and
  labelled `XP`.
- **Signal trailing affordances are under-specified.** The artboard defines three
  (`＋` / accent count pill / `→`) but the `foryou` core only exposes
  `watchState`, so live data resolves almost entirely to `→`.
- **Index chips have no seed.** They are fetched client-side from
  `/api/market/quote`, and the artboard's VIX is substituted with IWM because
  Polygon index snapshots are not entitled on this account.
- **Script voice is unexercised.** `--font-script` has no Home usage; its rules
  must be written from whichever artboard first uses it.
