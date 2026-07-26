import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFullSnapshot, getMarketState } from "@/lib/market/polygon";
import {
  evalIntraday,
  volSurgeLiquidityMet,
  ALERT_SIGNAL_FLOORS,
  type AlertRule,
  type SnapRow,
} from "@/lib/alerts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * INTRADAY personalized-alert evaluation (every ~10 min during market hours).
 *
 * Cost discipline: ONE Polygon full-market snapshot call per run covers EVERY
 * active price_cross / pct_move / vol_surge rule (no per-ticker quotes). The
 * snapshot has price + day% + today's volume; vol_surge joins the precomputed
 * screener_metrics.avg_vol_20 to derive a ratio. The feed is DELAYED ~15 min —
 * every event is tagged delayed:true so the hub labels it honestly.
 *
 * Quiet logic: only evaluates when the US market is OPEN (getMarketState). A
 * per-rule cooldown prevents re-firing the same rule for 6h (a price that stays
 * across a level shouldn't ping every 10 minutes).
 *
 * Auth: Bearer CRON_SECRET or ?secret=.
 */
const COOLDOWN_MS = 6 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") || "";
  const qsSecret = req.nextUrl.searchParams.get("secret") || "";
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!(auth === `Bearer ${secret}` || qsSecret === secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Quiet outside market hours (unless ?force=1 for verification).
  if (!force) {
    const state = await getMarketState();
    if (state !== "open" && state !== "extended-hours") {
      return NextResponse.json({ ok: true, skipped: "market closed", state });
    }
  }

  const db = createAdminClient();
  const now = Date.now();

  const { data: ruleData } = await db
    .from("alert_rules")
    .select("id, user_id, kind, ticker, params, label, active, digest, state, last_fired_at, created_at, surface")
    .eq("active", true)
    .in("kind", ["price_cross", "pct_move", "vol_surge"]);

  const rules = ((ruleData || []) as unknown as AlertRule[]).filter(
    (r) =>
      r.ticker &&
      (r.last_fired_at == null || now - new Date(r.last_fired_at).getTime() > COOLDOWN_MS)
  );
  if (rules.length === 0) {
    return NextResponse.json({ ok: true, rules: 0, fired: 0 });
  }

  // One full-market snapshot.
  const snap = await getFullSnapshot();
  if (snap.size === 0) {
    return NextResponse.json({ ok: false, note: "snapshot unavailable" }, { status: 200 });
  }

  // avg_vol_20 for vol_surge tickers (derive today's ratio from snapshot volume).
  const volTickers = [
    ...new Set(rules.filter((r) => r.kind === "vol_surge").map((r) => r.ticker!.toUpperCase())),
  ];
  const avgVol = new Map<string, number>();
  for (let i = 0; i < volTickers.length; i += 300) {
    const chunk = volTickers.slice(i, i + 300);
    if (chunk.length === 0) break;
    const { data } = await db
      .from("screener_metrics")
      .select("ticker, avg_vol_20")
      .in("ticker", chunk);
    for (const row of (data || []) as { ticker: string; avg_vol_20: number | null }[]) {
      // ABSOLUTE LIQUIDITY FLOOR (§2c): only trust a volume ratio when the 20-day
      // average is deep enough that a surge isn't a few-hundred-share fluke.
      if (volSurgeLiquidityMet(row.avg_vol_20)) {
        avgVol.set(row.ticker, row.avg_vol_20 as number);
      } else {
        console.log(
          `[evaluate-alerts-intraday] skip vol_surge ${row.ticker}: avg_vol_20 ` +
            `${row.avg_vol_20 ?? 0} < floor (${ALERT_SIGNAL_FLOORS.volSurgeMinAvgVol})`
        );
      }
    }
  }

  let fired = 0;
  let held = 0;
  for (const r of rules) {
    const t = r.ticker!.toUpperCase();
    const base = snap.get(t);
    if (!base) continue;
    const s: SnapRow = {
      price: base.price,
      changePercent: base.changePercent,
      volRatio:
        r.kind === "vol_surge" && base.volume != null && avgVol.has(t)
          ? base.volume / avgVol.get(t)!
          : null,
    };
    const hit = evalIntraday(r, s);
    if (!hit) continue;
    const { data } = await db.rpc("fire_rule_event", {
      p_rule_id: r.id,
      p_payload: {
        ticker: r.ticker,
        message: hit.message,
        condition: hit.condition,
        snapshot_price: base.price,
        delayed: true,
      },
    });
    const mode = (data as string) || "none";
    if (mode === "push") fired++;
    else if (mode === "digest") held++;
  }

  return NextResponse.json({
    ok: true,
    rules: rules.length,
    snapshot_tickers: snap.size,
    fired_push: fired,
    held_digest: held,
  });
}
