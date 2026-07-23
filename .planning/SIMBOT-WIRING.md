# Simbot (Lane 5) — Integrator Wiring

Lane 5 built the Simbot integration **without touching any shared nav/config
file**. This doc is the exact set of hooks the integrator applies to the files
Lane 5 is not allowed to edit, plus the platform-side "Practice in Simbot" link
snippets. Everything Lane 5 owns is already committed on `lane5-simbot`.

## What Lane 5 already shipped (owned files — no action needed)
- `public/sim/index.html` — vendored Simbot, reskinned to platform tokens (both
  themes via `<html data-fta-theme>`), embed session (skips local login, namespaces
  localStorage per platform user via `?uid`), XP milestone bridge, lesson
  cross-links, and Live Market mode.
- `src/lib/simbot-bridge.ts` — `useSimbotBridge` (origin-validated milestone → XP).
- `src/app/(dashboard)/simulator/simbot/page.tsx` + `loading.tsx` — the Simbot page.
- `src/components/simulator/SimulatorTabs.tsx` — added the "Simbot" tab.

The Simbot surface is reached as a **third tab inside the existing `/simulator`
destination** (Trading Floor | Pattern Practice | **Simbot**). Because it lives
under a route the nav already points at, **most shared files need no change.**

---

## 1. `src/components/dashboard/DashboardTopBar.tsx` — ONE title-map row (recommended)

`ROUTE_TITLES` matches longest/nested-first, so add the `/simulator/simbot` row
**above** the `/simulator` row. Without it the TopBar shows "Trading Floor" on the
Simbot page (harmless but wrong).

```diff
 const ROUTE_TITLES: [string, string][] = [
   ["/fta/chat", "FTA Traders Chat"],
   ["/fta/courses", "FTA Course Library"],
   ["/fta/recordings", "FTA Recordings"],
   ["/fta", "FTA — Trading Academy"],
   ["/simulator/lessons", "Pattern Practice"],
+  ["/simulator/simbot", "Simbot"],
   ["/simulator", "Trading Floor"],
```

Optional kid override (Simbot is kid-appropriate; a friendlier label if desired):
```diff
 const KID_TITLE_OVERRIDES: Record<string, string> = {
   "/dashboard": "Kids Corner",
+  "/simulator/simbot": "Simbot",
```

## 2. `src/components/dashboard/DashboardSidebar.tsx` — NO CHANGE REQUIRED

The Practice group already exposes `{ label: "Simulator", href: "/simulator" }`
(`practiceGroup()`), and Simbot is a tab within that destination — no new sidebar
item is needed. **Optional** (only if the owner wants Simbot as its own sidebar
sub-link) — add under the Simulator entry in `practiceGroup`:
```ts
// inside practiceGroup(...).children, after the Simulator entry:
...(includeSimulator ? [{ label: "Simbot", href: "/simulator/simbot" }] : []),
```
Recommendation: **leave as-is** — we just decluttered (Lane 1); the tab is enough.

## 3. `src/components/dashboard/MobileTabBar.tsx` — NO CHANGE REQUIRED

MobileTabBar has no `/simulator` entry today; Simbot inherits the same mobile
placement as the rest of the simulator (reached via the Practice group / tabs).
No change unless the owner wants a dedicated mobile tab (not recommended).

## 4. `vercel.json` — NO CHANGE REQUIRED

- Live Market mode calls the **existing** same-origin `/api/market/*` Next routes
  (`quote`, `bars`) — no rewrite/proxy entry needed.
- The sim is a static asset under `public/sim/` — served directly, no route config.
- Verified there is **no** `X-Frame-Options` / CSP `frame-ancestors` set in
  `next.config.ts` or `src/middleware.ts` (matcher excludes public assets), so the
  same-origin iframe renders freely. ⚠️ If security headers are added later, keep
  `frame-ancestors 'self'` (or no `X-Frame-Options: DENY`) so `/simulator/simbot`
  can still embed `/sim/index.html`.

---

## 5. Platform-side "Practice in Simbot" links (reverse dedupe direction)

The Simbot→platform cross-links ship inside the sim (`window.FTA_LESSON_LINKS`).
The **platform→Simbot** direction is a small addition to the lesson viewer, kept
here as a snippet because it lives in `LessonViewerClient.tsx` (not a Lane 5 file).

