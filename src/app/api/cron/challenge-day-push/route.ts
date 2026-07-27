import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CHALLENGE DAY PUSH — the owner's "notify them on each of the five days"
 * requirement, made real.
 *
 * TWO KINDS, one per day, each distinct and useful:
 *   ?kind=mission  the morning nudge — "Day N is open, here's tonight's mission"
 *   ?kind=session  the pre-session nudge — "Day N's class starts at 7 PM ET"
 *
 * SCHEDULE (vercel.json; Vercel cron schedules are UTC):
 *   13:00 UTC = 9:00 AM EDT  → kind=mission
 *   22:30 UTC = 6:30 PM EDT  → kind=session   (sessions are 23:00 UTC = 7 PM EDT)
 * September 2026 is EDT (UTC−4), not EST. Both crons run daily and are no-ops on
 * every day outside the challenge window because `challenge_due_pushes` only
 * matches rows whose real `unlock_at` / `session_at` bracket now().
 *
 * IDEMPOTENCY IS IN THE DATABASE, not here. `challenge_send_push()` inserts the
 * (user, day, kind) row into `challenge_push_log` FIRST and only creates the
 * notification if that insert won the race. Running this route twice — or the
 * cron firing twice — buzzes nobody twice.
 *
 * DELIVERY: the notification row triggers the existing pg_net → /api/push/dispatch
 * pipeline (migration 028), which honours `notification_prefs.push_challenge` and
 * falls through to the email queue for members with no push subscription. This
 * route deliberately does not talk to web-push itself; there is one dispatcher.
 *
 * GUARDRAILS: `challenge_due_pushes` excludes any member inside a family
 * downtime window or over a daily limit (migration 192's predicate, applied to an
 * explicit subject since a cron has no auth.uid()). A minor is never buzzed at
 * 9 PM to go do a mission.
 *
 * Auth: Bearer CRON_SECRET or ?secret=. Refuses if CRON_SECRET is unset.
 * ?dry=1 reports who WOULD be pushed and writes nothing.
 */

type Kind = "mission" | "session";

interface DueRow {
  user_id: string;
  day_no: number;
  title: string;
  theme: string;
  session_at: string;
  live_event_id: string | null;
}

function bodyFor(kind: Kind, row: DueRow): string {
  if (kind === "session") {
    return `🎓 Day ${row.day_no} goes live at 7:00 PM ET — ${row.title}. See you in the room.`;
  }
  return `Day ${row.day_no} is open: ${row.title}. ${row.theme}. Tonight's session is 7:00 PM ET.`;
}

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

  const kindParam = (req.nextUrl.searchParams.get("kind") || "mission") as Kind;
  if (kindParam !== "mission" && kindParam !== "session") {
    return NextResponse.json({ error: "kind must be mission|session" }, { status: 400 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";

  const db = createAdminClient();

  const { data, error } = await db.rpc("challenge_due_pushes", { p_kind: kindParam });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const due = (data || []) as DueRow[];

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      kind: kindParam,
      due: due.length,
      sample: due.slice(0, 5).map((r) => ({
        day: r.day_no,
        body: bodyFor(kindParam, r),
      })),
    });
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of due) {
    const link = `/challenge/days/${row.day_no}`;
    const { data: notifId, error: sendErr } = await db.rpc("challenge_send_push", {
      p_user: row.user_id,
      p_day: row.day_no,
      p_kind: kindParam,
      p_body: bodyFor(kindParam, row),
      p_link: link,
    });
    if (sendErr) {
      errors.push(sendErr.message);
      continue;
    }
    // null = the (user, day, kind) row already existed → nothing was created.
    if (notifId) sent += 1;
    else skipped += 1;
  }

  return NextResponse.json({
    ok: true,
    kind: kindParam,
    due: due.length,
    sent,
    already_sent: skipped,
    errors: errors.slice(0, 5),
  });
}
