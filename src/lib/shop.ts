/**
 * Shared shop types + formatting helpers. CLIENT-SAFE — no secrets, no service
 * role. Used by the public storefront, the admin console, and the API routes.
 */

export type ShopAudience = "kids" | "teens" | "adults" | "family";
export type ShopKind =
  | "textbook"
  | "guidebook"
  | "workbook"
  | "lesson_plans"
  | "teacher_guide"
  | "bundle";
export type ShopOrderStatus =
  | "paid"
  | "submitted"
  | "in_production"
  | "shipped"
  | "canceled"
  | "fulfillment_error";

export interface ShopProduct {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  audience: ShopAudience | null;
  kind: ShopKind | null;
  price_cents: number;
  compare_at_cents: number | null;
  cover_image_path: string | null;
  gallery: string[];
  lulu_pod_package_id: string | null;
  interior_pdf_path: string | null;
  cover_pdf_path: string | null;
  page_count: number | null;
  active: boolean;
  sort: number;
  created_at?: string;
  updated_at?: string;
}

export interface ShopOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_cents: number;
  product?: Pick<ShopProduct, "slug" | "title" | "kind"> | null;
}

export interface ShopOrder {
  id: string;
  email: string;
  customer_name: string | null;
  stripe_session_id: string;
  amount_total: number | null;
  currency: string;
  shipping: Record<string, unknown> | null;
  status: ShopOrderStatus;
  lulu_job_id: string | null;
  lulu_status: Record<string, unknown> | null;
  tracking: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  items?: ShopOrderItem[];
}

export const PRODUCT_SELECT =
  "id, slug, title, subtitle, description, audience, kind, price_cents, compare_at_cents, cover_image_path, gallery, lulu_pod_package_id, interior_pdf_path, cover_pdf_path, page_count, active, sort";

export const AUDIENCE_LABELS: Record<ShopAudience, string> = {
  kids: "Kids",
  teens: "Teens",
  adults: "Adults",
  family: "Family",
};

export const KIND_LABELS: Record<ShopKind, string> = {
  textbook: "Textbook",
  guidebook: "Guidebook",
  workbook: "Workbook",
  lesson_plans: "Lesson Plans",
  teacher_guide: "Parent-Teacher Guide",
  bundle: "Bundle",
};

export const ORDER_STATUS_LABELS: Record<ShopOrderStatus, string> = {
  paid: "Paid",
  submitted: "Submitted to Lulu",
  in_production: "In production",
  shipped: "Shipped",
  canceled: "Canceled",
  fulfillment_error: "Fulfillment error",
};

/** The sentinel we write to shop_orders.error when Lulu isn't wired up yet. */
export const AWAITING_FULFILLMENT = "awaiting_fulfillment_setup";

export function formatUsd(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

/**
 * IS THIS THING FOR SALE? `active` says a row exists; it does not say the row
 * is finished. "The Investing Textbook" is the live example — it is the
 * Challenge fulfilment record (see lib/server/challenge-vip.ts), which needs to
 * stay on disk under its slug, but it carries `price_cents = 0` and no cover,
 * so the storefront rendered it as a grey "No cover" tile priced at $0. A free
 * book with no picture, sitting between two $49 guides, reads as a broken shop.
 *
 * A product reaches the storefront only when it has BOTH a real price and a
 * cover. Anything short of that is a record, not an offer — the row is
 * untouched, it simply isn't listed or reachable at /shop/<slug>.
 */
export function isListable(
  p: Pick<ShopProduct, "price_cents" | "cover_image_path">
): boolean {
  return p.price_cents > 0 && !!p.cover_image_path?.trim();
}

export function savingsCents(p: Pick<ShopProduct, "price_cents" | "compare_at_cents">): number {
  if (p.compare_at_cents == null) return 0;
  return Math.max(0, p.compare_at_cents - p.price_cents);
}

export function savingsPct(p: Pick<ShopProduct, "price_cents" | "compare_at_cents">): number {
  if (!p.compare_at_cents || p.compare_at_cents <= 0) return 0;
  return Math.round((savingsCents(p) / p.compare_at_cents) * 100);
}

/**
 * Split a product description into a lead paragraph + "what's inside" bullets.
 * We encode bullets as lines beginning with "- " (seed convention), so the
 * product page can render a clean prose + list layout without an extra column.
 */
export function parseDescription(description: string | null | undefined): {
  lead: string;
  bullets: string[];
} {
  if (!description) return { lead: "", bullets: [] };
  const lines = description.split("\n");
  const lead: string[] = [];
  const bullets: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("- ")) bullets.push(line.slice(2).trim());
    else lead.push(line);
  }
  return { lead: lead.join(" "), bullets };
}

/** A cover path can be a repo-static path (/shop/x.svg) or a full URL. */
export function coverSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  return path;
}
