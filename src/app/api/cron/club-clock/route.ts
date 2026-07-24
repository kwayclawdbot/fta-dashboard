import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dripUnsubUrl, sendDripEmail, APP_ORIGIN } from "@/lib/server/drips";
import { CLUB_CONTINUE_URL } from "@/lib/server/challenge-emails";
import {
  renderClubClockEmail,
  type ClubClockEmailKind,
} from "@/lib/server/club-clock-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily FTA Club-clock machinery (migration 127; Vercel Cron → this route).
 *
 * The $1,500 Challenge grants FTA academy access for LIFE + 12 months of Club
 * (enrollments.club_until). family_tiers flips club_lapsed automatically at
 * club_until (no row mutation). This cron is purely the COMMS layer for the
 * families that will actually lose the Club layer (no paid fic, no other
 * Club-granting enrollment):
 *   • warn_14d — Club window closes within 14 days
 *   • warn_3d  — Club window closes within 3 days
 *   • lapsed   — window already closed → academy stays, Club continues at $99
 * Each (enrollment, kind) is de-duped via club_clock_notices. Owner opt-outs
 * (drip_optouts) are honored; List-Unsubscribe attached. Honest copy: the
 * Academy is kept for life; only the bundled Club membership is ending.
 *
 * Auth: Bearer CRON_SECRET or ?secret=. Refuses if CRON_SECRET unset (fail-safe).
 * ?dry=1 previews without sending. SAMPLE MODE (owner-approval visual check):
 *   ?sample=warn_14d&to=you@example.com  renders + sends ONE email, DB untouched.
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
  const sampleKind = sp.get("sample") as ClubClockEmailKind | null;
  const sampleTo = sp.get("to");
  if (sampleKind && sampleTo) {
    if (!["warn_14d", "warn_3d", "lapsed"].includes(sampleKind)) {
      return NextResponse.json({ error: "bad sample kind" }, { status: 400 });
    }
    const daysLeft = sampleKind === "warn_14d" ? 14 : sampleKind === "warn_3d" ? 3 : 0;
    const { subject, html, text } = renderClubClockEmail(sampleKind, {
      firstName: sp.get("name") || "there",
      daysLeft,
      appUrl: APP_ORIGIN,
      continueUrl: CLUB_CONTINUE_URL,
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
  const in14dIso = new Date(now + 14 * 864e5).toISOString();

  // All active fta enrollments carrying a Club clock, whose window closes within
  // 14 days or has already closed. Tiny population (Challenge buyers only).
  const { data: rows, error: enErr } = await db
    .from("enrollments")
    .select("id, family_id, club_until")
    .eq("program", "fta")
    .eq("status", "active")
    .not("club_until", "is", null)
    .lte("club_until", in14dIso)
    .limit(2000);
  if (enErr) {
    return NextResponse.json({ error: enErr.message }, { status: 500 });
  }

  const counts = { warn_14d: 0, warn_3d: 0, lapsed: 0, skipped: 0, failed: 0 };

  for (const e of rows ?? []) {
    const until = new Date(e.club_until as string).getTime();
    // Which notice does this window qualify for RIGHT NOW? (most-urgent wins)
    let kind: ClubClockEmailKind;
    let daysLeft: number;
    if (until <= now) {
      kind = "lapsed";
      daysLeft = 0;
    } else if (until <= now + 3 * 864e5) {
      kind = "warn_3d";
      daysLeft = Math.max(1, Math.ceil((until - now) / 864e5));
    } else {
      kind = "warn_14d";
      daysLeft = Math.max(4, Math.ceil((until - now) / 864e5));
    }

    // COVERAGE GUARD — only comms families that will actually lose the Club: no
    // active fic (paid $99 already), and no OTHER active fta still granting Club
    // (unlimited or a later window). Such families keep Club regardless.
    const { data: covering } = await db
      .from("enrollments")
      .select("id, program, club_until, expires_at")
      .eq("family_id", e.family_id)
      .eq("status", "active")
      .in("program", ["fic", "fta", "challenge_pass"]);
    const isCovered = (covering ?? []).some((c) => {
      if (c.id === e.id) return false;
      if (c.program === "fic") return true; // paid $99 — keeps Club
      if (c.program === "challenge_pass")
        return c.expires_at == null || new Date(c.expires_at).getTime() > now;
      // another fta granting Club: unlimited, or a window later than this one
      if (c.program === "fta")
        return c.club_until == null || new Date(c.club_until).getTime() > until;
      return false;
    });
    if (isCovered) {
      counts.skipped++;
      continue;
    }

    // Already sent this notice?
    const { data: notice } = await db
      .from("club_clock_notices")
      .select("kind")
      .eq("enrollment_id", e.id)
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
      .eq("family_id", e.family_id)
      .in("role", ["parent", "admin"])
      .not("email", "is", null)
      .order("role", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!owner?.email) {
      counts.skipped++;
      continue;
    }

    // Opt-out honored (shared with the welcome / challenge drips).
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
    const { subject, html, text } = renderClubClockEmail(kind, {
      firstName,
      daysLeft,
      appUrl: APP_ORIGIN,
      continueUrl: CLUB_CONTINUE_URL,
      unsubUrl,
    });

    const result = await sendDripEmail({ to: owner.email, subject, html, text, unsubUrl });
    if (result.ok) {
      await db.from("club_clock_notices").insert({
        enrollment_id: e.id,
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
    scanned: (rows ?? []).length,
    sent: { warn_14d: counts.warn_14d, warn_3d: counts.warn_3d, lapsed: counts.lapsed },
    skipped: counts.skipped,
    failed: counts.failed,
  });
}
