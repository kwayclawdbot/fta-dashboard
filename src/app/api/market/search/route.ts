import { NextRequest, NextResponse } from "next/server";
import { searchTickers, isConfigured } from "@/lib/market/polygon";

/**
 * GET /api/market/search?q=apple
 *   → { results: [{ ticker, name }] }
 *
 * Polygon reference search powers the watchlist add-flow (ticker
 * lookup/validation beats free-text). Cached 24h per query.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ results: [] });
  }
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  if (q.trim().length < 1) {
    return NextResponse.json({ results: [] });
  }
  const results = await searchTickers(q);
  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" } }
  );
}
