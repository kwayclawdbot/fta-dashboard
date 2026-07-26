import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * ALERTS INGEST — the bridge from breakout-alert-system (Railway) into the app.
 *
 * The Railway morning/intraday scanner POSTs each broadcast here; we persist the
 * alerts into `trade_alerts` and fan them out to the opted-in audience (club
 * individuals default-ON, family-mode adults opt-in, kids NEVER — enforced in
 * the fanout_trade_alert definer RPC) as push/digest via the 028 pipe.
 *
 * Auth: shared secret in ALERTS_INGEST_SECRET, sent as `x-alerts-secret` or
 * `Authorization: Bearer <secret>`. Without the env set the route refuses
 * (fail-safe) so a misconfigured deploy never accepts unauthenticated writes.
 *
 * Body (see .planning/ALERTS-WIRING.md for the authoritative Railway-side spec):
 *   {
 *     "source": "kai_morning" | "kai_intraday",
 *     "alerts": [{
 *       "ticker": "NVDA",
 *       "direction": "long" | "short" | "watch",
 *       "setup_label": "Breakout continuation",
 *       "entry": 128.5,
 *       "levels": { "support": 122, "resistance": 131, "stop": 119.5 },
 *       "targets": [{ "price": 135, "label": "T1" }],
 *       "narrative": "…education-first read…",
 *       "chart_url": "https://…",
 *       "snapshot_price": 127.9
 *     }]
 *   }
 */

type Dir = "long" | "short" | "watch";
type Src = "kai_morning" | "kai_intraday";

interface InAlert {
  ticker?: string;
  direction?: string;
  setup_label?: string;
  entry?: number;
  levels?: Record<string, number>;
  targets?: { price: number; label?: string }[];
  narrative?: string;
  chart_url?: string;
  snapshot_price?: number;
}

const TICKER_RE = /^[A-Z]{1,6}(\.[A-Z]{1,2})?$/;

function normDir(v: unknown): Dir {
  return v === "long" || v === "short" || v === "watch" ? v : "watch";
}
function normSrc(v: unknown): Src {
  return v === "kai_intraday" ? "kai_intraday" : "kai_morning";
}
function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.ALERTS_INGEST_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "ALERTS_INGEST_SECRET not configured" },
      { status: 401 }
    );
  }
  const header =
    req.headers.get("x-alerts-secret") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (header !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { source?: string; alerts?: InAlert[] };
  try {
    body = (await req.json()) as { source?: string; alerts?: InAlert[] };
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const src = normSrc(body.source);
  const list = Array.isArray(body.alerts) ? body.alerts : [];
  if (list.length === 0) {
    return NextResponse.json({ error: "no alerts" }, { status: 400 });
  }

  const db = createAdminClient();
  const now = new Date().toISOString();

  const rows = list
    .map((a) => {
      const ticker = (a.ticker || "").trim().toUpperCase();
      if (!TICKER_RE.test(ticker)) return null;
      const entry = numOrNull(a.entry);
      const snap = numOrNull(a.snapshot_price) ?? entry;
      return {
        ticker,
        direction: normDir(a.direction),
        setup_label: a.setup_label?.slice(0, 120) ?? null,
        entry,
        levels: a.levels && typeof a.levels === "object" ? a.levels : {},
        targets: Array.isArray(a.targets) ? a.targets : [],
        narrative: a.narrative?.slice(0, 2000) ?? null,
        chart_url: a.chart_url?.slice(0, 500) ?? null,
        source: src,
        snapshot_price: snap,
        issued_at: now,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return NextResponse.json({ error: "no valid tickers" }, { status: 400 });
  }

  const { data: inserted, error } = await db
    .from("trade_alerts")
    .insert(rows)
    .select("id, ticker");

  if (error) {
    return NextResponse.json(
      { error: "insert failed", detail: error.message },
      { status: 500 }
    );
  }

  // Fan out each alert to the opted-in audience (push/digest, cap-aware). The
  // RPC handles kid-exclusion, mode-based default, and per-user daily caps.
  let totalPushed = 0;
  let totalHeld = 0;
  let setupsCreated = 0;
  for (const a of inserted || []) {
    const { data: res } = await db.rpc("fanout_trade_alert", { p_alert_id: a.id });
    const r = (res as { pushed?: number; held?: number }) || {};
    totalPushed += r.pushed ?? 0;
    totalHeld += r.held ?? 0;
    // Promote each broadcast to a followable SETUP lifecycle object (LANE A).
    // Idempotent (one setup per alert); members opt in via /api/alerts/setups.
    const { data: setupId } = await db.rpc("create_setup_from_alert", { p_alert_id: a.id });
    if (setupId) setupsCreated++;
  }

  return NextResponse.json({
    ok: true,
    source: src,
    alerts_ingested: inserted?.length ?? 0,
    pushed: totalPushed,
    held_for_digest: totalHeld,
    setups_created: setupsCreated,
  });
}
