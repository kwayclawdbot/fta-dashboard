# Cutover preview proof — 2026-08-07

What this folder proves: with the harness on, **the OLD url serves the v3
screen**, and with it off the old app comes back. Every shot below was taken at
the old path (`/discover`, not `/v3/discover`) and asserted on `[data-ui="v3"]`
being in the DOM — a correct-looking screenshot at the wrong url would prove
nothing.

Regenerate with:

```bash
V3_BASE=https://<preview-url> node scripts/v3-proof-cutover.mjs
```

## Result

**28 of 30 preview shots pass. 15 of 15 off-switch checks pass** — every staged
path returns the old app under `?v3=0`, so the switch is reversible.
Machine-readable detail in `results.json`.

Three of those shots are the **real old urls** for screens already covered by
their v3-shaped paths, and they are the point of the second wave: a cutover only
counts at the urls members' bookmarks and the in-app links actually use.

| shot | old url | proves |
| --- | --- | --- |
| `15-screener-via-old-url-*` | `/screener` | the old screener url serves v3 |
| `03-ticker-via-research-*` | `/research/NVDA` | the old research url serves v3 |
| `13-fundamentals-via-research-tab-*` | `/research/NVDA?tab=fundamentals` | the old `?tab=` deep link reaches the matching v3 tab route |

Also checked, and deliberately NOT rewritten: `/research/thesis/abc` stays with
the old app. "thesis" is a ticker-shaped string sitting on a real sibling route,
and mapping it to `/v3/ticker/THESIS` is the obvious way to get this wrong.

The two that are not from the preview are marked `-LOCAL`:

### `/login` — mapping is correct, but not reviewable on preview

`10-login-*-LOCAL.png` were captured against a local production build, not the
preview, and the preview's own `/login` shots were deleted rather than kept
(they had captured the old `/dashboard`, which under a filename saying "login"
is worse than no file at all).

The rewrite itself is fine. What blocks it is pre-existing and has nothing to do
with the harness: a Vercel preview auto-attaches a demo session
(`src/lib/demo/preview-demo.ts`), so every visitor is signed in — and middleware
has always redirected an authenticated visitor off `/login` to `/dashboard`.
`/v3/login` guards the same way. So on any preview, the login screen is
unreachable by construction, flag or no flag.

Anonymous — which is what a real visitor is — the mapping works: verified
locally at `http://localhost:3311/login?v3=1` → 200, v3 markup. That is what the
two LOCAL shots are.

### `04-club-live-section-*-LOCAL.png` — context, not a staged route

The Club feed is deliberately **not** in this cutover wave (its drift against
main is still being reconciled), so it has no old-url shot. These are included
only so the Live section from decision 2 can be reviewed somewhere. Captured at
`/v3/club` on a local build, full-page.

## Two things to look at

1. **The Learn row has no caption** in `01-home-*.png`. That is honest, not
   broken: the caption comes from `resolveHomeRoute()`'s `learning`, which is
   only populated on the club-solo branch, and the preview's demo member is not
   on it. It costs Home no extra query, which is why it was chosen — see the
   note on `mapLearn` in `src/ui-v3/home-data.ts`. If the empty row reads as too
   thin, the fix is a heavier `buildTodaySeed()` read, and that is a call to
   make deliberately rather than by default.

2. **There are two LIVE affordances on the Club screen.** The artboard's own
   LIVE tab in `ClubHeader` is inert — it has no `href`, because the v3 Live
   screen does not exist yet — and the interim Live section added below it does
   have a destination, into old chrome. They do not conflict functionally, but a
   screen with one dead LIVE and one live LIVE wants a decision: either the tab
   adopts the same interim destination, or the section waits. Left alone rather
   than guessed at.

3. **The ticker chart is empty** in `03-ticker-via-research-*` ("No price
   history came back for this range"). That is a data condition on the preview,
   not a rendering fault — the screen is drawing its honest empty state. Same
   reason `/research/BRK.B` rewrites correctly and then 404s: the v3 ticker
   screen 404s on symbols it cannot resolve, and the already-shipped
   `/ticker/BRK.B` mapping behaves identically. Neither is new.

## Environment note

These are **not** fixtures-mode shots. A Vercel preview signs the visitor in as
the demo member, so what is rendered is live data read as that member. Closer to
the real thing than fixtures, but it does mean empty regions are the demo
account's real emptiness, not a rendering fault.
