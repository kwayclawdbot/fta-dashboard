import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEodClose } from "@/lib/ownership/pricing";
import {
  rowToCard,
  rowToEvent,
  rowToSnapshot,
  type CardRow,
  type EventRow,
  type SnapshotRow,
} from "@/lib/ownership/shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ownership/card/[id] — a single card with its full provenance (events)
 * and snapshots. Owner-only: RLS returns no row for a card the caller doesn't own,
 * which surfaces here as a 404.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: cardRow, error } = await supabase
    .from("ownership_cards")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!cardRow) return NextResponse.json({ error: "not found" }, { status: 404 });

  const row = cardRow as CardRow;

  const [{ data: events }, { data: snapshots }, price] = await Promise.all([
    supabase
      .from("card_events")
      .select("*")
      .eq("card_id", id)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("card_snapshots")
      .select("*")
      .eq("card_id", id)
      .order("taken_at", { ascending: true }),
    getEodClose(row.asset_symbol, row.asset_type),
  ]);

  const card = rowToCard(
    row,
    price ? { price: price.close, asOf: new Date().toISOString() } : undefined
  );

  return NextResponse.json({
    card,
    events: ((events || []) as EventRow[]).map(rowToEvent),
    snapshots: ((snapshots || []) as SnapshotRow[]).map(rowToSnapshot),
  });
}
