import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { REF_COOKIE } from "@/lib/referral";

/**
 * OAuth + email-link callback.
 *
 * Handles the auth flows that can land here:
 *   1. PKCE / OAuth: `?code=...`   → exchangeCodeForSession
 *      (Google sign-in, and the default `{{ .ConfirmationURL }}` signup email
 *       once Site URL + redirect allowlist point at this domain).
 *   2. token_hash:   `?token_hash=...&type=...` → verifyOtp
 *      (fallback so this route also works if the email template links here).
 *   3. IMPLICIT / hash-fragment: admin-generated invite & magic-link emails use
 *      `{{ .ConfirmationURL }}` → Supabase `/auth/v1/verify`, which (no PKCE
 *      code_verifier exists for a server-minted link) redirects back here with
 *      the session in the URL **hash fragment** — invisible to this server
 *      handler. When we see neither `?code` nor `?token_hash` nor an `?error`,
 *      we hand off to the client page `/auth/finish`, which reads the hash and
 *      establishes the session. The fragment survives the redirect because our
 *      Location has none of its own.
 *
 * On genuine failure it lands on a styled error page (with a resend action),
 * never a bare 404 / silent bounce. On success it attributes any pending
 * referral.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const error = searchParams.get("error");
  const next = sanitizeNext(searchParams.get("next"));

  const supabase = await createClient();

  // Explicit provider error in the query string (e.g. OAuth denial) — friendly.
  if (error) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  if (code) {
    const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchErr) {
      await attachReferralIfPending(supabase);
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  if (token_hash && type) {
    const { error: otpErr } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!otpErr) {
      await attachReferralIfPending(supabase);
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  // No server-visible auth params: the session is almost certainly in the hash
  // fragment (implicit flow from a default-template invite / magic-link email).
  // Hand off to the client page that can actually read it. `next` is preserved
  // in the query; the browser carries the fragment across this redirect.
  return NextResponse.redirect(
    `${origin}/auth/finish?next=${encodeURIComponent(next)}`
  );
}

/** Only allow same-origin relative redirects (open-redirect guard). */
function sanitizeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

async function attachReferralIfPending(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  try {
    const cookieStore = await cookies();
    const refCode = cookieStore.get(REF_COOKIE)?.value;
    if (!refCode) return;
    await supabase.rpc("attach_referral", { p_code: refCode });
    cookieStore.delete(REF_COOKIE);
  } catch {
    /* non-fatal */
  }
}
