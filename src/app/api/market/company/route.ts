import { NextRequest, NextResponse } from "next/server";
import { getCompany, getQuote, isConfigured } from "@/lib/market/polygon";

/**
 * GET /api/market/company?symbol=AAPL[&quote=1]
 *   → { company: { name, description, marketCap, marketCapText, logoUrl, ... } }
 *
 * `logoUrl` points at our own /api/market/logo proxy so the client never sees
 * the branding URL or the key. Company profile is stable → cached 24h.
 * Optional &quote=1 folds in a live quote (kept out of the long cache window by
 * a shorter s-maxage when requested).
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "market-data-unavailable" }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const withQuote = searchParams.get("quote") === "1";
  if (!symbol) {
    return NextResponse.json({ error: "missing-symbol" }, { status: 400 });
  }

  const company = await getCompany(symbol);
  if (!company) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const logoUrl = company.hasIcon || company.hasLogo
    ? `/api/market/logo?symbol=${encodeURIComponent(company.symbol)}`
    : null;

  const payload: Record<string, unknown> = {
    company: {
      symbol: company.symbol,
      name: company.name,
      description: company.description,
      marketCap: company.marketCap,
      marketCapText: company.marketCapText,
      homepage: company.homepage,
      primaryExchange: company.primaryExchange,
      sector: company.sector,
      logoUrl,
    },
  };

  // 24h for the stable profile; 60s when a live quote is bundled in.
  let cache = "public, s-maxage=86400, stale-while-revalidate=172800";
  if (withQuote) {
    payload.quote = await getQuote(company.symbol);
    cache = "public, s-maxage=60, stale-while-revalidate=120";
  }

  return NextResponse.json(payload, { headers: { "Cache-Control": cache } });
}
