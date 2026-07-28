import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildTodayLoop } from "@/lib/club/today";

/**
 * GET /api/club/today → TodayLoop
 *
 * The client-side twin of the RSC seed. /dashboard builds this payload inline
 * and hands it across the boundary; this route serves the SAME builder for the
 * paths that have no seed (client-side navigation into Home, the family/teen
 * fallback client, a seed that failed to build). One builder, two callers, so
 * the two can never drift.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const loop = await buildTodayLoop(supabase, user.id);
    return NextResponse.json(loop);
  } catch (err) {
    console.error("[club/today] failed:", err);
    // Every field null = "nothing landed", which the UI renders as an absence.
    return NextResponse.json({
      lesson: null,
      streakDays: null,
      actedToday: false,
      cardsDue: null,
      watchTriggered: null,
    });
  }
}
