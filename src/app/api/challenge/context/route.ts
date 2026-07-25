import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/challenge/context — thank-you page context for a signed-in challenge
 * registrant (Lane C9). Returns:
 *   • ages     — the step-1 "who's learning with you" answer (drives Family Mode
 *                surfacing: kids → family setup prompt; 'adults' → solo, none).
 *   • isVip    — whether this family already holds a paid VIP ticket (shows the
 *                VIP confirmation instead of the upsell).
 *   • vipEnabled — whether the live VIP checkout path is open yet (gate).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdminClient();

  const { data: prof } = await admin
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .maybeSingle();
  const familyId = prof?.family_id ?? null;

  // Latest quiz answer set for this user (funnel captured ages at step 1).
  const { data: reg } = await admin
    .from("free_class_registrations")
    .select("quiz")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ages =
    (reg?.quiz && typeof reg.quiz === "object"
      ? (reg.quiz as Record<string, unknown>).ages
      : null) ?? null;

  let isVip = false;
  if (familyId) {
    const { data: vip } = await admin
      .from("challenge_vips")
      .select("id")
      .eq("family_id", familyId)
      .maybeSingle();
    isVip = !!vip;
  }

  const { data: gate } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "challenge_vip_enabled")
    .maybeSingle();

  return NextResponse.json({
    ages: typeof ages === "string" ? ages : null,
    isVip,
    vipEnabled: gate?.value === true,
  });
}
