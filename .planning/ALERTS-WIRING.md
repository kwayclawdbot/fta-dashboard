# LANE C6 — Trade Alerts Hub · Wiring & Handoff

Everything the app side needs from OTHER lanes / repos, plus the Railway bridge
spec. C6 owns: migration 125, `/api/alerts/*`, `/api/cron/evaluate-alerts*`,
`/api/cron/alerts-digest`, `/alerts` hub, `SetAlertButton`, and the contextual
buttons on screener / watchlist / research. C6 did NOT edit C1-owned files
(nav, settings, dashboard home) — the snippets below are for the integrator.

---

## 0. Ingest secret (DONE — recorded here for the Railway side)

`ALERTS_INGEST_SECRET` was generated and set in Vercel (production + preview +
development) via `vercel env add`. The same value must be set on the Railway
`breakout-alert-system` service so its POST authenticates.

```
ALERTS_INGEST_SECRET = e8dae21fe866c5ba47f91efea56c3bed0db0716946deac0697dca28bfe905f41
```

(Rotate any time by re-running `vercel env add` + updating Railway; the app reads
it fresh per request.)

---

## 1. Railway bridge — POST the morning/intraday broadcast into the app

**Endpoint:** `POST https://app.familyinvestingclub.com/api/alerts/ingest`
**Auth header:** `x-alerts-secret: <ALERTS_INGEST_SECRET>` (or `Authorization: Bearer <secret>`)
**Content-Type:** `application/json`

**Body:**
```json
{
  "source": "kai_morning",              // or "kai_intraday"
  "alerts": [
    {
      "ticker": "NVDA",                  // required, US equity symbol
      "direction": "long",              // "long" | "short" | "watch" (default watch)
      "setup_label": "Breakout continuation",
      "entry": 128.50,                   // optional
      "levels": { "support": 122.0, "resistance": 131.0, "stop": 119.5 },
      "targets": [ { "price": 135, "label": "T1" }, { "price": 142, "label": "T2" } ],
      "narrative": "…education-first read…",
      "chart_url": "https://…",
      "snapshot_price": 127.90           // price at issue; if omitted, falls back to `entry`
    }
  ]
}
```
Response: `{ ok, alerts_ingested, pushed, held_for_digest }`. The app persists
each alert into `trade_alerts` and fans it out to the opted-in audience
(club/individual members default-ON, family-mode adults opt-in, **kids never** —
enforced in the `fanout_trade_alert` SECURITY DEFINER RPC) as instant push or
held-for-digest, honoring each member's daily cap.

### Where to add it in `kai_morning_alerts.py :: broadcast_alerts()`

Do NOT change the SMS logic. Add ONE best-effort POST just before the function's
`return` (after the SMS send loop), mirroring the existing `picks` shape. The
`picks` dicts already carry `ticker`, `price`, `direction`, `setup_label`,
`change_1d`, `volume_ratio`, `rsi`; `narratives` and `chart_urls` are keyed by
ticker.

```python
    # ── C6: mirror this broadcast into the app's Trade Alerts Hub ──
    # Best-effort: never let an app-ingest failure affect the SMS path.
    try:
        import requests  # already a dependency
        ingest_secret = os.environ.get("ALERTS_INGEST_SECRET")
        ingest_url = os.environ.get(
            "APP_ALERTS_INGEST_URL",
            "https://app.familyinvestingclub.com/api/alerts/ingest",
        )
        if ingest_secret:
            payload = {
                "source": "kai_morning",   # use "kai_intraday" from the intraday sender
                "alerts": [
                    {
                        "ticker": p["ticker"],
                        "direction": (p.get("direction") or "watch").lower(),
                        "setup_label": p.get("setup_label"),
                        "snapshot_price": p.get("price"),
                        "narrative": narratives.get(p["ticker"]),
                        "chart_url": chart_urls.get(p["ticker"]),
                        # optional — include if the pick carries explicit levels:
                        # "entry": p.get("entry"),
                        # "levels": {"support": ..., "resistance": ..., "stop": ...},
                        # "targets": [{"price": ..., "label": "T1"}],
                    }
                    for p in picks
                ],
            }
            requests.post(
                ingest_url,
                json=payload,
                headers={"x-alerts-secret": ingest_secret},
                timeout=8,
            )
    except Exception as e:
        logging.warning(f"[C6 ingest] app POST failed (non-fatal): {e}")
```

For the intraday sender (`kai_intraday_alerts.py` broadcast path), the same block
with `"source": "kai_intraday"`.

Railway env to add: `ALERTS_INGEST_SECRET` (value above) and optionally
`APP_ALERTS_INGEST_URL` (defaults to prod).

---

## 2. Nav entry (C1-owned `DashboardSidebar.tsx :: getNavItems`)

Alerts is an **adults-only** surface (the page hard-redirects kids/teens; free
tier gets a LockedState). So the nav row belongs ONLY in the `canParent`
(parent/admin = adult) branch — never for kids, teens, or free.

Add the icon import (`Bell` from `lucide-react`) and a constant:

