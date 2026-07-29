# ui-v3 — the rebuilt Cheat Code front end

This directory is a **strangler rebuild**. The old app keeps running untouched;
v3 grows beside it under `src/app/v3/*` with its own component tree, its own
tokens, and a hard wall between the two. Nothing here restyles an old component.

```
src/ui-v3/
  tokens.css     GENERATED  design tokens, dark default + light override
  tokens.json    GENERATED  raw extraction: every value, usage count, role reason
  base.css       hand-written isolation layer (see "Isolation" below)
  components/    v3 components — translated from the mockups, nothing else
src/app/v3/      the v3 route prefix (layout sets data-ui + data-theme)
scripts/extract-mockup-tokens.mjs   the extractor
```

---

## 1. The mockup DOM is the source of truth

The design lives in `.planning/design-project-v2/mockups/`:

| file | role |
| --- | --- |
| `Cheat Code App.dc.html` | dark theme, 23 artboards — **the canonical design source** |
| `Cheat Code App Light.dc.html` | the same 23 screens, light theme |

Screens are **translated from the artboard HTML**, element by element. Open the
artboard (`data-screen-label="03 Ticker NVDA"`), read its markup, and rebuild
that structure in a v3 component with v3 tokens.

Never do the opposite: never open an old component and restyle it "to look like
the mockup". That is the exact loop that keeps leaking the old design into every
redesign attempt, and it is why this directory exists.

Tokens are likewise **never eyeballed**. `tokens.css` is generated:

```bash
node scripts/extract-mockup-tokens.mjs      # mockups changed? regenerate.
```

The script parses every inline `style="…"`, the `<style>` block, and every SVG
`fill`/`stroke` in both files (~8,000 declarations per theme), counts each value,
and infers the semantic roles from usage — which colors are painted as
backgrounds vs text vs borders, which artboard background repeats across all 23
screens, which foreground is co-declared on an accent fill, and so on. Every
role in `tokens.json` carries a `why` string stating the rule that picked it.
If a role looks wrong, **fix the rule in the script and regenerate** — do not
hand-edit `tokens.css`.

### Token surface

- Semantic roles: `--bg --surface --surface-2 --border --text --text-muted
  --text-dim --text-faint --accent --accent-strong --accent-soft --accent-on
  --positive --negative --info --violet --gold`
- Type: `--font-display --font-body --font-mono --font-script`, plus the size
  (`--fs-11`, `--fs-14`, `--fs-8-5` …), weight, line-height and letter-spacing
  values actually used in the mockups.
- `--radius-*`, `--shadow-1..n`, `--space-*` (values in heavy rotation).
- A raw palette (`--p-<hex>`) for anything whose role is ambiguous. These are
  **theme-literal** — they do not flip between light and dark. Prefer the
  semantic roles; reach for `--p-*` only where the mockup itself keeps a color
  constant across both themes.

Dark is the default because the dark mockup is canonical. Light values are
emitted as overrides on `[data-ui="v3"][data-theme="light"]`, and only for
tokens whose value actually differs.

---

## 2. Import wall

Files under `src/ui-v3/**` and `src/app/v3/**` may import **only** from:

- `src/ui-v3/*` — the v3 tree itself
- `src/lib/*`, `src/hooks/*` — data / API layers (they carry no styling)
- `next/*`, `react`, and third-party packages

They may **never** import from:

- `src/components/**` — the old component library
- the old `src/app/**` route trees and their client components
- `src/lib/theme` or `src/lib/motion` — the old theme and motion providers

This is enforced, not just documented: `eslint.config.mjs` scopes a
`no-restricted-imports` rule to those two globs. A second rule
(`no-restricted-syntax`) rejects old design-system class names in `className`
strings (`f0-*`, `club2-*`, `text-gradient*`, `bg-midnight-*`, `text-ink`, …),
because an import rule cannot see a class string.

Two exceptions worth stating: `src/lib` is allowed because it is where data
access lives, but pulling a *styling* helper out of `src/lib` is a wall breach
in spirit even when ESLint permits it. And if a v3 screen genuinely needs logic
that today only exists inside an old component, copy the logic into the v3 tree
or lift it into `src/lib` — do not import the component.

