import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rowToTransfer, type TransferRow } from "@/lib/ownership/shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ownership/transfer/[id]/decline — recipient (or a kid recipient's
 * supervising parent) declines the gift. Reverts the card to ACTIVE (still owned
 * by the sender) and writes a 'transfer_declined' provenance event. Returns the
 * resolved CardTransfer.
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

  const { data, error } = await supabase.rpc("decline_transfer", {
    p_transfer_id: id,
  });
  if (error || !data) {
    const msg = error?.message || "decline failed";
    const status = /not authorized/.test(msg)
      ? 403
      : /transfer not found/.test(msg)
      ? 404
      : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json(rowToTransfer(data as TransferRow));
}
