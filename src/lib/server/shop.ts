/**
 * Server-side shop helpers (service role) — order creation from Stripe, Lulu
 * fulfillment, and status sync. Never import from client components.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPrintJob,
  getPrintJob,
  luluConfigured,
  mapLuluStatus,
  type LuluLineItem,
  type LuluShippingAddress,
} from "@/lib/server/lulu";
import { AWAITING_FULFILLMENT, type ShopOrderStatus } from "@/lib/shop";

const PRINT_BUCKET = "print-files";
const SIGNED_URL_TTL = 60 * 60 * 24 * 14; // 14 days — Lulu pulls during production

export function shopDb() {
  return createAdminClient();
}

export interface NormalizedShipping {
  name: string;
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  phone?: string;
}

/** Best-effort shipping extraction from a Stripe Checkout Session object. */
export function normalizeShipping(session: Record<string, unknown>): NormalizedShipping {
  const s = session as Record<string, any>;
  const src =
    s.shipping_details ||
    s.collected_information?.shipping_details ||
    s.shipping ||
    s.customer_details ||
    {};
  const addr = src.address || s.customer_details?.address || {};
  return {
    name: src.name || s.customer_details?.name || "",
    address: {
      line1: addr.line1 || undefined,
      line2: addr.line2 || undefined,
      city: addr.city || undefined,
      state: addr.state || undefined,
      postal_code: addr.postal_code || undefined,
      country: addr.country || undefined,
    },
    phone: src.phone || s.customer_details?.phone || undefined,
  };
}

/**
 * Idempotently create a shop_order (+ items) from a completed Stripe session.
 * Returns the order id. If an order already exists for this session, returns it
 * without re-inserting (Stripe delivers webhooks at-least-once).
 */