---

## 3. Isolation: how old styles are kept out

Every v3 page still renders inside the app's root layout, which imports
`src/app/globals.css`. Three things could leak from it:

1. **Inherited properties.** `globals.css` styles `body` with the old
   `background`, `color`, `font-family`, `font-variant-numeric` and a color
   transition. Those inherit into *everything*, including v3.
2. **Global class rules.** `.f0-*`, `.club2-*`, `.cta-button`, and the Tailwind
   theme colors are global, but they only apply if v3 markup names them.
3. **Element selectors.** In practice `globals.css` only styles `html`, `body`
   and the scrollbar pseudo-elements — no bare `a`/`button`/`h1` rules beyond
   Tailwind's preflight, which is a reset and is welcome.

**The chosen strategy is a scoped re-establishment in `src/ui-v3/base.css`,**
not a rewrite of the old styles:

- Every inheritable property the old `body` sets is re-declared on
  `[data-ui="v3"]` from v3 tokens. `[data-ui="v3"]` has specificity `0,1,0` and
  beats `body` (`0,0,1`), so it wins regardless of stylesheet order — no
  `!important`, no cascade-layer surgery.
- `body` sits *above* the v3 root and still paints the page (overscroll, short
  pages) in the old paper color. So `tokens.css` also emits its values on
  `html:has([data-ui="v3"])` — i.e. only on documents that actually contain a v3
  root — and `base.css` repaints `body` from `var(--bg)`. Old routes never match
  the `:has()` selector, so they never see a single v3 variable.
- v3 components use **CSS Modules**, whose class names are hashed. There is no
  shared class namespace with the old app, so a global rule has nothing to match
  and the leak path in (2) is closed structurally rather than by convention.

Alternatives considered and rejected:

- *Wrapping `globals.css` in a cascade layer.* Layers lose to unlayered rules,
  and `globals.css` is a mix of `@import "tailwindcss"` (layered) and ~1,500
  lines of unlayered hand-written CSS. Getting it right means editing a file
  every existing page depends on — high blast radius for zero extra safety.
- *`all: revert-layer` / `all: initial` on the v3 root.* Nukes Tailwind's
  preflight too, and preflight is the one part of the old chain worth keeping.
- *A separate root layout for v3.* Next.js allows only one root layout per app
  unless the whole tree is restructured into route groups; that is an invasive
  change to every existing route for a problem the scoped reset already solves.

Nothing in `src/app/layout.tsx` or `src/app/globals.css` was modified.

### Tailwind in v3

Tailwind is available, but its **color and typography theme is the old design
system**. So in v3: layout/flex/grid/sizing utilities are fine; any utility that
carries a color, font, radius or shadow from the old theme is not. Colors and
type come from v3 tokens — CSS Modules, or arbitrary values like
`text-[var(--text-dim)]`. The ESLint class rule enforces the obvious offenders.

### Fonts

`tokens.css` records the family names exactly as the mockups declare them
(`'Barlow Condensed'`, `'Instrument Sans'`, `'IBM Plex Mono'`,
`'Kaushan Script'`). `src/app/v3/layout.tsx` self-hosts those same faces via
`next/font/google` and exposes them as `--font-v3-*`; `base.css` binds
`--font-display/body/mono/script` to them. That binding is the **only** place a
generated token is deliberately re-pointed, and it changes the delivery, not the
design. The root layout's font payload is untouched.

---

## 4. Every screen passes a side-by-side before merge

A v3 screen is not done when it looks right. Before merge it must pass a
**Playwright side-by-side against its artboard**:

1. Render the artboard from the mockup file (it is a 390×844 `div` with a
   `data-screen-label` — screenshot that element).
2. Render the v3 route at the same 390×844 viewport.
3. Diff them, and check both themes (`data-theme="dark"` and `"light"`).

Differences are resolved *toward the artboard*. If the artboard itself is wrong,
the mockup gets fixed and the tokens get regenerated — the fix never starts in a
component.
