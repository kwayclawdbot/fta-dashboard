import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BumpChoice } from "@/lib/checkout-bumps";
import { bumpNeedsShipping } from "@/lib/checkout-bumps";

/**
 * Shared Stripe Checkout Session builders for the two Cheat Code Club money flows:
 *
 *   • Club        — $99/mo subscription, NO trial.
 *   • Challenge VIP — $99/mo subscription + 30-day trial + a one-time $197 VIP
 *                     ticket line item (→ $197 today, $99/mo after), with
 *                     shipping + phone collection for the textbook.
 *
 * Both flows now render inside our OWN designed checkout pages (/checkout/club,
 * /checkout/vip) via Stripe **Embedded Checkout** (`ui_mode=embedded`). The page
 * server-creates an embedded session and hands the `client_secret` to the
 * client, which mounts <EmbeddedCheckout> inside the branded shell.
 *
 * A `hosted` mode is kept for the graceful FALLBACK path (embed blocked/old
 * browser) and the authed in-app upgrade/upsell — identical session config, but
 * Stripe-hosted redirect (`url`) with success/cancel URLs.
 *
 * IMPORTANT — the Stripe config (prices, metadata kinds, trial, shipping/phone
 * collection, return/success URLs) is IDENTICAL to the pre-embed routes so the
 * webhook + provisioning (provisionClubMembership / provisionChallengeVip) are
 * untouched. Uses the raw Stripe REST API (no SDK), same as the shop lane, on
 * the live account.
 *
 * NOTE on branding: Stripe Checkout (hosted AND embedded) takes its in-form
 * branding (accent colour, logo, font) from the Dashboard branding settings —
 * there is NO per-session `appearance` API for Checkout Sessions (that exists
 * only for the custom Payment Element). So the branded SHELL around the embed is
 * what makes the page read as ours; the payment module inherits Dashboard brand.
 */

// Live Club $99/mo recurring price (existing FIC monthly).
export const CLUB_MONTHLY_PRICE =
  process.env.CLUB_MONTHLY_PRICE_ID?.trim() || "price_1TuZg8F7Tbc3pSvJta0lUeVY";
// Challenge VIP Ticket — $197 one-time (product prod_Ux0oQiDQ2IlkKT).
export const VIP_TICKET_PRICE =
  process.env.VIP_TICKET_PRICE_ID?.trim() || "price_1Tx6n7F7Tbc3pSvJpgrwi2Nu";
export const VIP_TRIAL_DAYS = 30;

// Marketing-site cancel destinations (hosted mode only).
// TODO(cheatcode.com): repoint to the club domain once DNS moves.
export const CLUB_CANCEL_URL = "https://cheatcode-club.vercel.app/pricing/";
export const VIP_CANCEL_URL = "https://cheatcode-club.vercel.app/challenge/#tickets";

// Live one-time order-bump prices (created via the Stripe API, metadata
// kind=order_bump). Env-overridable; defaults are the live ids.
export const BUMP_PRICE: Record<
  "textbook" | "parents_bundle" | "kids_bundle",
  string
> = {
  textbook:
    process.env.BUMP_TEXTBOOK_PRICE_ID?.trim() ||
    "price_1Tx9SLF7Tbc3pSvJJ42b0nBV", // $119
  parents_bundle:
    process.env.BUMP_PARENTS_BUNDLE_PRICE_ID?.trim() ||
    "price_1Tx9SNF7Tbc3pSvJ3VBsga3H", // $297
  kids_bundle:
    process.env.BUMP_KIDS_BUNDLE_PRICE_ID?.trim() ||
    "price_1Tx9TgF7Tbc3pSvJGROIb3Rk", // $97
};

export type UiMode = "embedded" | "hosted";

export interface SessionResult {
  /** Embedded mode — hand to <EmbeddedCheckoutProvider options={{clientSecret}}>. */
  clientSecret?: string;
  /** Hosted mode — 302 the browser here. */
  url?: string;
  /** Stripe session id (for expiring test sessions / debugging). */
  id?: string;
  error?: string;
}

export function cleanSrc(raw: string | null | undefined): string {
  return (raw || "").trim().slice(0, 64);
}

/**
 * VIP checkout is hard-gated behind app_settings.challenge_vip_enabled until the
 * owner flips it on. Both the GET entry point and the /checkout/vip page check
 * this so the flow can't be reached early.
 */
export async function vipGateOpen(): Promise<boolean> {
  const admin = createAdminClient();
  const { data: gate } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "challenge_vip_enabled")
    .maybeSingle();
  return gate?.value === true;
}

/**
 * Do we have any active promotion codes? Only then surface the promo-code field
 * (an empty promo field is just friction / a support magnet). Best-effort.
 */
async function hasActivePromoCodes(sk: string): Promise<boolean> {
  try {
    const res = await fetch(
      "https://api.stripe.com/v1/promotion_codes?active=true&limit=1",
      { headers: { Authorization: `Bearer ${sk}` }, cache: "no-store" }
    );
    if (!res.ok) return false;
    const json = (await res.json()) as { data?: unknown[] };
    return Array.isArray(json.data) && json.data.length > 0;
  } catch {
    return false;
  }
}

async function postSession(
  sk: string,
  form: URLSearchParams,
  label: string
): Promise<SessionResult> {
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sk}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    client_secret?: string;
    url?: string;
    id?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    console.error(`${label} stripe error:`, JSON.stringify(json).slice(0, 400));
    return { error: json.error?.message || "stripe error" };
  }
  return { clientSecret: json.client_secret, url: json.url, id: json.id };
}

