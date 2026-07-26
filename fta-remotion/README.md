# fta-remotion — FIC Learning World micro-video templates

Parametrized [Remotion](https://remotion.dev) (v4.0.499) project for the FIC Learning
World. Two production templates, populated from structured props → bulk-renderable.
Silent by design (text-on-screen; voiceover is a later decision).

Spec: `.planning/FIC-LEARNING-WORLD.md` §6 + `.planning/CINEMATIC-LAYER-PLAN.md`.

## Templates

| Composition id | Template | Duration | Props |
|---|---|---|---|
| `concept-revenue-vertical` / `-wide` | **ConceptExplainer** | 30s | `title, definition, exampleCompany, exampleTicker, exampleValuePrefix, exampleValueNumber, exampleValueSuffix, exampleNote, glow` |
| `reveal-meta-vertical` / `-wide` | **AnswerReveal** | 20s | `company, ticker, setup, question, answer('up'|'down'), moveValuePrefix, moveValueNumber, moveValueSuffix, moveNote, why, glow` |

- **ConceptExplainer**: animated headline → definition → illustrated flow (Customers → Company → Revenue) → ticker chip + big count-up stat → branded outro.
- **AnswerReveal**: setup → question + UP/DOWN prediction chips → animated reveal (arrow + count-up move) → why-it-moved + brand footer.

Both are responsive to the composition's `width`/`height` (via `useVideoConfig`),
so the same component renders correctly at 1080×1920 and 1920×1080. Brand tokens live
in `src/lib/theme.ts`; shared pieces (Backdrop, InfinityMark, RiseIn, VoltUnderline,
KaiGuide, BrandOutro, count-up) in `src/lib/components.tsx`. The Kai mascot poses in
`public/kai/` are copies of `../public/assets/kai/*.webp`.

## Develop / preview

```bash
npm install
npm run dev        # opens Remotion Studio — tweak props live, add new compositions
```

## Render

```bash
npm run render:concept:v   # 1080x1920
npm run render:concept:w   # 1920x1080
npm run render:reveal:v
npm run render:reveal:w
# generic: npx remotion render <composition-id> out/<name>.mp4 --props='{...}'
```

Output: h264 mp4, CRF 23, ~2–3 MB per 20–30s clip. Rendered pilots are committed to
`../public/assets/lessons/` (with a manifest); `out/` here is gitignored.

## Environment notes

- `remotion.config.ts` pins `Config.setBrowserExecutable("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")`
  because this machine could not reach Remotion's Chrome-headless-shell download endpoint.
  Remove that line on a machine where the download works, or repoint it at any local Chrome.
- Render **one composition at a time**. Launching concurrent `remotion render` processes
  against the shared system Chrome intermittently throws `makePage/getPool` — a resource
  race, not a code bug. Re-running the single failed render succeeds.

## New videos from these templates

Register a new `<Composition>` in `src/Root.tsx` with different `defaultProps`, or pass
`--props='{"title":"...", ...}'` to `remotion render`. To wire real screener/track-record
numbers, feed the app's data into the prop object at render time.
