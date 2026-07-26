import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lightweight live_event state-advance cron (S2.5). Runs every 15 min on the
 * Vercel cron (see vercel.json) — no new infra. Two automatic, correct-by-default moves;
 * everything else is a human/host action through /api/live/[id]/state:
 *
 *   1. scheduled → starting_soon   when starts_at is within 30 minutes. Pure UI
 *      urgency (countdown, live-energy) — NO push. Going LIVE stays a deliberate
 *      host action (the go-live push should fire only when the host is actually
 *      in the room, and join_url may still be null until the owner supplies it).
 *   2. live → ended (safety auto-end)   if a room was left running well past its
 *      planned duration (started_at + duration_min + 90-min grace). A host can
 *      also end manually via the state route; this only catches the forgotten
 *      room so an "ended" card + replay slot can follow.
 *
 * All mutations go through the advance_live_event() RPC (forward-only, service
 * role). Guarded like every other cron: Bearer CRON_SECRET or ?secret=.
 * ?dry=1 previews the moves without applying them.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STARTING_SOON_WINDOW_MS = 30 * 60 * 1000;
const AUTO_END_GRACE_MIN = 90;
const DEFAULT_DURATION_MIN = 90;

async function handle(req: NextRequest) {
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

  const admin = createAdminClient();
  const now = Date.now();
  const flipped: string[] = [];
  const ended: string[] = [];

  // (1) scheduled → starting_soon within the T-30 window.
  const soonCutoff = new Date(now + STARTING_SOON_WINDOW_MS).toISOString();
  const { data: soon } = await admin
    .from("live_events")
    .select("id")
    .eq("status", "scheduled")
    .lte("starts_at", soonCutoff)
    .limit(100);
  for (const e of soon ?? []) {
    if (!dry) {
      await admin.rpc("advance_live_event", {
        p_event_id: e.id,
        p_to_status: "starting_soon",
        p_replay_url: null,
      });
    }
    flipped.push(e.id as string);
  }

  // (2) live → ended (safety) for rooms left running past their window.
  const { data: liveRows } = await admin
    .from("live_events")
    .select("id, started_at, duration_min")
    .eq("status", "live")
    .not("started_at", "is", null)
    .limit(100);
  for (const e of liveRows ?? []) {
    const started = new Date(e.started_at as string).getTime();
    const dur = (e.duration_min as number | null) ?? DEFAULT_DURATION_MIN;
    const autoEndAt = started + (dur + AUTO_END_GRACE_MIN) * 60 * 1000;
    if (now > autoEndAt) {
      if (!dry) {
        await admin.rpc("advance_live_event", {
          p_event_id: e.id,
          p_to_status: "ended",
          p_replay_url: null,
        });
      }
      ended.push(e.id as string);
    }
  }

  return NextResponse.json({
    ok: true,
    dry_run: dry,
    started_soon: flipped.length,
    auto_ended: ended.length,
    flipped,
    ended,
  });
}

export const GET = handle;
export const POST = handle;
