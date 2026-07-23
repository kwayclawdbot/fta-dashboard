import { NextRequest, NextResponse } from "next/server";
import {
  getBars,
  getOHLCBars,
  getMarketState,
  isConfigured,
  isIntradayTimeframe,
  tfCacheSeconds,
} from "@/lib/market/polygon";

/**
 * GET /api/market/bars
 *
 *   Daily sparkline (unchanged — screener / watchlist / research charts):
 *     ?symbol=AAPL&range=3m   → { symbol, bars: [{ t, c }] }   (daily closes)
 *
 *   Intraday OHLCV (Simbot Live Market engine):
 *     ?symbol=AAPL&tf=5m      → { symbol, tf, bars: [{ t,o,h,l,c,v }], marketState }
 *     tf ∈ 1m | 3m | 5m | 15m | 30m | 1h | 1d | 1w   (all DELAYED ~15 min)
 *
 * The `range` (daily-close) path is preserved verbatim for backward compatibility;
 * the intraday path only activates when a valid `tf` param is supplied. Per-tf
 * cache TTLs (30-60s intraday, ~15m daily) come from the polygon lib.
 */
export const runtime = "nodejs";

const RANGE_DAYS: Record<string, number> = {
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
  "2y": 730,
};

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "market-data-unavailable" }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "missing-symbol" }, { status: 400 });
  }

  // ── Intraday OHLCV path (Simbot Live) ──────────────────────────────────────
  const tf = searchParams.get("tf");
  if (tf) {
    if (!isIntradayTimeframe(tf)) {
      return NextResponse.json({ error: "bad-timeframe" }, { status: 400 });
    }
    const [bars, marketState] = await Promise.all([
      getOHLCBars(symbol, tf),
      getMarketState(),
    ]);
    if (!bars) {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }
    const secs = tfCacheSeconds(tf);
    return NextResponse.json(
      { symbol: symbol.toUpperCase(), tf, bars, marketState, delayed: true },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${secs}, stale-while-revalidate=${secs * 2}`,
        },
      }
    );
  }

  // ── Daily close-only sparkline path (unchanged) ────────────────────────────
  const range = (searchParams.get("range") || "3m").toLowerCase();
  const days = RANGE_DAYS[range] ?? 90;
  const bars = await getBars(symbol, days);
  if (!bars) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  return NextResponse.json(
    { symbol: symbol.toUpperCase(), bars },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } }
  );
}
