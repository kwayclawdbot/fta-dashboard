# ui-v3 Design Grammar

Written from the screens actually translated — **"01 Home"** first, then the
Discover, Club, Watch and You boards — element by element. Every value below is a
real px/token in `src/ui-v3`, not an aspiration. When the next screen is
translated, this file gets amended from *that* artboard; it is never extended by
invention.

The primitive variants in §5-§8 are recorded the same way: a variant exists
because two artboards draw the same object differently, and it is named after the
difference, never after a preference.

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
--accent-soft`. Exactly four tones, each read off an artboard:

| tone | wash (dark → light) | radius | padding | board |
| --- | --- | --- | --- | --- |
| `brief` | `120deg #2A1208, #1A0E12 55%, #17141A` → `#FFE9D6, #FFF1E4 55%, #FFFFFF` | 16 | 14 / 15 | 01 Home |
| `you` | `110deg #241009, #17141A 70%` → `#FFEEDD, #FFFFFF 70%` | 16 | 13 / 15 | 01 Home |
| `streak` | `120deg #241009, #17141A 65%` → `#FFEEDD, #FFFFFF 65%` | 16 | 14 / 16 | 07 You Profile |
| `close` | `135deg #241009, #17141A 60%` → `#FFEEDD, #FFFFFF 60%` | 18 | 16 | 06 Watch |

The stops have no semantic token — they are one-off washes — so they live as
theme-scoped custom properties `--wash-brief/you/streak/close` in `base.css`.
They are declared there rather than in the component because the `streak` wash is
also painted by the lifted rung on "22 Belts", and one declaration per wash means
one light override per wash. A panel takes `href` when the artboard makes the
whole panel its own tap target; the box does not change.

**Shadows are halos, not elevation.** `--shadow-1..3` are all
`0 0 Npx rgba(255,122,26,…)`. Nothing on this screen is lifted off the page.

---

## 6. Eyebrow / section-header pattern

`SectionEyebrow` is the only way a section opens:

```
mono · 9.5px · 600 · .16em · uppercase
  [optional] one <EyebrowAccent> run (labelTone="text" only)
  [optional] right-aligned action, 11px, same baseline
  [optional] caption, 10.5px/--text-faint, 2-3px beneath
```

The boards use two colour assignments and they are opposites, so both are
variants rather than a default plus an override:

| prop | value | drawn by |
| --- | --- | --- |
| `labelTone` | `text` (default) — label `--text`, one optional accent run | 01 Home, 04 Club Feed |
| | `accent` — the whole label is `--accent` | 02 Discover ×5, 07 You Profile, 22 Belts |
| `actionTone` | `accent` (default) — 11px/600/`--accent` | 01 Home |
| | `dim` — 11px/400/`--text-dim` | Discover, Club Feed, You |
| `actionSize` | `word` (default) 11px / `glyph` 12px | "See all" / the bare "→" |
| `captionGap` | `3` (default) / `2` | Home / every Discover caption |

