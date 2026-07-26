import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evalNightly,
  evalSentimentVelocity,
  evalNewsEvent,
  sentimentBaseMet,
  ALERT_SIGNAL_FLOORS,
  KAI_WATCH_KINDS,
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
    .in("kind", [
      "rsi_cross",
      "ema_cross",
      "w52_break",
      "pct_move",
      "preset_match",
      "sentiment_velocity",
      "news_event",
    ]);

  const rules = (ruleData || []) as unknown as AlertRule[];
  if (rules.length === 0) {
    return NextResponse.json({ ok: true, rules: 0, fired: 0 });
  }

  // Skip rules that already fired today (per-day dedup).
  const firedToday = (r: AlertRule) =>
    r.last_fired_at != null && new Date(r.last_fired_at) >= todayStart;

  const tickerRules = rules.filter(
    (r) =>
      r.kind !== "preset_match" &&
      !KAI_WATCH_KINDS.includes(r.kind) &&
      r.ticker &&
      !firedToday(r)
  );
  const presetRules = rules.filter((r) => r.kind === "preset_match");
  // R4 Kai-Watch kinds evaluate off community/newsroom data, not screener price.
  const kaiRules = rules.filter(
    (r) => KAI_WATCH_KINDS.includes(r.kind) && r.ticker && !firedToday(r)
  );

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

  // ── Kai-Watch kinds: community sentiment velocity + fresh news events ──────
  if (kaiRules.length > 0) {
    const kaiTickers = [...new Set(kaiRules.map((r) => r.ticker!.toUpperCase()))];

    // Current net community sentiment (precomputed) + total votes (for the
    // small-N floor) + latest chg / price.
    const netByTicker = new Map<string, number>();
    const votesByTicker = new Map<string, number>();
    const chgByTicker = new Map<string, number | null>();
    const priceByTicker = new Map<string, number | null>();
    const { data: lc } = await db
      .from("ticker_like_counts")
      .select("ticker, net, likes, unlikes")
      .in("ticker", kaiTickers);
    for (const r of (lc || []) as {
      ticker: string;
      net: number | null;
      likes: number | null;
      unlikes: number | null;
    }[]) {
      netByTicker.set(r.ticker, r.net ?? 0);
      votesByTicker.set(r.ticker, (r.likes ?? 0) + (r.unlikes ?? 0));
    }
    const { data: mx } = await db
      .from("screener_metrics")
      .select("ticker, chg_1d, price")
      .in("ticker", kaiTickers);
    for (const m of (mx || []) as {
      ticker: string;
      chg_1d: number | null;
      price: number | null;
    }[]) {
      chgByTicker.set(m.ticker, m.chg_1d);
      priceByTicker.set(m.ticker, m.price);
    }

    // Latest fresh ticker-event per ticker (last 3 days).
    const newsCut = new Date(Date.now() - 3 * 864e5).toISOString();
    const { data: news } = await db
      .from("news_articles")
      .select("tickers, generated_at")
      .eq("kind", "ticker_event")
      .eq("published", true)
      .gte("generated_at", newsCut);
    const newsByTicker = new Map<string, string>();
    for (const n of (news || []) as {
      tickers: string[] | null;
      generated_at: string;
    }[]) {
      for (const t of n.tickers || []) {
        const cur = newsByTicker.get(t);
        if (!cur || n.generated_at > cur) newsByTicker.set(t, n.generated_at);
      }
    }

    for (const r of kaiRules) {
      const tk = r.ticker!.toUpperCase();
      if (r.kind === "sentiment_velocity") {
        const cur = netByTicker.has(tk) ? netByTicker.get(tk)! : null;
        const st = (r.state || {}) as { base_net?: number };
        const base = typeof st.base_net === "number" ? st.base_net : null;
        // ABSOLUTE FLOOR (§2c): a swing only counts once enough community votes
        // back it — otherwise a 1–2 vote ticker fakes a "the club turned" signal.
        const totalVotes = votesByTicker.get(tk) ?? 0;
        if (!sentimentBaseMet(totalVotes)) {
          console.log(
            `[evaluate-alerts] skip sentiment_velocity ${tk} rule ${r.id}: ` +
              `only ${totalVotes} votes < floor (${ALERT_SIGNAL_FLOORS.sentimentVelocityMinVotes})`
          );
          // Still seed the baseline so a future, well-backed swing is measurable.
          if (base === null && cur !== null)
            await db
              .from("alert_rules")
              .update({ state: { ...st, base_net: cur } })
              .eq("id", r.id);
          continue;
        }
        const hit = evalSentimentVelocity(r, cur, base);
        if (!hit) {
          // Seed the baseline on first sighting so future swings are measurable.
          if (base === null && cur !== null)
            await db
              .from("alert_rules")
              .update({ state: { ...st, base_net: cur } })
              .eq("id", r.id);
          continue;
        }
        const mode = await fire(db, r.id, {
          ticker: r.ticker,
          message: hit.message,
          condition: hit.condition,
          snapshot_price: priceByTicker.get(tk) ?? null,
        });
        await db
          .from("alert_rules")
          .update({ state: { ...st, base_net: hit.newBase } })
          .eq("id", r.id);
        if (mode === "push") fired++;
        else if (mode === "digest") held++;
      } else {
        // news_event
        const evtIso = newsByTicker.get(tk);
        const fresh =
          !!evtIso &&
          (r.last_fired_at == null || evtIso > r.last_fired_at) &&
          (r.created_at == null || evtIso >= r.created_at);
        const hit = evalNewsEvent(r, fresh, chgByTicker.get(tk) ?? null);
        if (!hit) continue;
        const mode = await fire(db, r.id, {
          ticker: r.ticker,
          message: hit.message,
          condition: hit.condition,
          snapshot_price: priceByTicker.get(tk) ?? null,
        });
        if (mode === "push") fired++;
        else if (mode === "digest") held++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    rules: rules.length,
    ticker_rules: tickerRules.length,
    preset_rules: presetRules.length,
    kai_rules: kaiRules.length,
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
