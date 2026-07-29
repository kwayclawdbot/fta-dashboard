import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCardPrice } from "@/lib/ownership/pricing";
import { rowToCard, type CardRow } from "@/lib/ownership/shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ownership/claim — bind a physical chip to a card you own (first tap
 * claims the serial). Body: { chipSerial, cardId }.
 *
 * Runs the claim_chip RPC (owner-checked; chip must be provisioned+unclaimed; card
 * must not already carry a chip). The marriage is permanent — a 'chip_bound'
 * provenance event is written and ownership_cards.nfc_uid is set. Returns the
 * updated card with a live value folded in.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { chipSerial?: unknown; cardId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const chipSerial =
    typeof body.chipSerial === "string" ? body.chipSerial.trim() : "";
  if (!/^CC-P\d{2}-\d{6}$/i.test(chipSerial)) {
    return NextResponse.json({ error: "invalid chipSerial" }, { status: 400 });
  }
  const cardId = typeof body.cardId === "string" ? body.cardId.trim() : "";
  if (!cardId) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("claim_chip", {
    p_chip_serial: chipSerial.toUpperCase(),
    p_card_id: cardId,
  });
  if (error || !data) {
    const msg = error?.message || "claim failed";
    const status = /not the card owner/.test(msg)
      ? 403
      : /not found/.test(msg)
      ? 404
      : /not claimable|already has a chip/.test(msg)
      ? 409
      : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  const row = data as CardRow;
  const price = await getCardPrice(row.asset_symbol, row.asset_type);
  const card = rowToCard(row, price ? { price: price.price, asOf: price.asOf } : undefined);

  return NextResponse.json(card, { status: 200 });
}
