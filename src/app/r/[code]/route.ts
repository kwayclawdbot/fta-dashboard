import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REF_COOKIE, REF_COOKIE_MAX_AGE } from "@/lib/referral";

/**
 * Referral entry point: /r/CODE
 *  1. Logs a 'click' referral_event (service-role insert — server-side only).
 *  2. Sets the first-touch `fta_ref` cookie (90d, never overwritten).
 *  3. Redirects to /signup?ref=CODE.
 *
 * Unknown codes still redirect to /signup (no cookie, no event) so a mistyped
 * link is never a dead end.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: raw } = await params;
  const code = (raw || "").trim().toUpperCase();
  const origin = new URL(request.url).origin;

  const admin = createAdminClient();
  let known = false;
  try {
    const { data } = await admin
      .from("referral_codes")
      .select("code")
      .eq("code", code)
      .maybeSingle();
    known = !!data;
    if (known) {
      await admin
        .from("referral_events")
        .insert({ code, kind: "click", referred_user_id: null });
    }
  } catch {
    /* click logging is best-effort */
  }

  const dest = known
    ? new URL(`/signup?ref=${encodeURIComponent(code)}`, origin)
    : new URL("/signup", origin);
  const res = NextResponse.redirect(dest);

  // First-touch: only set if not already attributed to someone.
  if (known && !request.headers.get("cookie")?.includes(`${REF_COOKIE}=`)) {
    res.cookies.set(REF_COOKIE, code, {
      maxAge: REF_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
