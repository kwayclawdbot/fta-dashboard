import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fanoutLiveStarting } from "@/lib/live/notify";
import { LIVE_STATUS_ORDER, type LiveEventStatus } from "@/lib/live/types";

/**
 * POST /api/live/[id]/state — advance a live_event's lifecycle (admin/cron).
 *
 * Body: { to: 'starting_soon'|'live'|'ended'|'replay_ready', replay_url?: string }.
 * Guarded exactly like the other admin/cron routes: Bearer CRON_SECRET or
 * ?secret= (refuses if CRON_SECRET unset — fail-safe). The transition itself
 * runs through the SECURITY DEFINER advance_live_event() RPC (service-role only,
 * forward-only, enforces the state machine) — the route never writes status
 * directly.
 *
 * SIDE EFFECT — on a successful scheduled/starting_soon → LIVE transition, we
 * fan out the go-live push to Remind-Me members via the existing dispatch
 * machinery (contextual copy per room type, one push per member per event).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") || "";
  const qsSecret = req.nextUrl.searchParams.get("secret") || "";
  if (auth !== `Bearer ${secret}` && qsSecret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "bad event id" }, { status: 400 });
  }

  let to: string | undefined;
  let replayUrl: string | undefined;
  try {
    const body = (await req.json()) as { to?: string; replay_url?: string };
    to = body.to;
    replayUrl = body.replay_url;
  } catch {
    // fall through → validated below
  }
  if (!to || !LIVE_STATUS_ORDER.includes(to as LiveEventStatus)) {
    return NextResponse.json({ error: "bad target status" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: result, error } = await admin.rpc("advance_live_event", {
    p_event_id: id,
    p_to_status: to,
    p_replay_url: replayUrl ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const res = result as {
    ok: boolean;
    error?: string;
    noop?: boolean;
    event?: {
      id: string;
      status: LiveEventStatus;
      room_type: "audio" | "market" | "class";
      title: string;
      viewer_count: number;
      host_id: string | null;
    };
  };
  if (!res?.ok) {
    return NextResponse.json({ error: res?.error ?? "transition_failed" }, { status: 409 });
  }

  // Go-live push fan-out (skipped on a no-op re-issue; deduped inside).
  let fanout = null;
  if (!res.noop && to === "live" && res.event) {
    fanout = await fanoutLiveStarting(admin, {
      id: res.event.id,
      room_type: res.event.room_type,
      title: res.event.title,
      viewer_count: res.event.viewer_count,
      host_id: res.event.host_id,
    });
  }

  return NextResponse.json({ ok: true, event: res.event, noop: res.noop ?? false, fanout });
}
