import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rowToTransfer, type TransferRow } from "@/lib/ownership/shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ownership/transfer — begin the gift ceremony.
 *
 * Body: { cardId, recipient, message? }
 *   recipient = an exact Club username OR email.
 * Runs the initiate_transfer RPC (owner-checked, card must be ACTIVE): resolves
 * the recipient, locks the card to IN_TRANSFER and writes the 'transfer_out'
 * provenance event. Returns the pending CardTransfer.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { cardId?: unknown; recipient?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const cardId = typeof body.cardId === "string" ? body.cardId.trim() : "";
  if (!cardId) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }
  const recipient =
    typeof body.recipient === "string" ? body.recipient.trim() : "";
  if (!recipient) {
    return NextResponse.json({ error: "recipient required" }, { status: 400 });
  }
  const message =
    typeof body.message === "string" ? body.message.slice(0, 280) : null;

  const { data, error } = await supabase.rpc("initiate_transfer", {
    p_card_id: cardId,
    p_recipient_identifier: recipient,
    p_message: message,
  });
  if (error || !data) {
    const msg = error?.message || "transfer failed";
    const status = /not the card owner|card not found/.test(msg)
      ? 403
      : /recipient not found/.test(msg)
      ? 404
      : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json(rowToTransfer(data as TransferRow), { status: 201 });
}
