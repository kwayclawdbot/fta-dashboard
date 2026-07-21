import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { REF_COOKIE } from "@/lib/referral";

/**
 * Email confirmation handler (Supabase SSR `verifyOtp` / token_hash flow).
 *
 * Point the "Confirm signup" email template here for the most robust flow:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard
 *
 * Unlike the legacy `/auth/v1/verify?...&redirect_to=<SiteURL>` flow, this does
 * NOT depend on the dashboard Site URL / redirect allowlist to land the user in
 * the right place — we verify the token_hash ourselves and redirect locally.
 * It also works cross-device (no PKCE code_verifier cookie required).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNext(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      await attachReferralIfPending(supabase);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}

/** Only allow same-origin relative redirects (open-redirect guard). */
function sanitizeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

/**
 * If a first-touch referral cookie is present, attribute this just-verified user
 * to the referrer (server-side, forge-proof: the referred user is the session).
 * Best-effort — never blocks the redirect.
 */
async function attachReferralIfPending(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  try {
    const cookieStore = await cookies();
    const code = cookieStore.get(REF_COOKIE)?.value;
    if (!code) return;
    await supabase.rpc("attach_referral", { p_code: code });
    cookieStore.delete(REF_COOKIE);
  } catch {
    /* non-fatal */
  }
}
