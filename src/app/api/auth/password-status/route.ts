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
 * Authoritative signal (service role): `invited_at` is set AND the user has no
 * password-based ("email" provider) identity AND we have not already stamped
 * `password_set` on their metadata. `invited_at` gates OAuth users out (theirs
 * is null), so a Google-only account is never asked for a password.
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
    const hasPasswordIdentity = (u.identities ?? []).some(
      (i) => i.provider === "email"
    );

    const needsPassword = !passwordSet && invited && !hasPasswordIdentity;
    return NextResponse.json({ needsPassword });
  } catch {
    // Never block onboarding on a metadata read failure.
    return NextResponse.json({ needsPassword: false });
  }
}
