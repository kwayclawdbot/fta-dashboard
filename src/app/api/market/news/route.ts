import { NextRequest, NextResponse } from "next/server";
import { getNews, isConfigured } from "@/lib/market/polygon";

/**
 * GET /api/market/news?symbol=AAPL[&limit=6]
 *   → { symbol, news: [{ title, url, publisher, published, description }] }
 *
 * Third-party headlines from Polygon, surfaced as ATTRIBUTION-ONLY link cards
 * on the research page (title + source + timestamp, links out — never scraped
 * full text, copyright-safe). Cached 15 min at the edge.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ symbol: "", news: [] });
  }
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "missing-symbol" }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 6, 1), 12);
  const news = await getNews(symbol, limit);
  return NextResponse.json(
    { symbol: symbol.toUpperCase(), news },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } }
  );
}
