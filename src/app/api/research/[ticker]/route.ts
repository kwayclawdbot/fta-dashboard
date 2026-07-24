import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeSymbol } from "@/lib/market/polygon";
import { getResearchPayload } from "@/lib/research/aggregate";

/**
 * GET /api/research/[ticker]
 *
 * The Lane 9 aggregate — client refresh path. Auth (any member tier) + delegate
 * to the shared server aggregate in @/lib/research/aggregate, which the
 * /research/[ticker] server page also uses for server-first first paint. One
 * implementation, two entry points.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await ctx.params;
  const ticker = normalizeSymbol(rawTicker);
  if (!ticker) {
    return NextResponse.json({ error: "bad-ticker" }, { status: 400 });
  }

  // Members-only (any tier). Presentation gating happens on the page.
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = await getResearchPayload(ticker);
  if (!payload) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
