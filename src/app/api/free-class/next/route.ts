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

  const [{ data: session }, { data: setting }] = await Promise.all([
    supabase
      .from("live_sessions")
      .select(
        "id, title, description, scheduled_at, duration_min, zoom_join_url"
      )
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
  ]);

  const videoUrl =
    typeof setting?.value === "string" ? setting.value : setting?.value ?? null;

  return NextResponse.json({ session: session ?? null, video_url: videoUrl });
}