export async function createOrderFromSession(opts: {
  session: Record<string, unknown>;
  productId: string;
  quantity: number;
}): Promise<{ orderId: string; created: boolean }> {
  const db = shopDb();
  const s = opts.session as Record<string, any>;
  const sessionId = String(s.id);

  const { data: existing } = await db
    .from("shop_orders")
    .select("id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (existing) return { orderId: existing.id, created: false };

  const shipping = normalizeShipping(opts.session);
  const email =
    s.customer_details?.email || s.customer_email || shipping.name || "unknown@unknown";

  const { data: order, error } = await db
    .from("shop_orders")
    .insert({
      email: String(email).toLowerCase(),
      customer_name: shipping.name || s.customer_details?.name || null,
      stripe_session_id: sessionId,
      amount_total: s.amount_total ?? null,
      currency: s.currency || "usd",
      shipping: shipping as unknown as Record<string, unknown>,
      status: "paid",
    })
    .select("id")
    .single();

  if (error) {
    // Unique violation → another delivery beat us; fetch and return it.
    const { data: race } = await db
      .from("shop_orders")
      .select("id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (race) return { orderId: race.id, created: false };
    throw new Error(`order insert failed: ${error.message}`);
  }

  // Load the purchased product to snapshot unit price.
  const { data: product } = await db
    .from("shop_products")
    .select("id, price_cents")
    .eq("id", opts.productId)
    .maybeSingle();

  await db.from("shop_order_items").insert({
    order_id: order.id,
    product_id: opts.productId,
    quantity: Math.max(1, opts.quantity),
    unit_cents: product?.price_cents ?? 0,
  });

  return { orderId: order.id, created: true };
}

interface PrintableBook {
  title: string;
  pod_package_id: string | null;
  interior_pdf_path: string | null;
  cover_pdf_path: string | null;
  quantity: number;
}

/**
 * Expand an order's items into a flat list of physical books to print.
 * Bundles expand to their member products (quantity multiplied).
 */
async function collectPrintableBooks(orderId: string): Promise<PrintableBook[]> {
  const db = shopDb();
  const { data: items } = await db
    .from("shop_order_items")
    .select("quantity, product:shop_products(id, title, kind, pod_package_id, interior_pdf_path, cover_pdf_path)")
    .eq("order_id", orderId);

  const books: PrintableBook[] = [];
  for (const it of items || []) {
    const p = (it as any).product as any;
    if (!p) continue;
    const qty = Math.max(1, (it as any).quantity || 1);
    if (p.kind === "bundle") {
      const { data: members } = await db
        .from("shop_bundle_items")
        .select("product:shop_products!shop_bundle_items_product_id_fkey(title, pod_package_id, interior_pdf_path, cover_pdf_path)")
        .eq("bundle_id", p.id);
      for (const m of members || []) {
        const mp = (m as any).product as any;
        if (!mp) continue;
        books.push({
          title: mp.title,
          pod_package_id: mp.pod_package_id,
          interior_pdf_path: mp.interior_pdf_path,
          cover_pdf_path: mp.cover_pdf_path,
          quantity: qty,
        });
      }
    } else {
      books.push({
        title: p.title,
        pod_package_id: p.pod_package_id,
        interior_pdf_path: p.interior_pdf_path,
        cover_pdf_path: p.cover_pdf_path,
        quantity: qty,
      });
    }
  }
  return books;
}

async function signedUrl(path: string): Promise<string> {
  const db = shopDb();
  const { data, error } = await db.storage
    .from(PRINT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) {
    throw new Error(`signed url failed for ${path}: ${error?.message || "unknown"}`);
  }
  return data.signedUrl;
}

function shippingToLulu(order: any): LuluShippingAddress | null {
  const sh = order.shipping as NormalizedShipping | null;
  if (!sh || !sh.address?.line1 || !sh.address?.city || !sh.address?.country) return null;
  return {
    name: sh.name || order.customer_name || "Customer",
    street1: sh.address.line1,
    street2: sh.address.line2,
    city: sh.address.city,
    state_code: sh.address.state,
    postcode: sh.address.postal_code || "",
    country_code: sh.address.country,
    phone_number: sh.phone,
    email: order.email,
  };
}

export interface FulfillmentResult {
  status: ShopOrderStatus;
  reason?: string;
}

/**
 * Attempt Lulu fulfillment for an order. Degrades gracefully:
 *  - Lulu not configured, or any book missing pod_package_id / PDFs → leave
 *    status 'paid' and set error = 'awaiting_fulfillment_setup'.
 *  - Missing shipping → 'fulfillment_error'.
 *  - Lulu API throws → 'fulfillment_error' with the message.
 *  - Success → status mapped from Lulu, lulu_job_id + lulu_status stored.
 */
export async function attemptFulfillment(orderId: string): Promise<FulfillmentResult> {
  const db = shopDb();
  const { data: order } = await db
    .from("shop_orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (!order) throw new Error("order not found");

  const books = await collectPrintableBooks(orderId);

  const notReady =
    !luluConfigured() ||
    books.length === 0 ||
    books.some(
      (b) => !b.pod_package_id || !b.interior_pdf_path || !b.cover_pdf_path
    );

  if (notReady) {
    await db
      .from("shop_orders")
      .update({ status: "paid", error: AWAITING_FULFILLMENT, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    return { status: "paid", reason: AWAITING_FULFILLMENT };
  }

  const shipping = shippingToLulu(order);
  if (!shipping) {
    await db
      .from("shop_orders")
      .update({ status: "fulfillment_error", error: "missing_shipping_address", updated_at: new Date().toISOString() })
      .eq("id", orderId);
    return { status: "fulfillment_error", reason: "missing_shipping_address" };
  }

  try {
    const lineItems: LuluLineItem[] = [];
    for (const b of books) {
      lineItems.push({
        pod_package_id: b.pod_package_id!,
        interior_source_url: await signedUrl(b.interior_pdf_path!),
        cover_source_url: await signedUrl(b.cover_pdf_path!),
        quantity: b.quantity,
        title: b.title,
      });
    }
    const job = await createPrintJob({
      contactEmail: order.email,
      externalId: order.id,
      shipping,
      lineItems,
    });
    const status = mapLuluStatus(job.status);
    await db
      .from("shop_orders")
      .update({
        status,
        lulu_job_id: job.id,
        lulu_status: job.raw as Record<string, unknown>,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    return { status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db
      .from("shop_orders")
      .update({ status: "fulfillment_error", error: msg, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    return { status: "fulfillment_error", reason: msg };
  }
}

/** Pull the latest Lulu job status and reconcile the order. */
export async function syncOrderStatus(orderId: string): Promise<FulfillmentResult> {
  const db = shopDb();
  const { data: order } = await db
    .from("shop_orders")
    .select("id, lulu_job_id")
    .eq("id", orderId)
    .single();
  if (!order?.lulu_job_id) return { status: "paid", reason: "no_lulu_job" };
  if (!luluConfigured()) return { status: "paid", reason: "lulu_not_configured" };

  try {
    const job = (await getPrintJob(order.lulu_job_id)) as any;
    const status = mapLuluStatus(job?.status?.name);
    const tracking =
      job?.line_items?.map((li: any) => ({
        title: li.title,
        tracking_id: li.tracking_id,
        tracking_urls: li.tracking_urls,
        carrier: li.carrier_name,
      })) ?? null;
    await db
      .from("shop_orders")
      .update({
        status,
        lulu_status: job as Record<string, unknown>,
        tracking: tracking ? { items: tracking } : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    return { status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: "fulfillment_error", reason: msg };
  }
}
