import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { beltForXp } from "@/lib/belts";
import {
  renderDrip,
  type DripStep,
  type DripVariant,
  type DripStats,
} from "@/lib/server/drip-templates";
import { APP_ORIGIN, dripUnsubUrl, sendDripEmail } from "@/lib/server/drips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily welcome-drip sender (Vercel Cron → this route; see vercel.json).
 *
 * HARD GATE: sends nothing unless app_settings.drip_enabled === true. While the
 * flag is false the route reports what WOULD go out but sends zero mail — this
 * is the "zero real-member sends until the owner approves the look" guarantee.
 *
 * For each due step (scheduled_at <= now, status = 'pending', sent_at null) it
 * resolves the owner profile, skips opted-out / kid / email-less accounts, and
 * sends via Resend. D7 merges LIVE stats (lifetime XP, belt, lessons done) at
 * send time. Idempotent: a sent step flips off 'pending', so re-running is safe.
 *
 * Auth: Bearer CRON_SECRET (Vercel injects it) or ?secret=. Without CRON_SECRET
 * configured the route refuses — fail-safe. ?dry=1 forces a no-send preview.
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

  const forceDry = req.nextUrl.searchParams.get("dry") === "1";
  const db = createAdminClient();
  const nowIso = new Date().toISOString();

  // Hard gate.
  const { data: flag } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "drip_enabled")
    .maybeSingle();
  const dripEnabled = flag?.value === true;

  // Due, unsent steps (bounded for safety).
  const { data: due, error: dueErr } = await db
    .from("email_drips")
    .select("id, user_id, sequence, step, variant, scheduled_at")
    .eq("status", "pending")
    .is("sent_at", null)
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(200);
  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }

  const rows = due ?? [];

  // Nothing to do, or the flag is off → report and send nothing.
  if (!dripEnabled || forceDry || rows.length === 0) {
    return NextResponse.json({
      ok: true,
      drip_enabled: dripEnabled,
      dry_run: forceDry || !dripEnabled,
      due: rows.length,
      sent: 0,
      note: !dripEnabled
        ? "drip_enabled is false — nothing sent"
        : forceDry
          ? "dry-run — nothing sent"
          : "no due steps",
    });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const r of rows) {
    // Resolve the owner profile.
    const { data: prof } = await db
      .from("profiles")
      .select("email, display_name, role")
      .eq("id", r.user_id)
      .maybeSingle();

    // Guard: adults only, must have an email, must not have opted out.
    const optedOut = await db
      .from("drip_optouts")
      .select("user_id")
      .eq("user_id", r.user_id)
      .maybeSingle();

    if (
      !prof?.email ||
      prof.role !== "parent" ||
      optedOut.data
    ) {
      await db
        .from("email_drips")
        .update({ status: "skipped", error: !prof?.email ? "no email" : prof.role !== "parent" ? "not owner role" : "opted out" })
        .eq("id", r.id);
      skipped++;
      continue;
    }

    const firstName = (prof.display_name || "").trim().split(/\s+/)[0] || "there";
    const unsubUrl = dripUnsubUrl(r.user_id);

    // D7: live merge stats at send time.
    let stats: DripStats | undefined;
    if (r.step === 7) {
      const [{ data: xpRows }, { count: lessonCount }] = await Promise.all([
        db.from("xp_events").select("amount").eq("user_id", r.user_id),
        db
          .from("lesson_progress")
          .select("id", { count: "exact", head: true })
          .eq("user_id", r.user_id)
          .eq("status", "completed"),
      ]);
      const xp = (xpRows ?? []).reduce(
        (n, x) => n + ((x as { amount: number }).amount || 0),
        0
      );
      stats = {
        xp,
        beltLabel: beltForXp(xp).label,
        lessons: lessonCount ?? 0,
      };
    }

    const { subject, html, text } = renderDrip(
      r.step as DripStep,
      r.variant as DripVariant,
      { firstName, appUrl: APP_ORIGIN, unsubUrl, stats }
    );

    const result = await sendDripEmail({
      to: prof.email,
      subject,
      html,
      text,
      unsubUrl,
    });

    if (result.ok) {
      await db
        .from("email_drips")
        .update({ status: "sent", sent_at: new Date().toISOString(), resend_id: result.id ?? null, error: null })
        .eq("id", r.id);
      sent++;
    } else {
      await db
        .from("email_drips")
        .update({ status: "failed", error: result.error ?? "send failed" })
        .eq("id", r.id);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    drip_enabled: true,
    dry_run: false,
    due: rows.length,
    sent,
    failed,
    skipped,
  });
}
