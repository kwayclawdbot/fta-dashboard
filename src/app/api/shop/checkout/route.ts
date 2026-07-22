import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/shop/checkout { slug, quantity } → a Stripe Checkout Session for a
 * physical book/bundle. Price is looked up SERVER-SIDE (never trust the client).
 * The session carries metadata.kind='shop' so the membership webhook skips it
 * and OUR /api/shop/webhook picks it up.
 *
 * Uses the raw Stripe REST API (form-encoded) — no SDK, same pattern the rest
 * of this app follows. Runs on the live account (algo.cheatcode).
 */
export async function POST(req: NextRequest) {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return NextResponse.json({ error: "stripe not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const slug = String(body?.slug || "").trim();
  const quantity = Math.min(20, Math.max(1, Number(body?.quantity) || 1));
  if (!slug) return NextResponse.json({ error: "missing slug" }, { status: 400 });

  const db = createAdminClient();
  const { data: product } = await db
    .from("shop_products")
    .select("id, slug, title, subtitle, price_cents, active")
    .eq("slug", slug)
    .maybeSingle();

  if (!product || !product.active)
    return NextResponse.json({ error: "product not found" }, { status: 404 });

  const origin = req.nextUrl.origin;
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][quantity]", String(quantity));
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][unit_amount]", String(product.price_cents));
  form.set("line_items[0][price_data][product_data][name]", product.title);
  if (product.subtitle)
    form.set("line_items[0][price_data][product_data][description]", product.subtitle);
  form.set("shipping_address_collection[allowed_countries][0]", "US");
  form.set("shipping_address_collection[allowed_countries][1]", "CA");
  form.set("phone_number_collection[enabled]", "true");
  form.set("metadata[kind]", "shop");
  form.set("metadata[product_id]", product.id);
  form.set("metadata[slug]", product.slug);
  form.set("metadata[quantity]", String(quantity));
  form.set("success_url", `${origin}/shop/thanks?session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${origin}/shop/${product.slug}`);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sk}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("shop checkout stripe error:", JSON.stringify(json).slice(0, 400));
    return NextResponse.json(
      { error: (json as { error?: { message?: string } }).error?.message || "stripe error" },
      { status: 502 }
    );
  }
  return NextResponse.json({ url: (json as { url: string }).url, id: (json as { id: string }).id });
}
