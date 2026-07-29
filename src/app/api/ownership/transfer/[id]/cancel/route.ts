import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rowToTransfer, type TransferRow } from "@/lib/ownership/shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ownership/transfer/[id]/cancel — the SENDER revokes their own pending
 * gift. Reverts the card to ACTIVE and writes a 'transfer_cancelled' provenance
 * event. Returns the resolved CardTransfer.
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

  const { data, error } = await supabase.rpc("cancel_transfer", {
    p_transfer_id: id,
  });
  if (error || !data) {
    const msg = error?.message || "cancel failed";
    const status = /not the sender/.test(msg)
      ? 403
      : /transfer not found/.test(msg)
      ? 404
      : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json(rowToTransfer(data as TransferRow));
}
