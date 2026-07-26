import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/alerts/setups — list Kai Daily / broadcast SETUP lifecycle objects
 * (LANE A backend; the "Watch this setup" UI lands in Lane B).
 *
 * Returns recent + live setups with their lifecycle state and whether the
 * current member is subscribed (opted in to follow the thread). Members-only;
 * presentation gating (tier/register) is the page's job, same as /alerts.
 *
 * Query: ?state=live  → only waiting/confirmed; default returns recent (any).
 *        ?limit=N     → cap (default 40, max 100).
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const wantLive = req.nextUrl.searchParams.get("state") === "live";
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "40", 10) || 40)
  );

  let q = supabase
    .from("alert_setups")
    .select(
      "id, alert_id, ticker, direction, thesis, entry, levels, snapshot_price, state, state_entered_at, expires_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (wantLive) q = q.in("state", ["waiting", "confirmed"]);

  const { data: setups, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (setups || []) as { id: string }[];
  // Which of these is the member following? (own-row RLS scopes this read.)
  const subscribed = new Set<string>();
  if (rows.length > 0) {
    const { data: subs } = await supabase
      .from("setup_subscriptions")
      .select("setup_id")
      .in(
        "setup_id",
        rows.map((r) => r.id)
      );
    for (const s of (subs || []) as { setup_id: string }[]) subscribed.add(s.setup_id);
  }

  return NextResponse.json({
    ok: true,
    setups: rows.map((r) => ({ ...r, subscribed: subscribed.has(r.id) })),
  });
}
