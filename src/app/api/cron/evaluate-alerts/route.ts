import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evalNightly,
  type AlertRule,
  type MetricsRow,
  type AlertParams,
} from "@/lib/alerts/types";
import { getPreset, type ScreenerRow } from "@/lib/screener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * NIGHTLY personalized-alert evaluation (post-close; see vercel.json).
 *
 * Evaluates every active rule whose kind depends on end-of-day metrics/history:
 *   rsi_cross · ema_cross · w52_break · pct_move  → against screener_metrics for
 *     the specific referenced tickers (ONE .in() batch, not per-rule queries).
 *   preset_match → a nightly DIFF of the preset's screen: any ticker that is in
 *     the screen tonight but was NOT in the rule's last stored set fires as a
 *     "new entrant". The first run only SEEDS the set (no flood).
 *
 * Fired rules go through fire_rule_event (instant push vs held-for-digest, cap
 * aware). Per-rule daily dedup: a rule that already fired today is skipped
 * (last_fired_at ≥ today). Idempotent — safe to re-run.
 *
 * Cost: ~1 full-universe read only when preset_match rules exist (paginated,
 * ~12 selects), plus one batched metrics read for referenced tickers. No
 * Polygon calls (screener_metrics is already computed by refresh-screener).
 *
 * Auth: Bearer CRON_SECRET or ?secret= (mirrors the other crons).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") || "";
  const qsSecret = req.nextUrl.searchParams.get("secret") || "";
  if (!(auth === `Bearer ${secret}` || qsSecret === secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Load active rules of the nightly kinds.
  const { data: ruleData } = await db
    .from("alert_rules")
    .select("id, user_id, kind, ticker, params, label, active, digest, state, last_fired_at, created_at, surface")
    .eq("active", true)
    .in("kind", ["rsi_cross", "ema_cross", "w52_break", "pct_move", "preset_match"]);

  const rules = (ruleData || []) as unknown as AlertRule[];
  if (rules.length === 0) {
    return NextResponse.json({ ok: true, rules: 0, fired: 0 });
  }

  // Skip rules that already fired today (per-day dedup).
  const firedToday = (r: AlertRule) =>
    r.last_fired_at != null && new Date(r.last_fired_at) >= todayStart;

  const tickerRules = rules.filter(
    (r) => r.kind !== "preset_match" && r.ticker && !firedToday(r)
  );
  const presetRules = rules.filter((r) => r.kind === "preset_match");

  let fired = 0;
  let held = 0;

  // ── ticker rules: one batched metrics read ────────────────────────────────
  const tickers = [...new Set(tickerRules.map((r) => r.ticker!.toUpperCase()))];
  const metricsByTicker = new Map<string, MetricsRow>();
  for (let i = 0; i < tickers.length; i += 300) {
    const chunk = tickers.slice(i, i + 300);
    const { data } = await db
      .from("screener_metrics")
      .select("ticker, price, chg_1d, chg_5d, vol_ratio, rsi14, ema20_state, ema50_state, dist_52w_high, dist_52w_low")
      .in("ticker", chunk);
    for (const m of (data || []) as MetricsRow[]) metricsByTicker.set(m.ticker, m);
  }

  for (const r of tickerRules) {
    const m = metricsByTicker.get(r.ticker!.toUpperCase());
    const hit = evalNightly(r, m);
    if (!hit) continue;
    const mode = await fire(db, r.id, {
      ticker: r.ticker,
      message: hit.message,
      condition: hit.condition,
      snapshot_price: m?.price ?? null,
    });
    if (mode === "push") fired++;
    else if (mode === "digest") held++;
  }

  // ── preset_match: nightly diff of the screen ──────────────────────────────
  if (presetRules.length > 0) {
    const universe = await loadUniverse(db);
    for (const r of presetRules) {
      const p = r.params as AlertParams;
      const preset = getPreset(p.presetId);
      if (!preset) continue;
      const current = universe.filter((row) => preset.match(row)).map((row) => row.ticker);
      const currentSet = new Set(current);
      const last = Array.isArray((r.state as { last_entrants?: string[] })?.last_entrants)
        ? (r.state as { last_entrants: string[] }).last_entrants
        : null;

      // First run → seed only (no fire), so members don't get a wall on setup.
      if (last === null) {
        await db.from("alert_rules").update({ state: { last_entrants: current.slice(0, 400) } }).eq("id", r.id);
        continue;
      }
      const newcomers = current.filter((t) => !last.includes(t));
      if (newcomers.length > 0 && !firedToday(r)) {
        const priced = new Map(universe.map((row) => [row.ticker, row.price]));
        // Fire a single event summarizing up to 5 new names (kept honest + brief).
        const shown = newcomers.slice(0, 5);
        const mode = await fire(db, r.id, {
          ticker: shown[0],
          message: `${newcomers.length} new name${newcomers.length > 1 ? "s" : ""} in "${p.presetLabel ?? preset.label}": ${shown.join(", ")}${newcomers.length > 5 ? "…" : ""}`,
          condition: `preset:${preset.id}`,
          snapshot_price: priced.get(shown[0]) ?? null,
          newcomers: shown,
        });
        if (mode === "push") fired++;
        else if (mode === "digest") held++;
      }
      // Always refresh the stored set.
      await db.from("alert_rules").update({ state: { last_entrants: current.slice(0, 400) } }).eq("id", r.id);
    }
  }

  return NextResponse.json({
    ok: true,
    rules: rules.length,
    ticker_rules: tickerRules.length,
    preset_rules: presetRules.length,
    fired_push: fired,
    held_digest: held,
  });
}

type Db = ReturnType<typeof createAdminClient>;

async function fire(
  db: Db,
  ruleId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const { data } = await db.rpc("fire_rule_event", {
    p_rule_id: ruleId,
    p_payload: payload,
  });
  return (data as string) || "none";
}

/** Paginated full-universe read for preset diffs (PostgREST 1000-row cap). */
async function loadUniverse(db: Db): Promise<ScreenerRow[]> {
  const COLS =
    "ticker, name, sector, exchange, type, mcap, price, chg_1d, chg_5d, chg_1m, chg_3m, vol, avg_vol_20, vol_ratio, dist_52w_high, dist_52w_low, rsi14, ema20_state, ema50_state, gap_pct";
  const PAGE = 1000;
  let from = 0;
  const out: ScreenerRow[] = [];
  for (;;) {
    const { data, error } = await db
      .from("screener_metrics")
      .select(COLS)
      .order("ticker", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    out.push(...(data as unknown as ScreenerRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}
