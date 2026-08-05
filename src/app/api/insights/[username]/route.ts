import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeUserInsights } from "@/lib/insights/compute";

export const dynamic = "force-dynamic";

/**
 * POST /api/insights/[username] — recompute a member's "HOW THEY INVEST" digest.
 *
 * The caller is read from the SESSION, never the body (same discipline as
 * /api/family/night). A member may recompute their OWN insights; an admin may
 * recompute anyone's. computeUserInsights writes through the service role, so
 * the recompute reads every source table and upserts user_insights regardless
 * of RLS. The deterministic fields always land; kai_read is best-effort and
 * stays null when the model is unavailable.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  // Resolve the target member from the handle (server-side, never trusted body).
  const { data: target } = await admin
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  // Own insights, or admin. Read the caller's role from the DB.
  if (target.id !== user.id) {
    const { data: me } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if ((me as { role: string | null } | null)?.role !== "admin") {
      return NextResponse.json(
        { error: "You can only recompute your own insights." },
        { status: 403 }
      );
    }
  }

  const insights = await computeUserInsights(target.id);
  return NextResponse.json({ insights });
}