```tsx
// with the other CLUB_* nav constants:
const CLUB_ALERTS: NavItem = { label: "Alerts", href: "/alerts", icon: Bell };
```

Then inside `getNavItems`, in the **`if (canParent)` block only** (both solo and
family adults; FTA + FIC), push it high-frequency — e.g. right after the screener
row is added to `main`, or at the top of the canParent block:

```tsx
  if (canParent) {
    main.push(CLUB_ALERTS);            // ← adults only; kids/teens never see it
    main.push(isSolo ? SOLO_ACCOUNT_ITEM : FAMILY_ITEM);
    main.push(LEADERBOARD);
    main.push(isFta ? FTA_SECTION : FTA_LOCKED);
  }
```

Do NOT add it to the shared `main` array (that array is reused by the teen
branch) and do NOT add it to the free-tier or kid returns. MobileTabBar consumes
the same `getNavItems`, so it inherits the gating automatically.

---

## 3. Settings alert-prefs section (C1-owned `settings` page)

Delivery prefs (briefing on/off, digest, daily cap) are fully manageable inside
the `/alerts` hub → **My Rules** tab → "Delivery" card, so Settings only needs a
pointer. Adults only. Drop this into the settings notifications section:

```tsx
{/* Trade alerts — adults only (register === "adult"), non-free tier */}
{isAdult && tier !== "free" && (
  <Link
    href="/alerts"
    className="flex items-center justify-between rounded-xl border border-sand bg-paper p-4 transition hover:border-gold-300"
  >
    <div>
      <p className="text-sm font-semibold text-ink">Trade alerts</p>
      <p className="text-[12px] text-soft">
        Kai briefing push, your custom alerts, digest &amp; daily limit
      </p>
    </div>
    <ArrowRight className="h-4 w-4 text-soft" />
  </Link>
)}
```
`isAdult` = `deriveRegister(profile) === "adult"` (from `@/lib/register`).
If you'd rather embed the toggles directly, the source of truth is the
`alert_prefs` table (columns: `briefing_enabled boolean|null`, `digest bool`,
`daily_cap int`, `quiet_hours bool`) — own-row RLS, upsert on `user_id`. Default
resolution: `briefing_enabled ?? isSolo` (club/individual ON, family-adult OFF).

---

## 4. Home briefing card (C1-owned dashboard home)

An adults-only home card surfacing the latest Kai briefing alert. Server-fetch
the newest `trade_alerts` row and pass it in; hide entirely for kids/teens/free.

```tsx
// server (dashboard home data assembly), adults + paying only:
let latestAlert = null;
if (register === "adult" && tier !== "free") {
  const { data } = await supabase
    .from("trade_alerts")
    .select("ticker, direction, setup_label, issued_at")
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  latestAlert = data ?? null;
}
```
```tsx
// client card:
{latestAlert && (
  <Link href="/alerts" className="block rounded-2xl border border-gold-300/40 bg-chip-amber/30 p-4 transition hover:bg-chip-amber/50">
    <div className="flex items-center gap-2">
      <Bell className="h-4 w-4 text-gold-600" />
      <span className="text-[11px] font-bold uppercase tracking-wide text-gold-700">Kai briefing</span>
    </div>
    <p className="mt-1 text-sm font-semibold text-ink">
      {latestAlert.ticker} {latestAlert.direction}
      {latestAlert.setup_label ? ` — ${latestAlert.setup_label}` : ""}
    </p>
    <p className="text-[12px] text-soft">See today's alerts →</p>
  </Link>
)}
```
If the briefing feed is empty (Railway not posting yet) `latestAlert` is null and
the card simply doesn't render — no empty box.

---

## 5. Cron schedule (already added to `vercel.json`)

| Cron | Schedule (UTC) | Cost/day |
|---|---|---|
| `/api/cron/evaluate-alerts` | `5 22 * * 1-5` (post-close) | 0 Polygon calls (reads screener_metrics) + ~1 full-universe read only if any preset_match rules exist |
| `/api/cron/evaluate-alerts-intraday` | `*/10 14-20 * * 1-5` (~42 runs/day) | 1 Polygon full-market snapshot per run (~42/day) + tiny avg_vol read for vol_surge rules |
| `/api/cron/alerts-digest` | `0 21 * * 1-5` | 0 external calls |

All three auth on `CRON_SECRET` (Bearer or `?secret=`), already in Vercel prod.
The intraday cron self-skips when the market is closed (`getMarketState`) unless
`?force=1`.

---

## 6. Delivery model (how a fire becomes a push)

`fire_rule_event` / `fanout_trade_alert` (SECURITY DEFINER) decide per member:
digest pref OR rule.digest OR daily-cap-exceeded ⇒ **hold** (`alert_events.delivered='digest'`);
else **instant** — insert a `notifications` row (type `'alert'`) which the
existing 028 `pg_net` trigger fans to `/api/push/dispatch`. The dispatch route
maps `'alert'` → title "Trade alert" and, because delivery is already gated
upstream, always sends. Held events roll up into the daily digest push.
