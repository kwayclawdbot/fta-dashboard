import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTickerEvents } from "@/lib/news/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Ticker-events cron (LANE 10) — daily post-close. Ranks the day's notable
 * events from screener_metrics deltas (|chg|>=8% / vol_ratio>=3 / fresh 52w
 * high/low) and writes a short haiku-4.5 note for the top 6-8, each grounded
 * in the metric + any matching Polygon headline.
 *
 * Idempotent per ticker/day (slug `<ticker>-YYYY-MM-DD`): re-runs skip events
 * already written. Auth mirrors the other crons.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") || "";
  const qsSecret = req.nextUrl.searchParams.get("secret") || "";
  if (!(auth === `Bearer ${secret}` || qsSecret === secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const max = Math.min(8, Math.max(1, Number(req.nextUrl.searchParams.get("max")) || 8));

  try {
    const db = createAdminClient();
    const res = await generateTickerEvents(db, { force, max });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json(
      { error: "ticker events failed", detail: (e as Error).message },
      { status: 500 }
    );
  }
}
