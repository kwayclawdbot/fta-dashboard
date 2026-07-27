import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildChallengeIcsFromDays, type IcsSession } from "@/lib/challenge/ics";
import { siteUrl } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /challenge/calendar[.ics] — the five live sessions as a real calendar file,
 * built from `challenge_days` so it always matches what the app is counting down
 * to. Moving a session is an UPDATE, not a deploy.
 *
 * ?day=N serves a single session ("just Day 1").
 *
 * Authenticated members also get their `calendar_added_at` stamped — the
 * commitment step in the MINUTE-0 board is a REAL write, not a UI flourish, and
 * the funnel dashboard can count it. An anonymous request still gets the file
 * (a calendar link ought to survive being forwarded), it just records nothing.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dayParam = url.searchParams.get("day");
  const only = dayParam ? Number.parseInt(dayParam, 10) : null;

  const admin = createAdminClient();
  const { data: cohort } = await admin
    .from("challenge_cohorts")
    .select("id")
    .eq("active", true)
    .order("kickoff_at")
    .limit(1)
    .maybeSingle();

  if (!cohort?.id) {
    return new NextResponse("No active challenge cohort.", { status: 404 });
  }

  let query = admin
    .from("challenge_days")
    .select("day_no, title, theme, session_at, session_minutes")
    .eq("cohort_id", cohort.id)
    .order("day_no");
  if (only && only >= 1 && only <= 5) query = query.eq("day_no", only);

  const { data: days } = await query;
  if (!days || days.length === 0) {
    return new NextResponse("No sessions scheduled yet.", { status: 404 });
  }

  // Stamp the commitment for a signed-in member (best-effort, never blocking).
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) await supabase.rpc("challenge_mark_calendar_added");
  } catch {
    /* anonymous or cookie-less request — the file is still served */
  }

  const ics = buildChallengeIcsFromDays(days as IcsSession[], siteUrl());

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="5-day-investing-challenge${
        only ? `-day-${only}` : ""
      }.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
