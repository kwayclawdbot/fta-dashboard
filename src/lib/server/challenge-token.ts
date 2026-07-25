/**
 * Short-lived continuation token for the EMAIL-FIRST challenge flow (Lane C9b).
 *
 * The marketing site captures an email → POST /api/challenge/register-email
 * creates the account and mints one of these. It rides in the URL (?t=) through
 * the OTO (/free-class/vip-offer) and the shortened setup flow (/free-class/setup)
 * so those pages never re-ask the email and can hand a prefilled email to the
 * VIP checkout — without ever exposing the raw email/user id in the URL.
 *
 * HMAC-SHA256 over a compact JSON payload, signed with MARKETING_TOKEN_SECRET
 * (namespaced "chal:" so it can never be replayed as a drip/marketing token).
 * Opaque + tamper-evident + expiring (default 3h).
 */
import crypto from "crypto";

const TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

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
function unb64url(s: string): string {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export interface ChallengeContinuation {
  userId: string;
  email: string;
  src: string;
}

interface Payload {
  u: string;
  e: string;
  s: string;
  x: number; // expiry epoch ms
}

/** Mint a continuation token for a freshly-registered email-first challenger. */
export function makeContinuationToken(c: ChallengeContinuation, ttlMs = TTL_MS): string {
  const payload: Payload = { u: c.userId, e: c.email, s: c.src || "", x: Date.now() + ttlMs };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", tokenSecret()).update(`chal:${body}`).digest("hex");
  return `${body}.${sig}`;
}

/** Verify a continuation token; returns the payload or null if invalid/expired. */
export function verifyContinuationToken(token: string): ChallengeContinuation | null {
  const parts = (token || "").split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac("sha256", tokenSecret()).update(`chal:${body}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p: Payload;
  try {
    p = JSON.parse(unb64url(body)) as Payload;
  } catch {
    return null;
  }
  if (!p?.u || !p?.e || typeof p.x !== "number" || Date.now() > p.x) return null;
  return { userId: p.u, email: p.e, src: p.s || "" };
}
