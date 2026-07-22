import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface RegisterBody {
  firstName?: string;
  email?: string;
  password?: string;
  phone?: string;
  quiz?: Record<string, unknown>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public — free-class funnel registration.
 *
 * Creates a real FREE-tier app user with NO email dependency (the Resend mailer
 * is rate-limited): the auth user is created email-confirmed via the service
 * client, so the client can immediately signInWithPassword. Also creates the
 * family (tier free via a 'free' enrollment), completes the parent profile,
 * RSVPs them to the next free class, records the funnel registration, and
 * best-effort mirrors a marketing-CRM lead.
 */
export async function POST(req: Request) {
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const firstName = (body.firstName || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const phone = (body.phone || "").trim();
  const quiz = body.quiz && typeof body.quiz === "object" ? body.quiz : {};

  if (!firstName) {
    return NextResponse.json({ error: "Please enter your first name." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Next upcoming free class (for the RSVP + confirmation card).
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: session } = await supabase
    .from("live_sessions")
    .select("id, title, description, scheduled_at, duration_min, zoom_join_url")
    .eq("class_type", "free_class")
    .neq("status", "cancelled")
    .gte("scheduled_at", cutoff)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // 1. Auth user — email pre-confirmed (no mailer), so sign-in works instantly.
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: firstName, role: "parent" },
  });

  if (createErr || !created?.user) {
    const msg = createErr?.message || "";
    if (/already|exists|registered/i.test(msg)) {
      return NextResponse.json(
        { error: "An account with that email already exists. Please log in.", code: "exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not create your account." }, { status: 500 });
  }

  const userId = created.user.id;

  // 2. Family (tier derived free via the 'free' enrollment below).
  const { data: fam, error: famErr } = await supabase
    .from("families")
    .insert({ name: `${firstName}'s Family` })
    .select("id")
    .single();
  if (famErr || !fam) {
    // Roll back the auth user so a retry with the same email can succeed.
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json({ error: "Could not set up your family." }, { status: 500 });
  }
  const familyId = fam.id as string;

  // 3. FREE enrollment — the sole signal that derives tier 'free'.
  await supabase
    .from("enrollments")
    .insert({ family_id: familyId, program: "free", status: "active" });

  // 4. Complete the parent profile (the handle_new_user trigger already made
  //    the row from the auth insert).
  await supabase
    .from("profiles")
    .update({
      family_id: familyId,
      role: "parent",
      age_group: "adults",
      track: "adults",
      display_name: firstName,
      onboarding_complete: true,
    })
    .eq("id", userId);

  // 5. RSVP to the free class (if one is scheduled).
  if (session?.id) {
    await supabase
      .from("session_rsvps")
      .insert({ session_id: session.id, user_id: userId, family_id: familyId })
      .then(undefined, () => {});
  }

  // 6. Funnel registration record.
  await supabase.from("free_class_registrations").insert({
    user_id: userId,
    email,
    quiz: { ...quiz, phone: phone || null, first_name: firstName },
    source: "funnel",
    session_id: session?.id ?? null,
  });

  // 7. Best-effort marketing-CRM lead. The marketing_leads.source enum (owned by
  //    the marketing module) does not include 'free_class', so we record an
  //    allowed source and tag the origin instead. Wrapped so a concurrent schema
  //    change or a missing table never fails the signup.
  try {
    await supabase.from("marketing_leads").insert({
      email,
      first_name: firstName,
      phone: phone || null,
      source: "manual",
      stage: "engaged",
      tags: ["free_class", "funnel"],
      consent_source: "free_class_funnel",
      converted_profile_id: userId,
      custom: { quiz, phone: phone || null },
    });
  } catch {
    // marketing table absent or mid-migration — skip silently.
  }

  return NextResponse.json({
    ok: true,
    session: session ?? null,
  });
}
