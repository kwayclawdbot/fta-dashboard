# LANE 6 — Stock Screener: integrator wiring

Everything below touches SHARED files that Lane 6 deliberately did NOT edit
(nav + vercel.json + topbar title map). Apply these after merging
`lane6-screener`. All Lane-6-owned files (migration, cron, lib, page) are
already complete, committed, and — for the DB — applied live.

Branch: `lane6-screener`  ·  Worktree: `/Users/kwaysclawd/projects/fta-dashboard-lane6`

---

## 1. `vercel.json` — add the nightly cron (REQUIRED)

Append one entry to the existing `crons` array. Schedule is 23:00 UTC on
weekdays (after US close + settlement); the job walks back to the latest
non-empty grouped-daily so exact timing is not critical.

```json
{
  "crons": [
    { "path": "/api/cron/track-performance", "schedule": "0 22 * * 1-5" },
    { "path": "/api/cron/refresh-screener",  "schedule": "0 23 * * 1-5" }
  ]
}
```

Env: the route reuses the existing **`CRON_SECRET`** already set in Vercel prod
for `track-performance` (Vercel injects it as the `Authorization: Bearer …`
header on cron invocations). No new secret needed. `POLYGON_API_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` are already present.

> The route also supports `?bootstrap=1&days=70` for a deep backfill — this was
> already run once against live (see §5); the cron only ever runs the fast
> incremental path.

---

## 2. Nav entry — `src/components/dashboard/DashboardSidebar.tsx` (REQUIRED)

The MobileTabBar "More" sheet reuses `getNavItems`, so this ONE edit surfaces
the Screener in both the sidebar and mobile. No MobileTabBar edit required.

**a. Add `Telescope` to the lucide-react import block** (top of file):

```ts
import { /* …existing… */ Telescope } from "lucide-react";
```

**b. Define the item** next to the other `CLUB_*` constants (near `CLUB_WATCHLIST`, ~line 72):

```ts
const CLUB_SCREENER: NavItem = { label: "Screener", href: "/screener", icon: Telescope };
```

**c. Insert it into the assembled lists in `getNavItems`** — right after
`CLUB_WATCHLIST` in each role branch that should see it (adults ~line 258,
teens ~line 243). The screener is education-first and kid-safe (presets are
kid-visible), so including it in the kids branch (~line 225) is fine but
optional — owner's call.

```ts
    CLUB_WATCHLIST,
    CLUB_SCREENER,   // ← add
```

That is the only nav change. Free-tier gating is automatic (see §4).

---

## 3. TopBar title map — `src/components/dashboard/DashboardTopBar.tsx` (RECOMMENDED)

So the route renders a real header title. Add one row to `ROUTE_TITLES`
(alongside `["/watchlist", "Family Watchlist"]`, ~line 39):

```ts
  ["/screener", "Stock Screener"],
```

---

## 4. Free-tier gate — `src/components/dashboard/DashboardShell.tsx` (OPTIONAL)

**Already works with no change.** `/screener` is not in `FREE_ALLOWED_PREFIXES`,
so free-tier users hit the shared default UpsellCard ("This is part of the
club") — verified live. That upsell renders through the same `LockedState`
primitive the brief asks for, and the `/screener` page carries its OWN
screener-specific `LockedState` fallback for the paid-but-mis-routed case.

Optional refinement — screener-specific free copy: add a `LOCKED_CONTEXTS`
entry mapping `/screener` to an existing context (e.g. `"watchlist"`), or add a
new `"screener"` `UpsellContext` in `UpsellCard.tsx`. Not required.

---

## 5. Already done by Lane 6 (no action needed)

- **Migration `105_screener.sql` applied live** (Supabase `zvkercqohmmeyofycbgr`):
  tables `screener_metrics`, `screener_history`, `screener_meta`. RLS =
  authenticated SELECT, service-role (cron) writes only. Purely additive.
- **Bootstrap run once against live** (`?bootstrap=1&days=70`):
  - 67 trading days pulled (grouped-daily).
  - 3,635 liquid candidates (≥ $3, ≥ $10M avg $-volume) → top 1,500 detailed →
    **1,163 companies kept** (mcap ≥ $300M).
  - **337 excluded** for unknown / sub-$300M market cap (mostly ADRs/funds that
    return no `market_cap` from ticker-details).
  - `screener_history`: 77,275 rows.
  - `screener_meta`: `last_trading_day=2026-07-23`, `history_days=67`,
    `bootstrap_done=true`.

## 6. Migration numbering

Lane 6 owns **`supabase/migrations/105_screener.sql`**. The concurrent Kai lane
owns 100–104. No overlap.
