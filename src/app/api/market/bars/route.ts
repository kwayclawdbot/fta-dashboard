import { NextRequest, NextResponse } from "next/server";
import { getBars, isConfigured } from "@/lib/market/polygon";

/**
 * GET /api/market/bars?symbol=AAPL&range=3m
 *   → { symbol, bars: [{ t, c }] }
 *
 * Daily closing bars for the lightweight local sparkline that replaces the
 * TradingView mini iframes. Cached ~15 min.
 */
export const runtime = "nodejs";

const RANGE_DAYS: Record<string, number> = {
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "market-data-unavailable" }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const range = (searchParams.get("range") || "3m").toLowerCase();
  const days = RANGE_DAYS[range] ?? 90;
  if (!symbol) {
    return NextResponse.json({ error: "missing-symbol" }, { status: 400 });
  }

  const bars = await getBars(symbol, days);
  if (!bars) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  return NextResponse.json(
    { symbol: symbol.toUpperCase(), bars },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } }
  );
}
