import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { enrollChallengeSequence } from "@/lib/server/challenge-sequence";
import { makeContinuationToken } from "@/lib/server/challenge-token";
import { APP_ORIGIN } from "@/lib/server/drips";

export const dynamic = "force-dynamic";

/**
 * POST /api/challenge/register-email — EMAIL-FIRST challenge registration (C9b).
 *
 * The marketing site's 5-Day Challenge page collects the email itself and POSTs
 * it here (cross-origin). Email capture IS registration: we create the account +
 * family + full-Club challenge_pass, fire the instant welcome + schedule the
 * cohort sequence, upsert the CRM lead, schedule a "finish setting up" nurture,
 * and return a redirect to the one-time VIP offer carrying a signed continuation
 * token (email never leaves the server in the clear).
 *
 * Contract (other lane builds the form):
 *   POST JSON { email, src, website(honeypot) }
 *     → 200 { redirect }            (also on graceful double-submit)
 *     → 4xx { error }
 * CORS: https://cheatcode-club.vercel.app + https://cheatcode.com.
 *
 * Spam controls: honeypot `website` field + a basic per-IP rate limit +
 * idempotency on email (a repeat submit returns the same redirect, no dupes).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Loose phone normalization → E.164, US-default. NEVER hard-fails: an odd number
 * is stored raw and flagged (valid:false) rather than rejecting the signup.
 */
function normalizePhone(raw: string): { e164: string | null; raw: string | null; valid: boolean } {
  const input = (raw || "").trim();
  if (!input) return { e164: null, raw: null, valid: false };
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return { e164: `+1${digits}`, raw: input, valid: true };
  if (digits.length === 11 && digits.startsWith("1")) return { e164: `+${digits}`, raw: input, valid: true };
  if (input.startsWith("+") && digits.length >= 10 && digits.length <= 15)
    return { e164: `+${digits}`, raw: input, valid: true };
  if (digits.length >= 10 && digits.length <= 15)
    return { e164: `+${digits}`, raw: input, valid: false }; // loose-parsed, flag it
  return { e164: null, raw: input, valid: false };
}