Map (teens lesson id → Simbot lesson anchor). The sim opens the Lesson list; a
future enhancement can accept `?lesson=<id>` to deep-open. For now link to the
Simbot tab:

```ts
// e.g. src/lib/simbot-links.ts (new) — platform lesson id -> Simbot practice
export const PRACTICE_IN_SIMBOT: Record<string, string> = {
  "f1c00000-0002-0002-0002-000000000001": "fight",     // Supply & Demand
  "f1c00000-0002-0002-0004-000000000001": "time",      // Candle Anatomy
  "f1c00000-0002-0002-0005-000000000001": "read",      // Reading a Candle
  "f1c00000-0002-0002-0007-000000000001": "swings",    // Trend Structure
  "f1c00000-0002-0002-0008-000000000001": "levels",    // Support & Resistance
  "f1c00000-0002-0002-0009-000000000001": "range",     // Role Reversal & Breakouts
  "f1c00000-0002-0003-0001-000000000001": "engulf",    // Chart Patterns
  "f1c00000-0002-0005-0001-000000000001": "sizing",    // 1-2% Rule & Sizing
  "f1c00000-0002-0006-0001-000000000001": "replay",    // Paper Trading Setup
  "f1c00000-0002-0006-0002-000000000001": "checklist", // First-Trade Checklist
};
```

```tsx
// In LessonViewerClient.tsx, in the below-video / below-embed action bar:
import { PRACTICE_IN_SIMBOT } from "@/lib/simbot-links";
// ...
{PRACTICE_IN_SIMBOT[lessonId] && (
  <Link
    href="/simulator/simbot"
    className="inline-flex items-center gap-1.5 rounded-lg border border-gold-400/40 bg-gold-400/10 px-3 py-2 text-sm font-display font-semibold text-gold-600 hover:bg-gold-400/20 transition-colors"
  >
    <Bot className="h-4 w-4" />
    Practice this in Simbot
  </Link>
)}
```
(`Bot` from `lucide-react`.) When a `?lesson=` deep-open lands in Simbot, change
the href to `/simulator/simbot?lesson=${PRACTICE_IN_SIMBOT[lessonId]}` and read it
in the sim's embed boot.

---

## 6. Bridge protocol (reference)

Sim → host `window.postMessage` (host validates origin via `isAllowedLessonOrigin`,
which trusts same-origin). Message: `{ type:'fta-simbot', v:1, event, payload, ts }`.

| event | when | host award (once per ref) |
|-------|------|---------------------------|
| `ready` | sim mounted | host pushes current theme back |
| `lesson_complete` | each Simbot lesson finished | kind `lesson`, +`XP.LESSON` (50), ref `simbot-lesson-<id>` |
| `level_up` | an internal stage fully cleared | kind `bonus`, +15, ref `simbot-stage-<n>` |
| `first_profitable_r` | first closed trade ≥ 1R | kind `bonus`, +30, ref `simbot-first-r` |

Host → sim: `{ type:'fta-theme', theme:'light'|'dark' }` on the app theme toggle
(the page also passes `?theme=` on the iframe src for a no-flash first paint).
Simbot's internal XP/progress economy stays internal — only these milestones cross.

## 7. Env / infra
- **Live Market mode** needs Polygon configured for `/api/market/*` (already set in
  Vercel prod). If unset it degrades honestly to "Market data unavailable"; Synthetic
  mode (the default) always works with zero external deps.
- **Owner flag (from plan §6):** the Simbot source repo
  `github.com/Andwelecoffie2012/simbot` is **public** — consider making it private
  if it's meant to be proprietary. The vendored copy here is self-contained and
  needs no network access for the synthetic engine.

## 8. Local verification (done by Lane 5)
`npm run build` green in the worktree; dev server + Playwright at 390px confirmed:
embed boot (auth bypassed, session `fta:<uid>`), `?theme=` applied + live flip via
`postMessage`, Synthetic|Live toggle, a synthetic ≥1R trade closing (pnl +58.73,
R 1.5) → `first_profitable_r` emit, `lesson_complete` emit, stage `level_up` emit,
and the "Read the full lesson →" cross-link rendering with the correct `_top`
deep-link. Zero console errors. **Prod verification is the integrator's job.**
