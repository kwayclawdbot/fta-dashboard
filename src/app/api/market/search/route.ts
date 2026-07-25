import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rankTickerHits,
  type SearchCandidate,
} from "@/lib/market/ticker-search";
import { formatExchange } from "@/lib/market/exchange";

/**
 * GET /api/market/search?q=apple
 *   → { results: [{ ticker, name, exchange, type }] }
 *
 * The single symbol-suggest path for EVERY search bar (watchlist add, community
 * ticker tagger, admin watchlist, …). It ranks against `screener_metrics` — the
 * clean, de-duplicated universe (common + ETF on the major US venues, no
 * warrants / units / OTC / foreign cross-listings) — so exact-symbol matches win
 * and majors surface first (see lib/market/ticker-search.ts). Cached 24h.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const db = createAdminClient();

  // Two DB reads, merged, then ranked in pure JS (so ranking stays testable):
  //   (1) the EXACT ticker — always present even when a short prefix like "A"
  //       has hundreds of matches that would crowd it out of a capped list.
  //   (2) prefix / name-substring candidates, ordered mcap-desc so a broad
  //       prefix surfaces the majors (not arbitrary rows) within the 60 cap.
  // PostgREST `.or()` uses ilike with `%` wildcards; strip filter metachars.
  const like = q.replace(/[%,()]/g, "");
  const cols = "ticker, name, exchange, type, mcap";
  const [exactRes, candRes] = await Promise.all([
    db.from("screener_metrics").select(cols).ilike("ticker", like).limit(1),
    db
      .from("screener_metrics")
      .select(cols)
      .or(`ticker.ilike.${like}%,name.ilike.%${like}%`)
      .not("price", "is", null)
      .order("mcap", { ascending: false, nullsFirst: false })
      .limit(60),
  ]);

  if (candRes.error && exactRes.error) {
    return NextResponse.json({ results: [] });
  }

  const merged = [
    ...((exactRes.data as SearchCandidate[]) ?? []),
    ...((candRes.data as SearchCandidate[]) ?? []),
  ];
  const results = rankTickerHits(merged, q, 8).map((h) => ({
    ...h,
    exchange: formatExchange(h.exchange),
  }));
  return NextResponse.json(
    { results },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
      },
    }
  );
}