An action with an `actionHref` is a link; without one it is inert text (the
screener's "→" marks a section that has no destination yet).

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

**`SignalRing`** — `conic-gradient(var(--accent) 0 P%, var(--border) P% 100%)`
around a centred disc holding a mono value and, on two boards, a 6.5px/`.08em`
`--text-dim` caption. The primitive never derives its own number; the caller
supplies `pct`, `value` and `caption`. Three size classes, one per board, and
nothing between them:

| `size` | ring / disc | value | caption | `discTone` | board |
| --- | --- | --- | --- | --- | --- |
| `sm` | 48 / 38 | mono 13 | 0px beneath | `surface` | 01 Home, YOU strip |
| `md` | 64 / 52 | mono 16 | 1px beneath, may be two lines | `bg` | 07 You Profile |
| `lg` | 88 / 74 | mono 17 | none | `surface` | 06 Watch |

`discTone` is what the ring is punched through: `surface` when it sits on a card,
`bg` when it sits on the page. They are different tokens in light theme.

---

## 8. Shell and nav pattern

`AppShell` is the column every screen sits in: centred, `max-width: 430px`,
`--bg`. The boards use three shapes and no others.

| shape | props | boards |
| --- | --- | --- |
| nav destination | *(defaults)* — 18px well, five-slot nav | 01 Home, 02 Discover, 04 Club, 06 Watch, 07 You … |
| detail + action bar | `nav={false}` `bar={…}` | 19 Alert Setup (arm), 22 Belts (next rung) |
| full bleed | `padding="bleed"` `nav={false}` | 23 Inside Circle |

The bar slot is the artboards' pinned footer: hairline on top, `12px 18px 24px`,
laid out as a row (one child fills it with `flex: 1`, two can share it).
`padding="bleed"` hands the column straight to the children, so a screen whose
bands run to the edge keeps its own `flex: 1` on the band that should absorb the
slack — without one, the content sits at the top of the column.

`BottomNav` — `border-top: 1px solid --border`, `background: --bg`, padding
`10px 8px 16px`, five equal `flex: 1` slots. Each slot is a 15px typographic
glyph (`⌂ ◎ ✦ ▣ ◉` — text, not an icon set) over a 9px/600 label, `--text-faint`.
The active slot flips both to `--accent` and the label to 700. Active is derived
from `usePathname`, and it is the only client-side state on the screen.

**The glyphs do not share a line-height.** None of the five exists in Instrument
Sans, so each falls back to a different face; the artboard declares no
line-height, which gives line boxes of 19 / 23 / 19 / 20 / 23px and puts every
label under its own glyph. Pinning one value flattens them and moves three of the
five labels by up to 3.5px. Leave it inherited.

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

---

## 11. Translation gotchas

Four ways the mockup DOM and the v3 DOM disagree about the *same* declaration.
Each of these cost a lane real time; none is discoverable by reading the artboard
markup alone.

**1. The mockup has no `box-sizing` reset — its boxes are content-box.** v3 sets
`border-box` on everything (base.css). So an artboard's `width:38px;
border:2.5px` renders **43px** on the page, and `width:34px; border:1px` renders
36px. Convert every declared size that sits next to a border or padding: state
the outer size in v3, and say so in a comment. Getting this wrong is a silent
2-8px error that only shows up as accumulated drift down the screen.

**2. Wait for `document.fonts.ready` plus ~3s before measuring an artboard.**
The mockups pull Barlow Condensed / Instrument Sans / IBM Plex Mono / Kaushan
from the Google CDN. Measure too early and every box is a fallback-metrics box —
which reads as a real difference and sends you editing correct CSS. The same wait
applies to the v3 side before a side-by-side.

**3. `svg` is inline on the artboards and blockified by Tailwind.** Preflight
sets `display: block; vertical-align: middle`; the mockups declare neither, so an
artboard sparkline sits on the text baseline and its line box is ~4px taller than
the graphic — which is what the caption beneath is spaced off. base.css restores
both halves for every v3 svg. Undo only `display` and the graphic hangs from
`vertical-align: middle` instead, moving everything below it. An svg that really
is a block opts out at `:global([data-ui="v3"]) .yourClass` — a bare class loses
to the base rule's `[data-ui="v3"] svg`.

**4. Every light-theme selector must be scoped `[data-ui="v3"][data-theme="light"]`.**
The old app writes `data-theme` on `<html>`. A bare `[data-theme="light"] .x`
therefore matches while v3 is in dark, and light values leak into the dark
screen. Write it as `:global([data-ui="v3"][data-theme="light"]) .x` in every
module — that exact form, so the pattern is greppable.

And one process note, because it is what made this refactor safe: **capture
390×844 screenshots of every screen in both themes before touching a shared
primitive, and diff after.** A consolidation that is genuinely behaviour-
preserving comes back at 0 differing pixels — not "close enough" — so any
non-zero diff is either a real regression or a change you should be able to name
before you look at it.
