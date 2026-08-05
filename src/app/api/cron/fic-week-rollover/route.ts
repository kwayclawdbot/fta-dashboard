import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * FIC weekly-loop rollover (Lane A; Vercel Cron -> this route).
 *
 * The whole weekly surface (This Week in FIC, Parent Corner coaching, Family
 * Night, Company of the Week, kid challenge) reads ONE row via getCurrentFicWeek
 * (src/lib/fic.ts), which prefers the row flagged is_current. Without this cron,
 * whatever week the owner last flagged stays frozen forever ("Week of July 20"
 * staleness). A backlog of future-dated weeks is seeded published=true /
 * is_current=false (migration 208); this route advances the flag on schedule.
 *
 * Advance rule (mirrors getCurrentFicWeek's date fallback so the flag and the
 * reader never disagree): the current week is the most recent PUBLISHED week
 * whose week_start is on or before today. If that week is already flagged, this
 * is a no-op. Otherwise the flag is moved to it and cleared everywhere else, so
 * exactly one row is is_current. Weeks with a future week_start are never made
 * current here, so seeding a backlog never goes live early.
 *
 * Auth: Bearer CRON_SECRET or ?secret=. Refuses if CRON_SECRET unset (fail-safe).
 *   ?dry=1  — report what WOULD change, write nothing.
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

  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // The week that SHOULD be current: most recent published week on/before today.
  const { data: due, error: dueErr } = await supabase
    .from("fic_weeks")
    .select("id, week_start, class_title, is_current")
    .eq("published", true)
    .lte("week_start", today)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dueErr) {
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }
  if (!due) {
    // Nothing published on/before today — leave the surface as-is.
    return NextResponse.json({ ok: true, today, changed: false, reason: "no_due_week" });
  }

  if (due.is_current) {
    return NextResponse.json({
      ok: true,
      today,
      changed: false,
      current: { id: due.id, week_start: due.week_start, class_title: due.class_title },
    });
  }

  if (dry) {
    return NextResponse.json({
      ok: true,
      today,
      dry: true,
      would_advance_to: {
        id: due.id,
        week_start: due.week_start,
        class_title: due.class_title,
      },
    });
  }

  // Move the flag: clear every other current row, then set the due one. Two
  // statements keep the single-current invariant even if a stray flag existed.
  const { error: clearErr } = await supabase
    .from("fic_weeks")
    .update({ is_current: false })
    .eq("is_current", true)
    .neq("id", due.id);
  if (clearErr) {
    return NextResponse.json({ error: clearErr.message }, { status: 500 });
  }

  const { error: setErr } = await supabase
    .from("fic_weeks")
    .update({ is_current: true })
    .eq("id", due.id);
  if (setErr) {
    return NextResponse.json({ error: setErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    today,
    changed: true,
    advanced_to: { id: due.id, week_start: due.week_start, class_title: due.class_title },
  });
}
