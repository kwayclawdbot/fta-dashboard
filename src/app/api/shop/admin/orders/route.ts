import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/require-admin";
import { attemptFulfillment, syncOrderStatus } from "@/lib/server/shop";

export const dynamic = "force-dynamic";

// GET ?status= → orders queue with items + product titles.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  const status = req.nextUrl.searchParams.get("status");
  let q = auth.db
    .from("shop_orders")
    .select(
      "*, items:shop_order_items(id, order_id, product_id, quantity, unit_cents, product:shop_products(slug, title, kind))"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ orders: data || [] });
}

// POST { orderId, action: 'submit' | 'sync' }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => ({}))) as {
    orderId?: string;
    action?: string;
  };
  if (!body.orderId) return NextResponse.json({ error: "missing orderId" }, { status: 400 });

  try {
    const result =
      body.action === "sync"
        ? await syncOrderStatus(body.orderId)
        : await attemptFulfillment(body.orderId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
