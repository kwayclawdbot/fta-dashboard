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
  /**
   * FTA year-1 Club clock. When set (e.g. 12 for the $1,500 fta_challenge
   * offer), the resulting fta enrollment gets club_until = provision + N months;
   * after it, Club-level surfaces gate to free while FTA academy stays for life.
   * Undefined = unlimited Club (every regular fta / fic purchase, admin grant).
   */
  clubMonths?: number;
}) {
  const db = serviceClient();
  const email = opts.email.trim().toLowerCase();

  // Idempotency: if there's already an UNCLAIMED pending row for this
  // email+program, skip the insert and continue. This prevents Stripe webhook
  // retries (or repeated admin invites) from piling up duplicate rows.
  const { data: dupe } = await db
    .from("pending_memberships")
    .select("id")
    .eq("email", email)
    .eq("program", opts.program)
    .is("claimed_at", null)
    .limit(1)
    .maybeSingle();

  if (!dupe) {
    const { error: pendErr } = await db.from("pending_memberships").insert({
      email,
      program: opts.program,
      source: opts.source,
      stripe_session: opts.stripeSession ?? null,
      invited_by: opts.invitedBy ?? null,
      // Carries the Club clock to the onboarding claim (claim_pending_membership
      // stamps club_until = claim + club_months). Null = unlimited Club.
      club_months: opts.clubMonths ?? null,
    });
    if (pendErr) return { ok: false as const, error: pendErr.message };
  }

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
    // Invite-send failure is NON-FATAL. The pending_memberships row is the
    // durable source of truth; the user can still be provisioned later (admin
    // resend, or the claim path once they create an account). Returning ok
    // keeps the Stripe webhook from 500ing and triggering a retry storm during
    // mailer rate-limiting (Supabase built-in mailer caps ~2/hr).
    if (error && !/already/i.test(error.message)) {
      console.error("inviteUserByEmail failed:", email, error.message);
      return { ok: true as const, mode: "invite_email_failed" as const };
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
      // Existing-member direct activation: stamp the Club clock now (claim path
      // is skipped because the enrollment is created here). Null = unlimited.
      club_until:
        opts.clubMonths != null
          ? new Date(
              Date.UTC(
                new Date().getUTCFullYear(),
                new Date().getUTCMonth() + opts.clubMonths,
                new Date().getUTCDate(),
                new Date().getUTCHours(),
                new Date().getUTCMinutes(),
                new Date().getUTCSeconds()
              )
            ).toISOString()
          : null,
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
