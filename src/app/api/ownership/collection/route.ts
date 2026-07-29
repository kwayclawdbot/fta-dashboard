import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEodCloses } from "@/lib/ownership/pricing";
import { rowToCard, type CardRow } from "@/lib/ownership/shape";
import type { OwnershipCard } from "@/lib/ownership/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ownership/collection — the current member's cards (RLS-scoped to owner),
 * each with a live market value (ONE batched, day-cached Polygon pass for all
 * symbols) and its cached design_state. Shaped as OwnershipCard[].
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("ownership_cards")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as CardRow[];
  if (rows.length === 0) return NextResponse.json([] as OwnershipCard[]);

  const prices = await getEodCloses(
    rows.map((r) => ({ symbol: r.asset_symbol, assetType: r.asset_type }))
  );
  const asOf = new Date().toISOString();

  const cards: OwnershipCard[] = rows.map((r) => {
    const p = prices[r.asset_symbol.toUpperCase()];
    return rowToCard(r, p ? { price: p.close, asOf } : undefined);
  });

  return NextResponse.json(cards);
}
