import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Does the signed-in user still need to CHOOSE a password?
 *
 * Admin-invited users (auth.admin invite / magic-link) are created with NO
 * password and no email identity — they authenticate purely by the emailed
 * link. Until they set one, they can never sign in again from /login. The
 * onboarding wizard consumes this to show a "Set your password" preamble step
 * for exactly those users, and skip it for everyone else (funnel signups who
 * already have a password, Google OAuth users, family-member signups, and
 * invited users who already set one).
 *
 * Authoritative signal (service role): `invited_at` is set AND we have not
 * already stamped `password_set` on their metadata. `invited_at` gates everyone
 * else out — a Google-only account, a funnel/family signup that chose a password
 * (both have a null `invited_at`) are never asked. NOTE: an invited user still
 * carries an "email" provider identity even with no password, so the identity
 * list is NOT a reliable "has a password" signal — `invited_at` is.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ needsPassword: false }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(user.id);
    if (error || !data.user) {
      return NextResponse.json({ needsPassword: false });
    }

    const u = data.user;
    const passwordSet = u.user_metadata?.password_set === true;
    const invited = !!u.invited_at;

    const needsPassword = !passwordSet && invited;
    return NextResponse.json({ needsPassword });
  } catch {
    // Never block onboarding on a metadata read failure.
    return NextResponse.json({ needsPassword: false });
  }
}
