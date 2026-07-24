import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface RegisterBody {
  firstName?: string;
  email?: string;
  password?: string;
  phone?: string;
  quiz?: Record<string, unknown>;
  sessionId?: string;
  /** 5-Day Investing Challenge signup (Lane C7): grants a full-Club challenge
   *  pass (no card) that expires at the challenge end instead of a free tier. */
  challenge?: boolean;
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
  const password = body.password || "";
  const phone = (body.phone || "").trim();
  const quiz = body.quiz && typeof body.quiz === "object" ? body.quiz : {};
  const sessionId = (body.sessionId || "").trim();
  const isChallenge = body.challenge === true;

  const supabaseEarly = createAdminClient();

  // Email may arrive in the body OR already be captured on the funnel session
  // (the multi-page flow captures it at /save, before this password step).
  let email = (body.email || "").trim().toLowerCase();
  let sessionAnswers: Record<string, unknown> = {};
  if (sessionId) {
    const { data: fs } = await supabaseEarly
      .from("funnel_sessions")
      .select("email, answers")
      .eq("id", sessionId)
      .maybeSingle();
    if (fs) {
      if (!email && fs.email) email = String(fs.email).trim().toLowerCase();
      if (fs.answers && typeof fs.answers === "object") sessionAnswers = fs.answers;
    }
  }
  const mergedQuiz = { ...sessionAnswers, ...quiz };

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

  const supabase = supabaseEarly;

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

  // 3. Enrollment — the sole signal that derives the tier.
  //    Challenge signups (Lane C7) get a full-Club challenge_pass that expires
  //    at the challenge end; the pass is ACTIVE immediately (immediate full
  //    access per owner), and family_tiers resolves it to 'fic' until expiry,
  //    then 'free'. Everyone else gets the plain 'free' enrollment.
  if (isChallenge) {
    // challenge_end from app_settings (jsonb ISO string); default 2026-09-06.
    let challengeEnd = "2026-09-06T00:00:00Z";
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "challenge_end")
      .maybeSingle();
    if (typeof setting?.value === "string") challengeEnd = setting.value;
    await supabase.from("enrollments").insert({
      family_id: familyId,
      program: "challenge_pass",
      status: "active",
      expires_at: challengeEnd,
    });
  } else {
    await supabase
      .from("enrollments")
      .insert({ family_id: familyId, program: "free", status: "active" });
  }

  // 4. Link the parent profile (the handle_new_user trigger already made the
  //    row from the auth insert). Lane 8R: we deliberately do NOT set
  //    onboarding_complete here. The signup wizard is now the account-setup step
  //    for EVERY entry path — the dashboard gate routes this funnel parent into
  //    /onboarding (onboarding_complete stays false, the trigger's default)
  //    until they finish the wizard, which stamps the flag itself. The family
  //    already exists here, so the wizard skips family creation and just
  //    collects the profile answers + username + avatar.
  await supabase
    .from("profiles")
    .update({
      family_id: familyId,
      role: "parent",
      age_group: "adults",
      track: "adults",
      display_name: firstName,
      onboarding_complete: false,
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
    quiz: { ...mergedQuiz, phone: phone || null, first_name: firstName },
    source: isChallenge ? "challenge" : "funnel",
    session_id: session?.id ?? null,
  });

  // 7. Complete the funnel session — status 'registered' + link the user.
  if (sessionId) {
    await supabase
      .from("funnel_sessions")
      .update({
        status: "registered",
        user_id: userId,
        email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .then(undefined, () => {});
    await supabase
      .from("funnel_events")
      .insert({ session_id: sessionId, step: "register", event: "submit", meta: {} })
      .then(undefined, () => {});
  }

  // 8. Flip the partial marketing lead (source 'free_class') to registered.
  //    A /save-captured lead already exists; flip it to 'engaged' + tag it and
  //    bind the profile. If none exists (rare: someone skipped /save), create it.
  //    Wrapped so any marketing-schema drift never fails the signup.
  try {
    // Challenge signups get their own cohort source ('challenge') so the admin
    // challenge dashboard can isolate them; free-class signups stay 'free_class'.
    const leadSource = isChallenge ? "challenge" : "free_class";
    const baseTags = isChallenge
      ? ["challenge", "funnel", "registered"]
      : ["funnel", "registered"];
    const { data: lead } = await supabase
      .from("marketing_leads")
      .select("id, tags")
      .eq("email", email)
      .eq("source", leadSource)
      .maybeSingle();

    if (lead) {
      const tags = Array.from(new Set([...(lead.tags || []), ...baseTags]));
      await supabase
        .from("marketing_leads")
        .update({
          first_name: firstName,
          phone: phone || null,
          stage: "engaged",
          tags,
          converted_profile_id: userId,
          custom: { quiz: mergedQuiz, phone: phone || null },
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
      await supabase.from("marketing_lead_events").insert({
        lead_id: lead.id,
        type: "stage_changed",
        meta: { to: "engaged", reason: `${leadSource}_registered` },
      });
    } else {
      await supabase.from("marketing_leads").insert({
        email,
        first_name: firstName,
        phone: phone || null,
        source: leadSource,
        stage: "engaged",
        tags: baseTags,
        consent_source: isChallenge ? "challenge_funnel" : "free_class_funnel",
        converted_profile_id: userId,
        custom: { quiz: mergedQuiz, phone: phone || null },
      });
    }
  } catch {
    // marketing table absent or mid-migration — skip silently.
  }

  return NextResponse.json({
    ok: true,
    session: session ?? null,
  });
}
