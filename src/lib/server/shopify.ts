/**
 * Shopify Admin — SERVER ONLY. Creates the printed-textbook order on the live
 * store (shop.cheatcode.com / d4558b.myshopify.com) whose Lulu Direct
 * integration prints & ships the book. Called from the VIP webhook after a
 * $197 Challenge VIP purchase: the Stripe payment already happened, so the
 * Shopify order is created as PAID (financial_status='paid') purely to hand the
 * shipping address to the store's fulfillment pipeline.
 *
 * Best-effort: returns { ok:false } (never throws) when SHOPIFY_ADMIN_ACCESS_TOKEN
 * is not configured or the API errors, so provisioning degrades to the app-side
 * manual fulfillment queue. Uses the raw Admin REST API (no SDK).
 *
 * OWNER SETUP REQUIRED before auto-fulfillment works:
 *   • Create a custom app on the store with `write_orders` scope, install it,
 *     and add its Admin API access token to Vercel as SHOPIFY_ADMIN_ACCESS_TOKEN
 *     (Production). SHOPIFY_STORE_DOMAIN should be the *.myshopify.com host.
 *   • The store's Lulu Direct app auto-fulfills on paid orders, so the FIRST
 *     real VIP purchase is the live fulfillment test (we do not create test
 *     print orders here — that would trigger a real Lulu print).
 */
import type { NormalizedShipping } from "@/lib/server/shop";

// The printed textbook on the live store: "Intro To Stocks (Trading and
// investment book)" — $197. Order create takes the numeric variant id.
const TEXTBOOK_VARIANT_ID = process.env.SHOPIFY_TEXTBOOK_VARIANT_ID?.trim() || "50727898841386";
const STORE_DOMAIN = (process.env.SHOPIFY_STORE_DOMAIN?.trim() || "d4558b.myshopify.com").replace(
  /^https?:\/\//,
  ""
);
const API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION?.trim() || "2024-10";

export interface ShopifyOrderResult {
  ok: boolean;
  orderId?: string;
  orderName?: string;
  error?: string;
}

/** Split a full name into {first,last} for Shopify's address fields. */
function splitName(name: string | undefined): { first: string; last: string } {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Challenge", last: "VIP" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export async function createShopifyTextbookOrder(opts: {
  email?: string;
  shipping: NormalizedShipping;
}): Promise<ShopifyOrderResult> {
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, error: "SHOPIFY_ADMIN_ACCESS_TOKEN not configured" };

  const { first, last } = splitName(opts.shipping.name);
  const a = opts.shipping.address || {};
  const order: Record<string, unknown> = {
    line_items: [{ variant_id: Number(TEXTBOOK_VARIANT_ID), quantity: 1 }],
    email: opts.email || undefined,
    financial_status: "paid", // already paid via Stripe
    inventory_behaviour: "bypass",
    send_receipt: false,
    send_fulfillment_receipt: false,
    tags: "challenge-vip, stripe-paid",
    note: "Cheat Code Club — Challenge VIP textbook (paid via Stripe).",
    shipping_address: {
      first_name: first,
      last_name: last,
      address1: a.line1 || undefined,
      address2: a.line2 || undefined,
      city: a.city || undefined,
      province: a.state || undefined,
      zip: a.postal_code || undefined,
      country_code: a.country || undefined,
      phone: opts.shipping.phone || undefined,
    },
  };

  try {
    const res = await fetch(
      `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/orders.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ order }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as {
      order?: { id?: number | string; name?: string };
      errors?: unknown;
    };
    if (!res.ok || !json.order?.id) {
      return {
        ok: false,
        error: `${res.status}: ${JSON.stringify(json.errors || json).slice(0, 300)}`,
      };
    }
    return { ok: true, orderId: String(json.order.id), orderName: json.order.name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "shopify order failed" };
  }
}