/**
 * Apply the ui_mode-specific redirect wiring. Embedded uses `return_url`
 * (where Stripe sends the browser after the in-page payment completes); hosted
 * uses success/cancel URLs for the full-page redirect.
 */
function applyMode(
  form: URLSearchParams,
  opts: { uiMode: UiMode; origin: string; returnPath: string; cancelUrl: string }
) {
  const { uiMode, origin, returnPath, cancelUrl } = opts;
  if (uiMode === "embedded") {
    form.set("ui_mode", "embedded");
    form.set("return_url", `${origin}${returnPath}?session_id={CHECKOUT_SESSION_ID}`);
  } else {
    form.set("success_url", `${origin}${returnPath}?session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", cancelUrl);
  }
}

export interface CreateOpts {
  sk: string;
  origin: string;
  src: string;
  uiMode: UiMode;
  userId?: string | null;
  email?: string | null;
  /** Selected one-time order bump, if any. */
  bump?: BumpChoice;
}

/**
 * Append a selected order bump as an extra one-time line item, record it in
 * session metadata (metadata.bump — read by fulfillment), and turn on shipping +
 * phone collection for the physical book if the base flow doesn't already. Any
 * unknown/none bump is a no-op. `nextIndex` is the next free line_items slot.
 */
function appendBump(
  form: URLSearchParams,
  bump: BumpChoice | undefined,
  nextIndex: number,
  opts: { baseCollectsShipping: boolean }
) {
  if (!bump || bump === "none") return;
  const price = BUMP_PRICE[bump as keyof typeof BUMP_PRICE];
  if (!price) return;
  form.set(`line_items[${nextIndex}][price]`, price);
  form.set(`line_items[${nextIndex}][quantity]`, "1");
  form.set("metadata[bump]", bump);
  form.set("subscription_data[metadata][bump]", bump);
  if (!opts.baseCollectsShipping && bumpNeedsShipping(bump)) {
    form.set("shipping_address_collection[allowed_countries][0]", "US");
    form.set("shipping_address_collection[allowed_countries][1]", "CA");
    form.set("phone_number_collection[enabled]", "true");
  }
}

/**
 * Club $99/mo membership session — subscription mode, NO trial. Returns
 * { clientSecret } (embedded) or { url } (hosted). `userId`/`email` are set for
 * the authed in-app upgrade and left blank for guest checkout.
 */
export async function createClubCheckoutSession(
  opts: CreateOpts
): Promise<SessionResult> {
  const { sk, origin, src, userId, email, uiMode } = opts;

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("line_items[0][price]", CLUB_MONTHLY_PRICE);
  form.set("line_items[0][quantity]", "1");
  form.set("subscription_data[metadata][kind]", "club_membership");
  if (src) form.set("subscription_data[metadata][src]", src);
  if (userId) form.set("subscription_data[metadata][user_id]", userId);
  form.set("metadata[kind]", "club_membership");
  if (src) form.set("metadata[src]", src);
  if (userId) {
    form.set("client_reference_id", userId);
    form.set("metadata[user_id]", userId);
  }
  if (email) form.set("customer_email", email);
  // Promo codes only when a bump isn't present (an added physical line item and
  // a promo field together is checkout clutter; keep the base flow's promo UX).
  if (!opts.bump || opts.bump === "none") {
    if (await hasActivePromoCodes(sk)) form.set("allow_promotion_codes", "true");
  }

  appendBump(form, opts.bump, 1, { baseCollectsShipping: false });

  applyMode(form, {
    uiMode,
    origin,
    returnPath: "/club/welcome",
    cancelUrl: CLUB_CANCEL_URL,
  });

  return postSession(sk, form, "club checkout");
}

/**
 * Challenge VIP session — subscription (Club $99/mo, trialed 30d) PLUS a one-time
 * $197 VIP ticket line item → $197 due today, $99/mo after. Shipping + phone
 * collected for the textbook. Returns { clientSecret } (embedded) or { url }.
 */
export async function createVipCheckoutSession(
  opts: CreateOpts
): Promise<SessionResult> {
  const { sk, origin, src, userId, email, uiMode } = opts;

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  // Recurring Club membership — trialed for the first month.
  form.set("line_items[0][price]", CLUB_MONTHLY_PRICE);
  form.set("line_items[0][quantity]", "1");
  // One-time $197 VIP ticket — charged today on the first invoice.
  form.set("line_items[1][price]", VIP_TICKET_PRICE);
  form.set("line_items[1][quantity]", "1");
  form.set("subscription_data[trial_period_days]", String(VIP_TRIAL_DAYS));
  form.set("subscription_data[metadata][kind]", "challenge_vip");
  if (src) form.set("subscription_data[metadata][src]", src);
  if (userId) form.set("subscription_data[metadata][user_id]", userId);
  form.set("metadata[kind]", "challenge_vip");
  if (src) form.set("metadata[src]", src);
  if (userId) {
    form.set("client_reference_id", userId);
    form.set("metadata[user_id]", userId);
  }
  if (email) form.set("customer_email", email);
  form.set("shipping_address_collection[allowed_countries][0]", "US");
  form.set("shipping_address_collection[allowed_countries][1]", "CA");
  form.set("phone_number_collection[enabled]", "true");

  // VIP base already collects shipping; bump is a 3rd line item ([0] Club sub,
  // [1] $197 ticket, [2] bump).
  appendBump(form, opts.bump, 2, { baseCollectsShipping: true });

  applyMode(form, {
    uiMode,
    origin,
    returnPath: "/challenge/vip-success",
    cancelUrl: VIP_CANCEL_URL,
  });

  return postSession(sk, form, "vip checkout");
}
