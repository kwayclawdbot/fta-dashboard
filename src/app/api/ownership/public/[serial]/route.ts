import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEodClose } from "@/lib/ownership/pricing";
import { publicRowToView, type PublicViewRow } from "@/lib/ownership/shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ownership/public/[serial] — ANONYMOUS public projection of a card.
 * Backs the future /c/[serial] scan page. Reads through the public_card_view RPC
 * (security-definer, exposes NO account/basis data) and folds in a live EOD close
 * to compute currentValue + growth-since-issue. Never returns quantity, avg price,
 * brokerage account, or owner identity beyond an optional first-name/last-initial.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ serial: string }> }
) {
  const { serial } = await ctx.params;
  if (!serial || !/^CC-S\d{2}-\d{6}$/i.test(serial.trim())) {
    return NextResponse.json({ error: "invalid serial" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc("public_card_view", {
    p_serial: serial.trim().toUpperCase(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as PublicViewRow[];
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const price = await getEodClose(row.asset_symbol, row.asset_type);
  const view = publicRowToView(row, price ? price.close : null);

  return NextResponse.json(view, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
