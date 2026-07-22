import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface ReserveBody {
  sessionId?: string;
}

/**
 * Authenticated — reserve a free-class seat for an ALREADY signed-in user.
 *
 * Members / admins / free users who go through the funnel already have an
 * account, so they must NOT hit the create-account step. This registers their
 * existing account for the next free class directly: RSVP + a
 * free_class_registrations row (which is what the landing uses to know they're
 * registered), and completes the funnel session. Fully idempotent.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: ReserveBody = {};
  try {
    body = (await req.json()) as ReserveBody;
  } catch {
    /* body optional */
  }
  const sessionId = (body.sessionId || "").trim();

  const admin = createAdminClient();
  const userId = user.id;
  const email = (user.email || "").trim().toLowerCase();

  // Existing profile (for family + display name). Members always have one.
  const { data: profile } = await admin
    .from("profiles")
    .select("family_id, display_name")
    .eq("id", userId)
    .maybeSingle();
  const familyId = profile?.family_id ?? null;
  const firstName =
    (user.user_metadata as { display_name?: string })?.display_name ||
    profile?.display_name ||
    "";

  // Merge any quiz answers captured on the funnel session.
  let sessionAnswers: Record<string, unknown> = {};
  if (sessionId) {
    const { data: fs } = await admin
      .from("funnel_sessions")
      .select("answers")
      .eq("id", sessionId)
      .maybeSingle();
    if (fs?.answers && typeof fs.answers === "object") sessionAnswers = fs.answers;
  }

  // Next upcoming free class.
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: session } = await admin
    .from("live_sessions")
    .select("id, title, description, scheduled_at, duration_min, zoom_join_url")
    .eq("class_type", "free_class")
    .neq("status", "cancelled")
    .gte("scheduled_at", cutoff)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // RSVP (idempotent — unique on session_id+user_id).
  if (session?.id) {
    await admin
      .from("session_rsvps")
      .upsert(
        { session_id: session.id, user_id: userId, family_id: familyId },
        { onConflict: "session_id,user_id" }
      )
      .then(undefined, () => {});
  }

  // Registration row — only insert if the user doesn't already have one, so a
  // double-click can't create duplicates.
  const { count: existing } = await admin
    .from("free_class_registrations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((existing ?? 0) === 0) {
    await admin.from("free_class_registrations").insert({
      user_id: userId,
      email: email || `${userId}@members.local`,
      quiz: { ...sessionAnswers, first_name: firstName, member: true },
      source: "funnel_member",
      session_id: session?.id ?? null,
    });
  }

  // Complete the funnel session.
  if (sessionId) {
    await admin
      .from("funnel_sessions")
      .update({
        status: "registered",
        user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .then(undefined, () => {});
    await admin
      .from("funnel_events")
      .insert({ session_id: sessionId, step: "register", event: "submit", meta: { member: true } })
      .then(undefined, () => {});
  }

  return NextResponse.json({ ok: true, session: session ?? null });
}
