import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/ownership/providers";
import { validateSymbol, getEodClose, normalizeSymbol } from "@/lib/ownership/pricing";
import { rowToCard, type CardRow } from "@/lib/ownership/shape";
import type { AssetType } from "@/lib/ownership/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSET_TYPES: AssetType[] = ["stock", "etf", "crypto"];

/**
 * POST /api/ownership/mint — mint a digital ownership card from a self-reported
 * (or, later, brokerage-verified) position.
 *
 * Body: { symbol, assetType, quantity, averagePrice, acquiredAt }
 * Validates the symbol exists on the licensed feed, sanity-checks the numbers and
 * that acquiredAt is not in the future, resolves the provider (manual now,
 * SnapTrade when its key lands), then calls the mint_card RPC — which atomically
 * creates the card, the 'activated' event and the 'issue' snapshot. Returns the
 * OwnershipCard with a live market value folded in.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    symbol?: unknown;
    assetType?: unknown;
    quantity?: unknown;
    averagePrice?: unknown;
    acquiredAt?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  // ── validate ──────────────────────────────────────────────────────────────
  const symbol = typeof body.symbol === "string" ? normalizeSymbol(body.symbol) : null;
  if (!symbol) return NextResponse.json({ error: "invalid symbol" }, { status: 400 });

  const assetType = body.assetType as AssetType;
  if (!ASSET_TYPES.includes(assetType)) {
    return NextResponse.json({ error: "invalid assetType" }, { status: 400 });
  }

  const quantity = Number(body.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
  }

  const averagePrice = Number(body.averagePrice);
  if (!Number.isFinite(averagePrice) || averagePrice <= 0) {
    return NextResponse.json({ error: "averagePrice must be a positive number" }, { status: 400 });
  }

  const acquiredAt =
    typeof body.acquiredAt === "string" ? new Date(body.acquiredAt) : new Date(NaN);
  if (Number.isNaN(acquiredAt.getTime())) {
    return NextResponse.json({ error: "invalid acquiredAt" }, { status: 400 });
  }
  if (acquiredAt.getTime() > Date.now()) {
    return NextResponse.json({ error: "acquiredAt cannot be in the future" }, { status: 400 });
  }

  // ── symbol must exist on the licensed feed ─────────────────────────────────
  const check = await validateSymbol(symbol, assetType);
  if (!check.valid) {
    return NextResponse.json({ error: `symbol ${symbol} not found` }, { status: 422 });
  }

  // ── resolve provider (manual now; SnapTrade verifies later) ────────────────
  const provider = getProvider();
  let positionRef: string | null = null;
  try {
    const verified = await provider.verifyPosition({
      userId: user.id,
      symbol,
      quantity,
      averagePrice,
      acquiredAt: acquiredAt.toISOString(),
    });
    positionRef = verified.positionRef;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "provider error" },
      { status: 503 }
    );
  }

  // ── mint (atomic: card + activated event + issue snapshot) ─────────────────
  const { data, error } = await supabase.rpc("mint_card", {
    p_symbol: symbol,
    p_asset_name: check.name,
    p_asset_type: assetType,
    p_quantity: quantity,
    p_avg_price: averagePrice,
    p_acquired_at: acquiredAt.toISOString(),
    p_provider: provider.kind,
    p_position_ref: positionRef,
    p_snaptrade_account_id: null,
  });
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "mint failed" },
      { status: 500 }
    );
  }

  const row = data as CardRow;
  const price = await getEodClose(symbol, assetType);
  const card = rowToCard(
    row,
    price ? { price: price.close, asOf: new Date().toISOString() } : undefined
  );

  return NextResponse.json(card, { status: 201 });
}
