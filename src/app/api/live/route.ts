import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listLiveEvents } from "@/lib/live/queries";

/**
 * GET /api/live
 *   → { live: LiveEventCardData[], upcoming: [...], replays: [...] }
 *
 * The member-readable live_event list (S2.5): LIVE + starting-soon first, then
 * upcoming scheduled by soonest, then recent replays. Card-shaped (shared props
 * contract) with each event's own `interested` flag resolved for the viewer.
 * live_events is member-readable RLS, so we read through the user-scoped client.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await listLiveEvents(supabase, user.id);
  return NextResponse.json(result);
}
