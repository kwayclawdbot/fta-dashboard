import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRecoveryEmailViaResend } from "@/lib/server/auth-email";
import { APP_ORIGIN } from "@/lib/server/drips";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/reset  { email } — password reset that does NOT depend on
 * Supabase Auth's SMTP (GoTrue recover has been returning 500). We generate the
 * recovery link server-side with admin.generateLink (no email sent), then
 * deliver it ourselves via Resend. Always returns a neutral 200 (no account
 * enumeration): the client just says "check your email".
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let email = "";
  try {
    const body = (await req.json()) as { email?: string };
    email = (body.email || "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ ok: true }); // neutral
  }
  if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: true }); // neutral

  const admin = createAdminClient();
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${APP_ORIGIN}/auth/callback?next=/settings` },
    });
    const actionLink = data?.properties?.action_link;
    // A non-existent email yields an error/no link — swallow it (no enumeration).
    if (!error && actionLink) {
      const sent = await sendRecoveryEmailViaResend({ to: email, actionLink });
      if (!sent.ok) console.error("password reset email send failed:", email, sent.error);
    }
  } catch (e) {
    console.error("password reset route error:", e);
  }
  return NextResponse.json({ ok: true });
}
