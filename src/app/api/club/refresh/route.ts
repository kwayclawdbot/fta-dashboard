import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST/GET /api/club/refresh — recompute the ClubHome cached aggregates.
 *
 * Driven by Vercel Cron (see vercel.json) the same way every other periodic job
 * in this app runs (pg_cron is not enabled). Secret-guarded exactly like the
 * other crons: Bearer CRON_SECRET or ?secret=. Delegates to the SECURITY DEFINER
 * refresh_club_metrics() which holds an advisory lock (safe to call often).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") || "";
  const qsSecret = req.nextUrl.searchParams.get("secret") || "";
  if (!(auth === `Bearer ${secret}` || qsSecret === secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc("refresh_club_metrics");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, result: data });
}

export const GET = handle;
export const POST = handle;