const ALLOWED_ORIGINS = new Set([
  "https://cheatcode-club.vercel.app",
  "https://cheatcode.com",
  "https://www.cheatcode.com",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://cheatcode-club.vercel.app";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

// ── Basic per-IP rate limit (best-effort, per warm instance) ────────────────
const RL_WINDOW_MS = 10 * 60 * 1000;
const RL_MAX = 6;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) {
    // prune cold entries so the map can't grow unbounded
    for (const [k, v] of hits) if (v.every((t) => now - t > RL_WINDOW_MS)) hits.delete(k);
  }
  return arr.length > RL_MAX;
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

function otoRedirect(token: string): string {
  return `${APP_ORIGIN}/free-class/vip-offer?t=${encodeURIComponent(token)}`;
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get("origin"));
  const json = (b: unknown, status = 200) => NextResponse.json(b, { status, headers: cors });

  let body: { email?: string; name?: string; phone?: string; src?: string; website?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  // Honeypot — a real user never fills `website`. Silently accept (200) without
  // creating anything, so bots can't distinguish success from a drop.
  if (body.website && String(body.website).trim()) {
    return json({ redirect: `${APP_ORIGIN}/free-class?challenge=1` });
  }

  if (rateLimited(clientIp(req))) {
    return json({ error: "Too many requests — please try again in a few minutes." }, 429);
  }

  const email = (body.email || "").trim().toLowerCase();
  const src = (body.src || "").trim().slice(0, 64) || "funnel";
  const name = (body.name || "").trim().slice(0, 80);
  const phone = normalizePhone(body.phone || "");
  // The site form carries reminder (SMS) consent microcopy next to the phone
  // field, so a supplied phone IS the consent. Twilio sends come later.
  const smsConsent = !!phone.raw;
  if (!EMAIL_RE.test(email)) return json({ error: "Please enter a valid email." }, 400);

  const db = createAdminClient();

  // ── Idempotency: existing account for this email → re-mint token, same
  //    redirect (graceful double-submit, no duplicate provisioning). ──
  const { data: existingProfile } = await db
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile?.id) {
    const token = makeContinuationToken({ userId: existingProfile.id, email, src, name });
    return json({ redirect: otoRedirect(token) });
  }

  // ── 1. Auth user — email-first: pre-confirmed, RANDOM password (set later at
  //    account completion), NO display_name yet (its absence is the
  //    "registered-not-onboarded" signal). ──
  const randomPassword = crypto.randomBytes(24).toString("hex");
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email,
    password: randomPassword,
    email_confirm: true,
    user_metadata: name ? { role: "parent", display_name: name } : { role: "parent" },
  });
  if (createErr || !created?.user) {
    // Race: created between our check and now → treat as idempotent.
    const { data: prof } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
    if (prof?.id) {
      const token = makeContinuationToken({ userId: prof.id, email, src, name });
      return json({ redirect: otoRedirect(token) });
    }
    return json({ error: "Could not start your registration." }, 500);
  }
  const userId = created.user.id;

  // ── 2. Family + full-Club challenge_pass (same as the funnel register). ──
  const { data: fam, error: famErr } = await db
    .from("families")
    .insert({ name: "Your Family" })
    .select("id")
    .single();
  if (famErr || !fam) {
    await db.auth.admin.deleteUser(userId).catch(() => {});
    return json({ error: "Could not set up your account." }, 500);
  }
  const familyId = fam.id as string;

  let challengeEnd = "2026-09-09T04:00:00Z";
  const { data: setting } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "challenge_end")
    .maybeSingle();
  if (typeof setting?.value === "string") challengeEnd = setting.value;
  await db.from("enrollments").insert({
    family_id: familyId,
    program: "challenge_pass",
    status: "active",
    expires_at: challengeEnd,
  });

  // ── 3. Profile: link family, parent/adult, NO display_name (setup pending). ──
  await db
    .from("profiles")
    .update({
      family_id: familyId,
      role: "parent",
      age_group: "adults",
      track: "adults",
      email,
      // Name if the form provided one (so account setup pre-fills); otherwise
      // blank (NOT NULL column ⇒ empty string, not null) — its emptiness is the
      // "registered-not-onboarded" signal and keeps the finish_setup greeting a
      // friendly "there". Either way, confirmed/changeable at account completion.
      display_name: name || "",
      onboarding_complete: false,
    })
    .eq("id", userId);

  // ── 4. Challenge sequence — the instant welcome fires HERE (email capture IS
  //    registration). Best-effort; gating flags honored inside. ──
  await enrollChallengeSequence(db, { userId, familyId, email, firstName: "" }).catch(() => {});

  // ── 4b. "Finish setting up" nurture — +20h, cancelled at account completion.
  //    Sent by the same cron under the same challenge_emails_enabled gate. ──
  await db
    .from("challenge_sequences")
    .upsert(
      {
        user_id: userId,
        family_id: familyId,
        step: "finish_setup",
        scheduled_at: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
        status: "pending",
      },
      { onConflict: "user_id,step", ignoreDuplicates: true }
    )
    .then(undefined, () => {});

  // ── 5. Challenge registration record (quiz filled at completion). ──
  await db.from("free_class_registrations").insert({
    user_id: userId,
    email,
    quiz: {
      flow: "email_first",
      ...(name ? { first_name: name } : {}),
      ...(phone.raw ? { phone: phone.e164 || phone.raw, phone_raw: phone.raw } : {}),
    },
    source: "challenge",
  });

  // ── 6. CRM lead — source=challenge, ticket-free, email-first + not-onboarded.
  //    The admin ticket split reads these tags/flags to isolate the partial
  //    (registered-not-onboarded) cohort. ──
  try {
    const srcTag = src ? [`src:${src}`] : [];
    const smsTag = smsConsent ? ["sms-consent"] : [];
    const tags = ["challenge", "registered", "ticket-free", "email-first", ...srcTag, ...smsTag];
    const nowIso = new Date().toISOString();
    const custom = {
      src,
      ticket: "free",
      flow: "email_first",
      onboarded: false,
      // Consent FACT + timestamp (Twilio sends come later). phone_valid flags a
      // loose-parsed number for a human to eyeball.
      sms_consent: smsConsent,
      sms_consent_at: smsConsent ? nowIso : null,
      phone_e164: phone.e164,
      phone_raw: phone.raw,
      phone_valid: phone.raw ? phone.valid : null,
    };
    const leadPhone = phone.e164 || phone.raw || null;
    const { data: lead } = await db
      .from("marketing_leads")
      .select("id, tags")
      .eq("email", email)
      .eq("source", "challenge")
      .maybeSingle();
    if (lead) {
      const merged = Array.from(new Set([...(lead.tags || []), ...tags]));
      await db
        .from("marketing_leads")
        .update({
          stage: "engaged",
          ...(name ? { first_name: name } : {}),
          ...(leadPhone ? { phone: leadPhone } : {}),
          tags: merged,
          converted_profile_id: userId,
          custom,
          last_activity_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", lead.id);
    } else {
      await db.from("marketing_leads").insert({
        email,
        first_name: name || null,
        phone: leadPhone,
        source: "challenge",
        stage: "engaged",
        tags,
        consent_source: "challenge_email_first",
        converted_profile_id: userId,
        custom,
      });
    }
  } catch {
    /* marketing schema drift — never block registration */
  }

  const token = makeContinuationToken({ userId, email, src, name });
  return json({ redirect: otoRedirect(token) });
}
