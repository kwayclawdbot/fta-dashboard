/**
 * Server-side membership provisioning (service role) — used by the Stripe
 * webhook and the admin invite API. Never import from client components.
 */
import { createClient } from "@supabase/supabase-js";

export function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL || "https://fta-dashboard-ruddy.vercel.app";

/**
 * Provision a membership for an email: record pending_memberships, and either
 * invite a brand-new user (Supabase sends the create-account email) or — if
 * they already have an account and a family — activate the enrollment now.
 */
export async function provisionMembership(opts: {
  email: string;
  program: "fic" | "fta";
  source: "stripe" | "admin";
  stripeSession?: string;
  invitedBy?: string;
}) {
  const db = serviceClient();
  const email = opts.email.trim().toLowerCase();

  const { error: pendErr } = await db.from("pending_memberships").insert({
    email,
    program: opts.program,
    source: opts.source,
    stripe_session: opts.stripeSession ?? null,
    invited_by: opts.invitedBy ?? null,
  });
  if (pendErr) return { ok: false as const, error: pendErr.message };

  // Existing account?
  const { data: existing } = await db
    .from("profiles")
    .select("id, family_id")
    .ilike("display_name", "%") // noop filter; we match via auth below
    .limit(0);
  void existing;
  const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = userList?.users?.find((u) => u.email?.toLowerCase() === email);

  if (!user) {
    const { error } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${SITE}/auth/callback?next=/onboarding`,
    });
    if (error && !/already/i.test(error.message)) {
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const, mode: "invited" as const };
  }

  // Existing user — if they already have a family, activate immediately.
  const { data: prof } = await db
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .single();
  if (prof?.family_id) {
    await db.from("enrollments").insert({
      family_id: prof.family_id,
      program: opts.program,
      status: "active",
    });
    await db
      .from("pending_memberships")
      .update({ claimed_at: new Date().toISOString() })
      .eq("email", email)
      .is("claimed_at", null);
    return { ok: true as const, mode: "activated" as const };
  }
  // Account exists but onboarding incomplete — claim fires at onboarding.
  return { ok: true as const, mode: "pending" as const };
}
