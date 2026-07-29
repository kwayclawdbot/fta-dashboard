import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEodClose } from "@/lib/ownership/pricing";
import { rowToCard, type CardRow } from "@/lib/ownership/shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ownership/transfer/[id]/accept — recipient (or, for a kid recipient,
 * a supervising parent in the same family) accepts the gift.
 *
 * Runs accept_transfer: re-binds the card to the recipient, writes 'transfer_in'
 * + 'gifted' provenance (verification: 'self_reported' — the manual provider does
 * not verify the underlying share movement), and caches gift provenance on the
 * card. Returns the re-bound OwnershipCard with a live market value.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("accept_transfer", {
    p_transfer_id: id,
  });
  if (error || !data) {
    const msg = error?.message || "accept failed";
    const status = /not authorized/.test(msg)
      ? 403
      : /transfer not found|card not found/.test(msg)
      ? 404
      : 400;
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
