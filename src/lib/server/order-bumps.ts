/**
 * Order-bump fulfillment — SERVER ONLY. Runs from the club/VIP provisioning
 * (webhook + page safety-net) when a completed Stripe session carries
 * metadata.bump. The Stripe charge already happened; this hands the mapped
 * physical SKUs to the live Shopify store (shop.cheatcode.com) for shipping and
 * keeps a durable shop_orders record.
 *
 * Bumps → Shopify variants:
 *   • textbook       → adults Investing Textbook.
 *   • parents_bundle → kids 4-book curriculum + adults Investing Textbook.
 *   • kids_bundle    → kids 4-book curriculum only.
 *
 * Idempotent on the Stripe session id (via a `${session}#bump` shop_orders key,
 * so it never collides with the VIP base textbook order on the same session).
 * Best-effort on every side-effect — never throws upward. Degrades to the
 * /admin/shop manual queue when SHOPIFY_ADMIN_ACCESS_TOKEN isn't configured or
 * the Shopify API errors (row stays status='paid' with a ship-note).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeShipping } from "@/lib/server/shop";
import { createShopifyOrder } from "@/lib/server/shopify";
import type { BumpId } from "@/lib/checkout-bumps";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Session = Record<string, any>;

// Live-store variant ids (env-overridable).
const TEXTBOOK_VARIANT =
  process.env.SHOPIFY_TEXTBOOK_VARIANT_ID?.trim() || "50727898841386";
const KIDS_BUNDLE_VARIANT =
  process.env.SHOPIFY_KIDS_BUNDLE_VARIANT_ID?.trim() || "51046051741994";

interface BumpFulfillment {
  cents: number;
  crmTag: string;
  shipNote: string;
  variants: { variantId: string; quantity: number }[];
}

const BUMPS: Record<BumpId, BumpFulfillment> = {
  textbook: {
    cents: 11900,
    crmTag: "bump:textbook",
    shipNote: "SHIP: Adults Investing Textbook x1",
    variants: [{ variantId: TEXTBOOK_VARIANT, quantity: 1 }],
  },
  parents_bundle: {
    cents: 29700,
    crmTag: "bump:parents-bundle",
    shipNote:
      "SHIP: Kids Homeschool Curriculum 4-book set x1 + Adults Investing Textbook x1",
    variants: [
      { variantId: KIDS_BUNDLE_VARIANT, quantity: 1 },
      { variantId: TEXTBOOK_VARIANT, quantity: 1 },
    ],
  },
  kids_bundle: {
    cents: 9700,
    crmTag: "bump:kids-bundle",
    shipNote: "SHIP: Kids Homeschool Curriculum 4-book set x1",
    variants: [{ variantId: KIDS_BUNDLE_VARIANT, quantity: 1 }],
  },
};

export interface BumpResult {
  ok: boolean;
  skipped?: boolean;
  bump?: BumpId;
  shopifyOrder?: string | null;
  error?: string;
}

export async function fulfillOrderBump(session: Session): Promise<BumpResult> {
  const bumpRaw = String(session?.metadata?.bump || "").trim();
  if (!bumpRaw || bumpRaw === "none") return { ok: true, skipped: true };
  const bump = bumpRaw as BumpId;
  const cfg = BUMPS[bump];
  if (!cfg) return { ok: true, skipped: true };

  const db = createAdminClient();
  const sessionId = String(session.id || "");
  if (!sessionId) return { ok: false, error: "no session id" };
  const bumpKey = `${sessionId}#bump`;

  // Idempotency — a row already stamped for this session's bump means we ran.
  const { data: existing } = await db
    .from("shop_orders")
    .select("id")
    .eq("stripe_session_id", bumpKey)
    .maybeSingle();
  if (existing) return { ok: true, skipped: true, bump, shopifyOrder: null };

  const shipping = normalizeShipping(session);
  const email = String(
    session.customer_details?.email || session.customer_email || ""
  )
    .trim()
    .toLowerCase();

  // Durable record for the /admin/shop manual queue (the `error` column doubles
  // as the operator ship-note; it clears when Shopify auto-creates the order).
  const { data: order } = await db
    .from("shop_orders")
    .insert({
      email: email || "unknown@unknown",
      customer_name: shipping.name || null,
      stripe_session_id: bumpKey,
      amount_total: cfg.cents,
      currency: session.currency || "usd",
      shipping: shipping as unknown as Record<string, unknown>,
      status: "paid",
      error: cfg.shipNote,
    })
    .select("id")
    .maybeSingle();

  // Attempt live Shopify fulfillment.
  let shopifyOrder: string | null = null;
  try {
    const shop = await createShopifyOrder({
      email: email || undefined,
      shipping,
      lineItems: cfg.variants,
      tags: `order-bump, ${cfg.crmTag}, stripe-paid`,
      note: `Cheat Code Club — order bump (${bump}) paid via Stripe.`,
    });
    if (shop.ok && shop.orderId && order?.id) {
      shopifyOrder = shop.orderName || shop.orderId;
      await db
        .from("shop_orders")
        .update({
          lulu_job_id: `shopify:${shopifyOrder}`,
          status: "submitted",
          error: null,
        })
        .eq("id", order.id);
    } else if (shop.error) {
      console.error("bump shopify order not created:", bump, shop.error);
    }
  } catch (e) {
    console.error("bump shopify order error:", e);
  }

  // CRM tag (best-effort).
  if (email) {
    try {
      const { data: lead } = await db
        .from("marketing_leads")
        .select("id, tags")
        .eq("email", email)
        .maybeSingle();
      if (lead) {
        const tags = Array.from(new Set([...(lead.tags || []), cfg.crmTag]));
        await db
          .from("marketing_leads")
          .update({ tags, updated_at: new Date().toISOString() })
          .eq("id", lead.id);
      }
    } catch (e) {
      console.error("bump crm tag error:", e);
    }
  }

  return { ok: true, bump, shopifyOrder };
}
