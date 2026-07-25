import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyContinuationToken } from "@/lib/server/challenge-token";

export const dynamic = "force-dynamic";

/**
 * POST /api/challenge/complete-account — finish setup for an email-first
 * challenger (C9b). The account already exists (created at email capture with a
 * random password); this sets the real password + name, records the quiz answers
 * (micro-commitment + Family-Mode signal), flips the CRM lead to
 * account-complete, and cancels the "finish setting up" nurture.
 *
 * Body: { token, firstName, password, quiz }. Returns { ok, email } so the
 * client can sign in (email + the password it just set) and land on the C7
 * thank-you. Idempotent-safe: re-completing just re-applies the same updates.
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; firstName?: string; password?: string; quiz?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const c = verifyContinuationToken(body.token || "");
  if (!c) return NextResponse.json({ error: "Your setup link has expired. Please start again." }, { status: 401 });

  const firstName = (body.firstName || "").trim();
  const password = body.password || "";
  const quiz = body.quiz && typeof body.quiz === "object" ? body.quiz : {};
  if (!firstName) return NextResponse.json({ error: "Please enter your first name." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Use at least 8 characters for your password." }, { status: 400 });

  const db = createAdminClient();
  const { userId, email, src } = c;

  // 1. Set the real password + display name on the existing auth user.
  const { error: updErr } = await db.auth.admin.updateUserById(userId, {
    password,
    user_metadata: { display_name: firstName, role: "parent" },
  });
  if (updErr) return NextResponse.json({ error: "Could not complete your account." }, { status: 500 });

  // 2. Profile — stamp the display name (its presence = setup complete).
  await db.from("profiles").update({ display_name: firstName }).eq("id", userId);

  // 3. Record the quiz answers on the challenge registration (Family-Mode signal
  //    for the thank-you). Update the most recent row for this user.
  const { data: reg } = await db
    .from("free_class_registrations")
    .select("id, quiz")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reg?.id) {
    const merged = { ...(reg.quiz as Record<string, unknown> | null), ...quiz, first_name: firstName };
    await db.from("free_class_registrations").update({ quiz: merged }).eq("id", reg.id);
  }

  // 4. CRM — flip the lead to account-complete (drops it out of the partial
  //    "registered-not-onboarded" bucket in /admin/crm/challenge).
  try {
    const { data: lead } = await db
      .from("marketing_leads")
      .select("id, tags, custom")
      .eq("email", email)
      .eq("source", "challenge")
      .maybeSingle();
    if (lead?.id) {
      const tags = Array.from(new Set([...(lead.tags || []), "account-complete"]));
      const custom = { ...(lead.custom as Record<string, unknown> | null), quiz, src, ticket: "free", flow: "email_first", onboarded: true };
      await db
        .from("marketing_leads")
        .update({ first_name: firstName, tags, custom, last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", lead.id);
    }
  } catch {
    /* never block completion on CRM drift */
  }

  // 5. Cancel the "finish setting up" nurture — they just finished.
  await db
    .from("challenge_sequences")
    .update({ status: "skipped", error: "account completed" })
    .eq("user_id", userId)
    .eq("step", "finish_setup")
    .eq("status", "pending")
    .then(undefined, () => {});

  return NextResponse.json({ ok: true, email });
}
