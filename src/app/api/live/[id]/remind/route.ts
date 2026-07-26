import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/live/[id]/remind — toggle the viewer's "Remind Me" opt-in.
 *
 * Body: { interested?: boolean }. Omitted → TOGGLE the current state; explicit
 * true/false → set it. live_event_interest is own-row RLS, so the write is
 * self-authorising through the user-scoped client (a member can only touch their
 * own opt-in). The interested_count on the event is kept in sync by a DB trigger.
 *
 * Opting in is what subscribes a member to the go-live push (fanned out on the
 * scheduled→live transition through the existing dispatch machinery).
 *
 * Returns { interested, interested_count }.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "bad event id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Event must exist + be readable (member RLS) before we let anyone follow it.
  const { data: ev } = await supabase
    .from("live_events")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();
  if (!ev) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Current opt-in state.
  const { data: existing } = await supabase
    .from("live_event_interest")
    .select("event_id")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const currently = Boolean(existing);

  // Desired: explicit body value, else toggle.
  let desired = !currently;
  try {
    const body = (await req.json()) as { interested?: boolean };
    if (typeof body.interested === "boolean") desired = body.interested;
  } catch {
    // empty body → toggle
  }

  if (desired && !currently) {
    const { error } = await supabase
      .from("live_event_interest")
      .insert({ event_id: id, user_id: user.id });
    // Ignore a unique-violation race (already interested).
    if (error && !/duplicate key|23505/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (!desired && currently) {
    const { error } = await supabase
      .from("live_event_interest")
      .delete()
      .eq("event_id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Read back the (trigger-maintained) count for an accurate optimistic UI.
  const { data: after } = await supabase
    .from("live_events")
    .select("interested_count")
    .eq("id", id)
    .maybeSingle();

  return NextResponse.json({
    interested: desired,
    interested_count: after?.interested_count ?? 0,
  });
}
