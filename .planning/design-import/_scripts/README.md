# Extraction scripts

Re-runnable pipeline that turns a Claude Design standalone canvas into board specs.
Re-run these when a canvas is revised, or when the design MCP import lands and you want to
diff the MCP payload against what the rendered DOM actually says.

## Setup

The scripts need Playwright with a Chromium build. They resolve it from a local
`node_modules` symlink, which is **not** committed (it points into a session scratchpad):

```sh
cd .planning/design-import/_scripts
npm init -y >/dev/null && npm i playwright
npx playwright install chromium
```

## Run

```sh
# one canvas -> ../<key>/<NN-slug>/{render.png,dom.html,spec.md} + ../<key>/TOKENS.md + _raw.json
node extract.mjs app-dark    "$HOME/Desktop/Cheat Code App (Standalone).html"
node extract.mjs app-light   "$HOME/Desktop/Cheat Code App Light (Standalone).html"
node extract.mjs family      "$HOME/Desktop/Cheat Code Family (Standalone).html"
node extract.mjs club-screens "../../design-project-v2/Club Screens.dc.html"

# light<->dark proof (needs app-dark + app-light extracted first)
node pair-positional.mjs   # -> ../TOKEN-MAP-POSITIONAL.json  (~4 min, opens both canvases)
node crosscheck.mjs        # -> ../TOKEN-MAP.md

# content ledger inputs (mock data + compliance scan, prints to stdout)
node scan-content.mjs
```

## Files

| script | does |
| --- | --- |
| `lib.mjs` | opens a canvas: waits for the `__bundler_loading` element to clear **and** `body.innerText.length > 400`, then waits on `document.fonts.ready`. Never name a variable `URL` in page context. |
| `extract.mjs` | the extractor. Finds boards by locating the container with the most 330–600px-wide, ≥500px-tall children; screenshots each frame at `deviceScaleFactor: 2`; walks the subtree emitting computed styles; derives per-canvas tokens. |
| `pair-positional.mjs` | walks the dark and light canvases in lockstep along identical DOM paths and records every paint (`bg`/`text`/`border-*`) in both, proving the token mapping. |
| `crosscheck.mjs` | renders `TOKEN-MAP.md` from that pairing + type-scale/radius/board-parity identity checks. |
| `scan-content.mjs` | flags mock data and compliance-sensitive strings per board; the raw material for `DELTA.md`. |
| `probe.mjs`, `probe2.mjs` | ad-hoc structure probes, useful when a new canvas has a different shell. |

## Extraction rules encoded here

- **Style values are exact computed values.** Colours are normalised to uppercase hex, with
  `/alpha` appended when not opaque. Nothing is rounded or described.
- **Type is inheritance-deduped**: a node only lists font properties that differ from its
  parent, so a spec line shows exactly what to override.
- **Defaults are omitted** (`margin: 0`, `border: 0 none`, `box-shadow: none`, …) so every
  line in a spec is a decision someone made.
- **Tokens are named deterministically** from HSL (hue family + lightness step, `a<NN>` suffix
  for alpha), so the same colour gets the same name on every re-run and the name describes the
  value. Type tokens are `ty<N>` ordered by size desc; radii `r<N>` ascending.
- **Token names are per-canvas.** `T.orange-400` in `app-dark` and in `app-light` are different
  hexes. Cross-canvas identity lives only in `TOKEN-MAP.md`.
