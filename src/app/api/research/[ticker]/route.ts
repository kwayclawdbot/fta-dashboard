import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeSymbol } from "@/lib/market/polygon";
import { getResearchPayload } from "@/lib/research/aggregate";
import { logClubEvent } from "@/lib/club/track";

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

  // Research premium-read METER (MONETIZATION-GATES.md): free tier gets 3 reads
  // per rolling week, then a contextual wall; Club/FTA unlimited. Server-
  // authoritative (never UI-only) — the definer RPC is the sole meter writer and
  // is idempotent per (user, ticker, week) so a re-open never burns a pass.
  const { data: meter } = await auth.rpc("consume_research_read", {
    p_ticker: ticker,
  });
  const m = (meter || {}) as {
    allowed?: boolean;
    unlimited?: boolean;
    used?: number;
    cap?: number;
  };
  if (m.allowed === false) {
    return NextResponse.json(
      {
        error: "research_metered",
        walled: true,
        feature: "research_unlimited",
        used: m.used ?? 3,
        cap: m.cap ?? 3,
      },
      { status: 402 }
    );
  }

  const payload = await getResearchPayload(ticker);
  if (!payload) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  // ClubHome instrumentation: log a research_view (best-effort, non-blocking) so
  // the Club Score pipeline can weight this ticker's community attention.
  void logClubEvent(auth, user.id, "research_view", ticker);

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
