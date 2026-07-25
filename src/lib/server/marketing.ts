/**
 * Server-side marketing helpers (service role) — used by the campaign send
 * route, the Facebook lead webhook and the public unsubscribe route.
 *
 * Mirrors the serviceClient pattern in ./membership.ts but is fully
 * self-contained (that file is owned by another lane and must not be edited).
 * Never import this from a client component.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false } }
  );
}

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://fta-dashboard-ruddy.vercel.app";

export function siteUrl(): string {
  return SITE;
}

/* ── admin gate for server routes (JWT → profiles.role='admin') ───────────── */

export async function requireAdmin(
  authHeader: string | null
): Promise<
  | { ok: true; userId: string; db: SupabaseClient }
  | { ok: false; status: number; error: string }
> {
  const jwt = (authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { ok: false, status: 401, error: "unauthorized" };
  const db = serviceClient();
  const { data: userRes, error } = await db.auth.getUser(jwt);
  if (error || !userRes?.user)
    return { ok: false, status: 401, error: "unauthorized" };
  const { data: prof } = await db
    .from("profiles")
    .select("role")
    .eq("id", userRes.user.id)
    .single();
  if (prof?.role !== "admin")
    return { ok: false, status: 403, error: "admin only" };
  return { ok: true, userId: userRes.user.id, db };
}

/* ── unsubscribe token (HMAC, stateless) ──────────────────────────────────── */

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

/** Signed, tamper-proof token embedding the lead id: "<b64(leadId)>.<sig>". */
export function makeUnsubToken(leadId: string): string {
  const payload = b64url(leadId);
  const sig = crypto
    .createHmac("sha256", tokenSecret())
    .update(leadId)
    .digest("hex");
  return `${payload}.${sig}`;
}

/** Verify a token; returns the lead id or null if invalid/tampered. */
export function verifyUnsubToken(token: string): string | null {
  const parts = (token || "").split(".");
  if (parts.length !== 2) return null;
  let leadId: string;
  try {
    leadId = Buffer.from(
      parts[0].replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
  } catch {
    return null;
  }
  const expected = crypto
    .createHmac("sha256", tokenSecret())
    .update(leadId)
    .digest("hex");
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? leadId : null;
}

export function unsubUrl(leadId: string): string {
  return `${SITE}/api/marketing/unsubscribe?token=${encodeURIComponent(
    makeUnsubToken(leadId)
  )}`;
}

/* ── merge fields ─────────────────────────────────────────────────────────── */

export function renderMerge(
  template: string,
  lead: { first_name?: string | null; last_name?: string | null; email?: string | null }
): string {
  return (template || "")
    .replace(/\{\{\s*first_name\s*\}\}/gi, lead.first_name || "there")
    .replace(/\{\{\s*last_name\s*\}\}/gi, lead.last_name || "")
    .replace(/\{\{\s*email\s*\}\}/gi, lead.email || "");
}

/* ── channel senders ──────────────────────────────────────────────────────── */

export type SendResult = { ok: boolean; error?: string; id?: string };

/**
 * Send one email via Resend. The marketing Resend account has no verified
 * domain yet, so real sends return HTTP 403 with a domain-verification error;
 * we surface that message verbatim so the UI can show the DNS banner.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "RESEND_API_KEY not configured" };
  const from =
    process.env.MARKETING_FROM_EMAIL?.trim() ||
    "Cheat Code Club <hello@familyinvestingclub.com>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
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

/** True when a Resend error is the unverified-domain 403 (drives the UI banner). */
export function isDomainVerifyError(error?: string): boolean {
  if (!error) return false;
  return (
    /^403/.test(error) ||
    /domain is not verified/i.test(error) ||
    /verify a domain/i.test(error) ||
    /not verified/i.test(error)
  );
}

/**
 * Send one SMS via Twilio. NOTE: this Twilio number is SHARED with the Kai
 * product's inbound webhook — batch sends must run in dry-run except for the
 * single owner-proof message. Inbound STOP handling is owned by Kai's webhook
 * on this number and is intentionally NOT implemented here.
 */
export async function sendSms(opts: {
  to: string;
  body: string;
}): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_PHONE_NUMBER?.trim();
  if (!sid || !token || !from)
    return { ok: false, error: "Twilio credentials not configured" };
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: opts.to, From: from, Body: opts.body }),
      }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: `${res.status}: ${body?.message || "Twilio error"}` };
    }
    return { ok: true, id: body?.sid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "sms send failed" };
  }
}
