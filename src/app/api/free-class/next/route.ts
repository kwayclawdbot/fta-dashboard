import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Public — the next upcoming free class + the funnel video URL.
 * No auth: this powers the social-traffic funnel landing page.
 *
 * "Next" = the soonest free_class session that hasn't ended, i.e. scheduled in
 * the future (or started within the last 2h so a live/just-started class still
 * shows). Uses the service client so it reads regardless of RLS.
 */
export async function GET() {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const [{ data: session }, { data: setting }, { data: seatSetting }, { count: regCount }] =
    await Promise.all([
      supabase
        .from("live_sessions")
        .select("id, title, description, scheduled_at, duration_min, zoom_join_url")
        .eq("class_type", "free_class")
        .neq("status", "cancelled")
        .gte("scheduled_at", cutoff)
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("app_settings")
        .select("value")
        .eq("key", "free_class_video_url")
        .maybeSingle(),
      supabase
        .from("app_settings")
        .select("value")
        .eq("key", "free_class_seats_left")
        .maybeSingle(),
      supabase
        .from("free_class_registrations")
        .select("id", { count: "exact", head: true }),
    ]);

  const videoUrl =
    typeof setting?.value === "string" ? setting.value : setting?.value ?? null;

  // Seats: honest scarcity. app_settings value is a jsonb number (or null → hide).
  const seatsLeft =
    typeof seatSetting?.value === "number" ? seatSetting.value : null;

  // Social proof: real count of free-class registrations. Hidden under 5 by the UI.
  const registeredCount = typeof regCount === "number" ? regCount : 0;

  return NextResponse.json({
    session: session ?? null,
    video_url: videoUrl,
    seats_left: seatsLeft,
    registered_count: registeredCount,
  });
}
