import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Auth-aware funnel status for the current visitor.
 *
 * The funnel landing must only bounce a signed-in visitor to the confirmation
 * hub when they have ACTUALLY registered for a free class — i.e. they own a row
 * in free_class_registrations. Members / admins / free users who never went
 * through the funnel are NOT registered and should see the funnel normally.
 *
 * Reads the session from the cookie-bound server client, then checks the
 * registration table with the service client (bypasses RLS for a reliable
 * server-side answer).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ signedIn: false, registered: false });
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("free_class_registrations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const meta = (user.user_metadata || {}) as { display_name?: string };

  return NextResponse.json({
    signedIn: true,
    registered: (count ?? 0) > 0,
    firstName: meta.display_name || "",
  });
}
