import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createOrderFromSession, attemptFulfillment } from "@/lib/server/shop";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook for the SHOP lane only. Verifies the signature manually (same
 * HMAC pattern as the membership webhook) against SHOP_STRIPE_WEBHOOK_SECRET.
 *
 * Stripe fans every event out to every endpoint, so this handler ONLY acts on
 * checkout.session.completed events carrying metadata.kind==='shop'. Everything
 * else is acknowledged (200) and skipped — membership checkouts never create an
 * order here, and shop checkouts are guarded out of the membership webhook.
 */
function verify(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=") as [string, string])
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 600) return false; // 10 min tolerance
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${payload}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.SHOP_STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });
  const payload = await req.text();
  if (!verify(payload, req.headers.get("stripe-signature"), secret))
    return NextResponse.json({ error: "bad signature" }, { status: 400 });

  const event = JSON.parse(payload);
  if (event.type !== "checkout.session.completed")
    return NextResponse.json({ received: true, skipped: "not_checkout_completed" });

  const session = event.data?.object ?? {};
  if (session.metadata?.kind !== "shop")
    return NextResponse.json({ received: true, skipped: "not_shop" });

  const productId: string | undefined = session.metadata?.product_id;
  const quantity = Number(session.metadata?.quantity) || 1;
  if (!productId)
    return NextResponse.json({ received: true, skipped: "no_product_id" });

  try {
    const { orderId } = await createOrderFromSession({ session, productId, quantity });
    // Fulfillment is best-effort — degrades to 'awaiting_fulfillment_setup'
    // when Lulu isn't wired up. Never 500 on a fulfillment hiccup: the order
    // row is the durable record and the admin can retry.
    await attemptFulfillment(orderId).catch((e) =>
      console.error("shop fulfillment error:", orderId, e)
    );
    return NextResponse.json({ received: true, orderId });
  } catch (e) {
    console.error("shop webhook order error:", e);
    return NextResponse.json({ error: "order create failed" }, { status: 500 });
  }
}
