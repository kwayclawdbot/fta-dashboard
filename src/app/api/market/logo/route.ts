import { NextRequest, NextResponse } from "next/server";
import { getLogoImage, isConfigured } from "@/lib/market/polygon";

/**
 * GET /api/market/logo?symbol=AAPL[&kind=logo]
 *   → the company's branding image bytes (real, legal logo source: Polygon
 *     company-branding). The upstream URL needs the API key appended, so we
 *     fetch it server-side and stream the bytes — the client only ever sees
 *     this key-free proxy. Cached hard (24h) since brand logos rarely change.
 *
 * kind: "icon" (square, default) | "logo" (wordmark).
 */
export const runtime = "nodejs";

/* ETFs have no company branding at Polygon — a fund is not a company, so the
   upstream 404 is correct rather than a gap to be patched with a scraped image.
   The six the app actually renders get a plain typographic mark of our own
   (`public/etf/*.svg`: the ticker set on a neutral tile, no trademark imagery),
   so an index row does not sit next to an equity looking broken. Everything
   else still 404s — and now WITH a Cache-Control, because the miss was
   re-hitting origin on every render. */
const ETF_MARKS = new Set(["SPY", "QQQ", "IWM", "VOO", "DIA", "VTI"]);

/** A miss is as cacheable as a hit: a company that has no logo today still has
 *  no logo an hour from now, and the un-cached 404 was the expensive path. */
const MISS_CACHE = "public, s-maxage=604800, max-age=86400, stale-while-revalidate=604800";

function missResponse(req: NextRequest, sym: string, status: 404 | 503) {
  if (ETF_MARKS.has(sym)) {
    // The SVG is a static asset, so it is served by the CDN rather than read off
    // the function's filesystem (which Next does not trace for dynamic paths).
    return NextResponse.redirect(new URL(`/etf/${sym}.svg`, req.url), {
      status: 307,
      headers: { "Cache-Control": MISS_CACHE },
    });
  }
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": MISS_CACHE },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const kind = searchParams.get("kind") === "logo" ? "logo" : "icon";
  if (!symbol) return new NextResponse(null, { status: 400 });
  const sym = symbol.trim().toUpperCase();

  if (!isConfigured()) return missResponse(req, sym, 503);

  const img = await getLogoImage(symbol, kind);
  if (!img) return missResponse(req, sym, 404);

  return new NextResponse(img.bytes, {
    status: 200,
    headers: {
      "Content-Type": img.contentType,
      "Cache-Control": "public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800, immutable",
    },
  });
}
