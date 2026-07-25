/**
 * Transactional AUTH emails sent DIRECTLY via Resend — SERVER ONLY.
 *
 * Why this exists: Supabase Auth's built-in SMTP pipeline has been failing
 * (GoTrue inviteUserByEmail / recover returning HTTP 500), which would strand a
 * paying buyer with no account email. The pattern everywhere in this codebase is
 * therefore: create the user + generate the action link server-side with
 * admin.generateLink (which does NOT send), then deliver the branded email here
 * over Resend (the RESEND_API_KEY is verified working via direct API send).
 */
import { APP_ORIGIN, DRIP_FROM, DRIP_REPLY_TO } from "@/lib/server/drips";

export type SendResult = { ok: boolean; id?: string; error?: string };

const BRAND: Record<string, string> = {
  fic: "Cheat Code Club",
  fta: "Family Trading Academy",
  challenge: "the 5-Day Investing Challenge",
};

async function sendTransactional(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "RESEND_API_KEY not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: DRIP_FROM,
        to: [opts.to],
        reply_to: DRIP_REPLY_TO,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.message || body?.error?.message || `Resend HTTP ${res.status}`;
      return { ok: false, error: `${res.status}: ${msg}` };
    }
    return { ok: true, id: body?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Warm-paper button email shell (mirrors the drip templates' look). */
function shell(headline: string, body: string, cta: { label: string; href: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#FBF7EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7EF;padding:32px 0;"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;border:1px solid #EAE2D0;overflow:hidden;">
      <tr><td style="height:6px;background:linear-gradient(90deg,#C2610B 0%,#B45309 45%,#0D9488 100%);"></td></tr>
      <tr><td style="padding:28px 32px 8px;font-size:22px;font-weight:800;color:#101828;line-height:1.3;">${headline}</td></tr>
      <tr><td style="padding:8px 32px 0;font-size:16px;color:#5B6472;line-height:1.65;">${body}</td></tr>
      <tr><td align="center" style="padding:24px 32px 8px;">
        <a href="${cta.href}" style="display:inline-block;padding:15px 30px;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:12px;background:linear-gradient(180deg,#C2610B 0%,#B45309 100%);">${cta.label} &rarr;</a>
      </td></tr>
      <tr><td style="padding:8px 32px 28px;font-size:13px;color:#98A2B3;line-height:1.6;">If the button doesn't work, copy this link into your browser:<br/><a href="${cta.href}" style="color:#B45309;word-break:break-all;">${cta.href}</a></td></tr>
    </table>
  </td></tr></table></body></html>`;
}

/** Branded "finish setting up your account" invite (post-purchase). */
export async function sendInviteEmailViaResend(opts: {
  to: string;
  actionLink: string;
  program: string;
}): Promise<SendResult> {
  const brand = BRAND[opts.program] || "Cheat Code Club";
  const subject = `Welcome to ${brand} — set up your account`;
  const body = `Your purchase is confirmed and your ${brand} account is ready. Click below to set your password and jump straight in.`;
  return sendTransactional({
    to: opts.to,
    subject,
    html: shell(`Welcome to ${brand} 🎉`, body, { label: "Set up my account", href: opts.actionLink }),
    text: `Welcome to ${brand}!\n\nYour account is ready. Set your password and get started:\n${opts.actionLink}\n\nQuestions? Just reply to this email.\n${APP_ORIGIN}`,
  });
}

/** Branded password-reset email (GoTrue-SMTP-independent). */
export async function sendRecoveryEmailViaResend(opts: {
  to: string;
  actionLink: string;
}): Promise<SendResult> {
  const subject = "Reset your password";
  const body = `We got a request to reset your password. Click below to choose a new one — the link is single-use and expires soon. Didn't ask for this? You can safely ignore this email.`;
  return sendTransactional({
    to: opts.to,
    subject,
    html: shell("Reset your password", body, { label: "Choose a new password", href: opts.actionLink }),
    text: `Reset your password:\n${opts.actionLink}\n\nDidn't request this? You can ignore this email.\n${APP_ORIGIN}`,
  });
}
