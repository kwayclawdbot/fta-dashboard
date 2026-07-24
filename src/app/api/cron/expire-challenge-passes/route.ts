import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dripUnsubUrl, sendDripEmail } from "@/lib/server/drips";
import {
  renderChallengeEmail,
  CLUB_CONTINUE_URL,
  FTA_CHALLENGE_URL,
  type ChallengeEmailKind,
} from "@/lib/server/challenge-emails";
import { APP_ORIGIN } from "@/lib/server/drips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily challenge-pass expiry machinery (Lane C7; Vercel Cron → this route).
 *
 * The family_tiers view flips a challenge_pass family to 'free' automatically at
 * expires_at (no row mutation needed). This cron is purely the COMMS layer:
 *   • warn_3d — passes expiring within 3 days → friendly warning email
 *   • warn_1d — passes expiring within 1 day  → final warning email
 *   • expired — passes already past expires_at → post-expiry "continue" email
 * Each (enrollment, kind) is de-duped via challenge_pass_notices so nobody is
 * emailed twice. Owner opt-outs (drip_optouts) are honored; List-Unsubscribe is
 * attached. No dark patterns — the copy says "keep going or drop to free, your
 * progress stays".
 *
 * Auth: Bearer CRON_SECRET or ?secret=. Refuses if CRON_SECRET unset (fail-safe).
 * ?dry=1 previews without sending. SAMPLE MODE (owner-approval visual check):
 *   ?sample=warn_3d&to=you@example.com  renders + sends ONE email, DB untouched.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") || "";
  const qsSecret = req.nextUrl.searchParams.get("secret") || "";
  if (auth !== `Bearer ${secret}` && qsSecret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const dry = sp.get("dry") === "1";

  // ── Sample mode: send one real email to an arbitrary address, no DB writes.
  const sampleKind = sp.get("sample") as ChallengeEmailKind | null;
  const sampleTo = sp.get("to");
  if (sampleKind && sampleTo) {
    if (!["warn_3d", "warn_1d", "expired"].includes(sampleKind)) {
      return NextResponse.json({ error: "bad sample kind" }, { status: 400 });
    }
    const daysLeft = sampleKind === "warn_3d" ? 3 : sampleKind === "warn_1d" ? 1 : 0;
    const { subject, html, text } = renderChallengeEmail(sampleKind, {
      firstName: sp.get("name") || "there",
      daysLeft,
      appUrl: APP_ORIGIN,
      continueUrl: CLUB_CONTINUE_URL,
      ftaUrl: FTA_CHALLENGE_URL,
      unsubUrl: `${APP_ORIGIN}/api/drips/unsubscribe?token=sample`,
    });
    const result = await sendDripEmail({
      to: sampleTo,
      subject,
      html,
      text,
      unsubUrl: `${APP_ORIGIN}/api/drips/unsubscribe?token=sample`,
    });
    return NextResponse.json({ ok: result.ok, sample: sampleKind, to: sampleTo, error: result.error });
  }

  const db = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const in3dIso = new Date(now + 3 * 864e5).toISOString();
  const in1dIso = new Date(now + 1 * 864e5).toISOString();

  // All active challenge passes in the comms window (expiring within 3 days, or
  // already expired). Small population — no pagination needed for the challenge.
  const { data: passes, error: passErr } = await db
    .from("enrollments")
    .select("id, family_id, expires_at")
    .eq("program", "challenge_pass")
    .eq("status", "active")
    .not("expires_at", "is", null)
    .lte("expires_at", in3dIso)
    .limit(2000);
  if (passErr) {
    return NextResponse.json({ error: passErr.message }, { status: 500 });
  }

  const rows = passes ?? [];
  const counts = { warn_3d: 0, warn_1d: 0, expired: 0, skipped: 0, failed: 0 };

  for (const p of rows) {
    const exp = new Date(p.expires_at as string).getTime();
    // Which notice does this pass qualify for RIGHT NOW? (most-urgent wins)
    let kind: ChallengeEmailKind;
    let daysLeft: number;
    if (exp <= now) {
      kind = "expired";
      daysLeft = 0;
    } else if (exp <= now + 1 * 864e5) {
      kind = "warn_1d";
      daysLeft = 1;
    } else if (exp <= now + 3 * 864e5) {
      kind = "warn_3d";
      daysLeft = Math.max(1, Math.ceil((exp - now) / 864e5));
    } else {
      continue; // outside window (shouldn't happen given the query)
    }

    // Already sent this notice?
    const { data: notice } = await db
      .from("challenge_pass_notices")
      .select("kind")
      .eq("enrollment_id", p.id)
      .eq("kind", kind)
      .maybeSingle();
    if (notice) {
      counts.skipped++;
      continue;
    }

    // Resolve the family owner (parent/admin) to email.
    const { data: owner } = await db
      .from("profiles")
      .select("id, email, display_name, role")
      .eq("family_id", p.family_id)
      .in("role", ["parent", "admin"])
      .not("email", "is", null)
      .order("role", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!owner?.email) {
      counts.skipped++;
      continue;
    }

    // Opt-out honored (shared with the welcome drips).
    const { data: optedOut } = await db
      .from("drip_optouts")
      .select("user_id")
      .eq("user_id", owner.id)
      .maybeSingle();
    if (optedOut) {
      counts.skipped++;
      continue;
    }

    if (dry) {
      counts[kind]++;
      continue;
    }

    const firstName = (owner.display_name || "").trim().split(/\s+/)[0] || "there";
    const unsubUrl = dripUnsubUrl(owner.id);
    const { subject, html, text } = renderChallengeEmail(kind, {
      firstName,
      daysLeft,
      appUrl: APP_ORIGIN,
      continueUrl: CLUB_CONTINUE_URL,
      ftaUrl: FTA_CHALLENGE_URL,
      unsubUrl,
    });

    const result = await sendDripEmail({ to: owner.email, subject, html, text, unsubUrl });
    if (result.ok) {
      await db.from("challenge_pass_notices").insert({
        enrollment_id: p.id,
        kind,
        resend_id: result.id ?? null,
      });
      counts[kind]++;
    } else {
      counts.failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    dry_run: dry,
    scanned: rows.length,
    sent: { warn_3d: counts.warn_3d, warn_1d: counts.warn_1d, expired: counts.expired },
    skipped: counts.skipped,
    failed: counts.failed,
  });
}
