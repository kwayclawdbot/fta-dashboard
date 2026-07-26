import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/alerts/setups/[id]/subscribe — opt in / out of a setup's lifecycle
 * thread (LANE A backend for "Watch this setup"; the button is Lane B).
 *
 * Body: { subscribe: boolean }  (default true).
 * Only opted-in members receive that setup's lifecycle updates (fanned by
 * advance_setup_state). Own-row RLS makes the write self-authorising; we go
 * through the user-scoped client so a member can only touch their own opt-in.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "bad setup id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let subscribe = true;
  try {
    const body = (await req.json()) as { subscribe?: boolean };
    if (typeof body.subscribe === "boolean") subscribe = body.subscribe;
  } catch {
    // empty body → default subscribe:true
  }

  // Setup must exist (and be readable) before we let anyone follow it.
  const { data: setup } = await supabase
    .from("alert_setups")
    .select("id, state")
    .eq("id", id)
    .maybeSingle();
  if (!setup) {
    return NextResponse.json({ error: "setup not found" }, { status: 404 });
  }

  if (subscribe) {
    const { error } = await supabase
      .from("setup_subscriptions")
      .upsert({ setup_id: id, user_id: user.id }, { onConflict: "setup_id,user_id" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("setup_subscriptions")
      .delete()
      .eq("setup_id", id)
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, setup_id: id, subscribed: subscribe });
}
