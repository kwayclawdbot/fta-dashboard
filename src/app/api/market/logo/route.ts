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

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return new NextResponse(null, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const kind = searchParams.get("kind") === "logo" ? "logo" : "icon";
  if (!symbol) return new NextResponse(null, { status: 400 });

  const img = await getLogoImage(symbol, kind);
  if (!img) return new NextResponse(null, { status: 404 });

  return new NextResponse(img.bytes, {
    status: 200,
    headers: {
      "Content-Type": img.contentType,
      "Cache-Control": "public, s-maxage=86400, max-age=86400, stale-while-revalidate=604800, immutable",
    },
  });
}
