import { NextRequest, NextResponse } from "next/server";
import { getQuote, getQuotes, isConfigured } from "@/lib/market/polygon";

/**
 * GET /api/market/quote?symbol=AAPL         → one quote
 * GET /api/market/quote?symbols=AAPL,MSFT    → { quotes: { AAPL: {...}, ... } }
 *
 * Delayed (~15 min) price + day change. Cached ~60s at the CDN + warm instance.
 * The Polygon key never leaves the server.
 */
export const runtime = "nodejs";

const CACHE = "public, s-maxage=60, stale-while-revalidate=120";

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "market-data-unavailable" }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  const symbols = searchParams.get("symbols");
  const symbol = searchParams.get("symbol");

  if (symbols) {
    const list = symbols.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
    const quotes = await getQuotes(list);
    return NextResponse.json({ quotes }, { headers: { "Cache-Control": CACHE } });
  }

  if (!symbol) {
    return NextResponse.json({ error: "missing-symbol" }, { status: 400 });
  }
  const quote = await getQuote(symbol);
  if (!quote) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ quote }, { headers: { "Cache-Control": CACHE } });
}
