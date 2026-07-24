import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateMarketWrap } from "@/lib/news/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Market Wrap cron (LANE 10) — one sonnet-5 article per slot.
 * Two Vercel Cron entries hit this route with ?slot=:
 *   • pre-open   ~13:00 UTC weekdays  (overnight/pre-market read)
 *   • post-close ~21:30 UTC weekdays  (the day's recap)
 *
 * Idempotent per slot/day (slug `market-wrap-YYYY-MM-DD-<slot>`): a re-run
 * skips an already-generated slot. Auth mirrors the other crons: Bearer
 * CRON_SECRET (Vercel injects it) or ?secret=. Without CRON_SECRET set the
 * route refuses — fail-safe.
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

  // slot: explicit ?slot= wins; else derive from the hour (pre-open before ~17 UTC).
  const raw = (req.nextUrl.searchParams.get("slot") || "").toLowerCase();
  const slot: "preopen" | "postclose" =
    raw === "preopen" || raw === "postclose"
      ? (raw as "preopen" | "postclose")
      : new Date().getUTCHours() < 17
        ? "preopen"
        : "postclose";
  const force = req.nextUrl.searchParams.get("force") === "1";

  try {
    const db = createAdminClient();
    const res = await generateMarketWrap(db, slot, { force });
    return NextResponse.json({ ok: true, slot, ...res });
  } catch (e) {
    return NextResponse.json(
      { error: "market wrap failed", detail: (e as Error).message },
      { status: 500 }
    );
  }
}
