import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLiveEvent } from "@/lib/live/queries";

/**
 * GET /api/live/[id] → LiveEventCardData (or 404).
 *
 * One live_event by id — the same card shape as the list, with the viewer's own
 * `interested` flag. Member-readable RLS; user-scoped client.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
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

  const event = await getLiveEvent(supabase, id, user.id);
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ event });
}
