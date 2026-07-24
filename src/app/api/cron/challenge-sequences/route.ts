import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { beltForXp } from "@/lib/belts";
import {
  renderChallengeSequenceEmail,
  CLUB_CONTINUE_URL,
  FTA_CHALLENGE_URL,
  CHALLENGE_STEPS,
  CHALLENGE_STEPS_NEEDING_STATS,
  type ChallengeStep,
  type ChallengeStats,
} from "@/lib/server/challenge-sequence-emails";
import { APP_ORIGIN, dripUnsubUrl, sendDripEmail } from "@/lib/server/drips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily challenge-cohort sequence sender (Lane C8 part 3; Vercel Cron → here).
 *
 * Sends the fixed-calendar challenge emails (August activation, show-up, daily
 * missions Sept 1-5, close sequence) to challenge_pass members. The registration
 * WELCOME is NOT sent here — it fires immediately from the register route.
 *
 * HARD GATE: app_settings.challenge_emails_enabled (DEFAULT true). This is the
 * challenge machine's OWN gate — deliberately separate from drip_enabled, which
 * stays false until the owner approves the 13B welcome-drip visuals. Real sends
 * only happen for real cohort members; there are currently zero, so nothing real
 * fires yet. For each due row it skips opted-out accounts, merges live stats on
 * close_stats, sends via Resend, and flips the row to 'sent' (idempotent).
 *
 * Auth: Bearer CRON_SECRET or ?secret=. Refuses if CRON_SECRET unset (fail-safe).
 *   ?dry=1                 — preview due rows, send nothing.
 *   ?test=1&to=you@x.com   — TEST BATCH: render EVERY step and send each to `to`
 *                            with a "[TEST] " subject prefix. NO DB writes; used
 *                            for owner visual review before real cohort exists.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") || "";
  const sp = req.nextUrl.searchParams;
  const qsSecret = sp.get("secret") || "";
  if (auth !== `Bearer ${secret}` && qsSecret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── TEST BATCH: send all templates to one inbox, no DB writes. ────────────
  const testTo = sp.get("test") === "1" ? sp.get("to") : null;
  if (testTo) {
    const unsubUrl = `${APP_ORIGIN}/api/drips/unsubscribe?token=sample`;
    const sampleStats: ChallengeStats = { xp: 340, beltLabel: "Yellow Belt", rules: 2, posts: 3 };
    const results: { step: ChallengeStep; ok: boolean; id?: string; error?: string }[] = [];
    for (const step of CHALLENGE_STEPS) {
      const { subject, html, text } = renderChallengeSequenceEmail(step, {
        firstName: sp.get("name") || "there",
        appUrl: APP_ORIGIN,
        unsubUrl,
        continueUrl: CLUB_CONTINUE_URL,
        ftaUrl: FTA_CHALLENGE_URL,
        stats: CHALLENGE_STEPS_NEEDING_STATS.has(step) ? sampleStats : undefined,
      });
      const r = await sendDripEmail({ to: testTo, subject: `[TEST] ${subject}`, html, text, unsubUrl });
      results.push({ step, ok: r.ok, id: r.id, error: r.error });
    }
    return NextResponse.json({
      ok: results.every((r) => r.ok),
      mode: "test_batch",
      to: testTo,
      count: results.length,
      results,
    });
  }

  const dry = sp.get("dry") === "1";
  const db = createAdminClient();
  const nowIso = new Date().toISOString();

  // Hard gate.
  const { data: flag } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "challenge_emails_enabled")
    .maybeSingle();
  const enabled = flag?.value !== false; // default true

  // Due, unsent, non-welcome rows (welcome is sent at registration).
  const { data: due, error: dueErr } = await db
    .from("challenge_sequences")
    .select("id, user_id, family_id, step, scheduled_at")
    .eq("status", "pending")
    .is("sent_at", null)
    .neq("step", "welcome")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(500);
  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }
  const rows = due ?? [];

  if (!enabled || dry || rows.length === 0) {
    return NextResponse.json({
      ok: true,
      challenge_emails_enabled: enabled,
      dry_run: dry || !enabled,
      due: rows.length,
      sent: 0,
      note: !enabled
        ? "challenge_emails_enabled is false — nothing sent"
        : dry
          ? "dry-run — nothing sent"
          : "no due steps",
    });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const r of rows) {
    const step = r.step as ChallengeStep;

    // Resolve the member.
    const { data: prof } = await db
      .from("profiles")
      .select("email, display_name, role")
      .eq("id", r.user_id)
      .maybeSingle();

    // Opt-out honored (shared with the welcome drips).
    const { data: optedOut } = await db
      .from("drip_optouts")
      .select("user_id")
      .eq("user_id", r.user_id)
      .maybeSingle();

    if (!prof?.email || prof.role === "child" || optedOut) {
      await db
        .from("challenge_sequences")
        .update({
          status: optedOut ? "suppressed" : "skipped",
          error: optedOut ? "opted out" : !prof?.email ? "no email" : "child account",
        })
        .eq("id", r.id);
      skipped++;
      continue;
    }

    const firstName = (prof.display_name || "").trim().split(/\s+/)[0] || "there";
    const unsubUrl = dripUnsubUrl(r.user_id);

    // Live stats merge (close_stats only).
    let stats: ChallengeStats | undefined;
    if (CHALLENGE_STEPS_NEEDING_STATS.has(step)) {
      const [{ data: xpRows }, { count: ruleCount }, { count: postCount }] = await Promise.all([
        db.from("xp_events").select("amount").eq("user_id", r.user_id),
        db.from("alert_rules").select("id", { count: "exact", head: true }).eq("user_id", r.user_id),
        db.from("feed_posts").select("id", { count: "exact", head: true }).eq("author_id", r.user_id),
      ]);
      const xp = (xpRows ?? []).reduce((n, x) => n + ((x as { amount: number }).amount || 0), 0);
      stats = { xp, beltLabel: beltForXp(xp).label, rules: ruleCount ?? 0, posts: postCount ?? 0 };
    }

    const { subject, html, text } = renderChallengeSequenceEmail(step, {
      firstName,
      appUrl: APP_ORIGIN,
      unsubUrl,
      continueUrl: CLUB_CONTINUE_URL,
      ftaUrl: FTA_CHALLENGE_URL,
      stats,
    });

    const result = await sendDripEmail({ to: prof.email, subject, html, text, unsubUrl });
    if (result.ok) {
      await db
        .from("challenge_sequences")
        .update({ status: "sent", sent_at: new Date().toISOString(), resend_id: result.id ?? null, error: null })
        .eq("id", r.id);
      sent++;
    } else {
      await db
        .from("challenge_sequences")
        .update({ status: "failed", error: result.error ?? "send failed" })
        .eq("id", r.id);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    challenge_emails_enabled: true,
    dry_run: false,
    due: rows.length,
    sent,
    failed,
    skipped,
  });
}
