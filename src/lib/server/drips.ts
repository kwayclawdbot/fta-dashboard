/**
 * Server-side welcome-drip helpers (Lane 13B): the canonical app origin for
 * deep links, a drip-namespaced HMAC unsubscribe token (same pattern as the
 * campaigns lane's makeUnsubToken, but keyed to a user_id and namespaced so a
 * marketing token can never be replayed here), and a Resend sender that adds
 * proper List-Unsubscribe headers + reply-to.
 *
 * The unsub token deliberately reuses MARKETING_TOKEN_SECRET so ops only manage
 * one signing secret. The "drip:" prefix in the signed payload keeps the two
 * token families disjoint.
 */
import crypto from "crypto";

/** Canonical production origin for member-facing deep links. */
export const APP_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() ||
  "https://app.familyinvestingclub.com"
).replace(/\/$/, "");

/** From/reply identity for drip mail (verified Resend domain). */
export const DRIP_FROM =
  process.env.MARKETING_FROM_EMAIL?.trim() ||
  "Cheat Code Club <hello@familyinvestingclub.com>";
export const DRIP_REPLY_TO =
  process.env.MARKETING_REPLY_TO?.trim() || "hello@familyinvestingclub.com";

function tokenSecret(): string {
  return process.env.MARKETING_TOKEN_SECRET?.trim() || "dev-insecure-secret";
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Signed token embedding the user id: "<b64(userId)>.<sig>" over "drip:<id>". */
export function makeDripUnsubToken(userId: string): string {
  const sig = crypto
    .createHmac("sha256", tokenSecret())
    .update(`drip:${userId}`)
    .digest("hex");
  return `${b64url(userId)}.${sig}`;
}

/** Verify a drip unsub token; returns the user id or null if invalid/tampered. */
export function verifyDripUnsubToken(token: string): string | null {
  const parts = (token || "").split(".");
  if (parts.length !== 2) return null;
  let userId: string;
  try {
    userId = Buffer.from(
      parts[0].replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
  } catch {
    return null;
  }
  const expected = crypto
    .createHmac("sha256", tokenSecret())
    .update(`drip:${userId}`)
    .digest("hex");
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? userId : null;
}

export function dripUnsubUrl(userId: string, origin: string = APP_ORIGIN): string {
  return `${origin}/api/drips/unsubscribe?token=${encodeURIComponent(
    makeDripUnsubToken(userId)
  )}`;
}

export type DripSendResult = { ok: boolean; id?: string; error?: string };

/**
 * Send one drip email via Resend, with List-Unsubscribe headers (one-click) so
 * inbox providers surface a native unsubscribe and don't spam-flag the sequence.
 */
export async function sendDripEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  unsubUrl: string;
}): Promise<DripSendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "RESEND_API_KEY not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: DRIP_FROM,
        to: [opts.to],
        reply_to: DRIP_REPLY_TO,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        headers: {
          "List-Unsubscribe": `<${opts.unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        body?.message || body?.error?.message || `Resend HTTP ${res.status}`;
      return { ok: false, error: `${res.status}: ${msg}` };
    }
    return { ok: true, id: body?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "email send failed" };
  }
}
