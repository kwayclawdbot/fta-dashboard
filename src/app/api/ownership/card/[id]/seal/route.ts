import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEodClose } from "@/lib/ownership/pricing";
import { rowToCard, type CardRow } from "@/lib/ownership/shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ownership/card/[id]/seal — the owner self-reports a sale.
 *
 * Body: { remainingQuantity?: number }  (default 0 = full sale)
 *   remainingQuantity <= 0 → card RETIRED
 *   remainingQuantity  > 0 → card SEAL_BROKEN (partial)
 * Runs through the report_seal_broken RPC (owner-checked, writes the provenance
 * event). Returns the updated OwnershipCard.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let remaining = 0;
  try {
    const body = (await req.json()) as { remainingQuantity?: unknown };
    if (body && body.remainingQuantity != null) {
      const r = Number(body.remainingQuantity);
      if (!Number.isFinite(r) || r < 0) {
        return NextResponse.json(
          { error: "remainingQuantity must be a non-negative number" },
          { status: 400 }
        );
      }
      remaining = r;
    }
  } catch {
    // empty body → full sale (remaining = 0)
  }

  const { data, error } = await supabase.rpc("report_seal_broken", {
    p_card_id: id,
    p_remaining_quantity: remaining,
  });
  if (error || !data) {
    // RPC raises for not-found / not-owner / already-retired.
    const msg = error?.message || "seal report failed";
    const status = /not the card owner|card not found/.test(msg) ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  const row = data as CardRow;
  const price = await getEodClose(row.asset_symbol, row.asset_type);
  const card = rowToCard(
    row,
    price ? { price: price.close, asOf: new Date().toISOString() } : undefined
  );

  return NextResponse.json(card);
}
