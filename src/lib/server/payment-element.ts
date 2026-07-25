import "server-only";
import {
  CLUB_MONTHLY_PRICE,
  VIP_TICKET_PRICE,
  VIP_TRIAL_DAYS,
  BUMP_PRICE,
} from "@/lib/server/checkout-sessions";
import type { BumpChoice, CheckoutFlow } from "@/lib/checkout-bumps";

/**
 * Custom-checkout backend (Payment Element flow). Instead of a Stripe-hosted /
 * embedded Checkout Session, WE own the form and Stripe only renders the
 * payment-method fields. On submit we create the subscription as
 * `default_incomplete` and hand the first invoice's PaymentIntent client_secret
 * back for the browser to confirm inline.
 *
 *   • CLUB — subscription on the $99/mo price, no trial. A physical order bump is
 *     added as a one-time `add_invoice_items` line on the first invoice.
 *   • VIP  — subscription on the $99/mo price with a 30-day trial PLUS the $197
 *     ticket (and optional kids-bundle bump) as `add_invoice_items` → $197(+bump)
 *     due now, $99/mo after the trial. save_default_payment_method=on_subscription
 *     saves the confirmed card as the sub default so the day-30 charge succeeds.
 *
 * Every subscription is stamped metadata.flow="pe" so the invoice.paid webhook
 * provisions ONLY these (the legacy hosted/embedded Checkout flows keep
 * provisioning via checkout.session.completed — no double-provision).
 *
 * Raw Stripe REST (no SDK), live account. Never throws — returns { error }.
 */

export const PE_FLOW = "pe";
const STRIPE = "https://api.stripe.com/v1";

export interface PeShipping {
  name?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface PeResult {
  clientSecret?: string;
  subscriptionId?: string;
  invoiceId?: string;
  amountDue?: number;
  customerId?: string;
  error?: string;
}

async function stripePost(
  sk: string,
  path: string,
  form: URLSearchParams
): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const res = await fetch(`${STRIPE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sk}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, json };
}

/** Find an existing customer by email (reuse) or create a fresh one. Sets/updates
 *  email, name, phone, and shipping (when a physical item is in the order). */
async function findOrCreateCustomer(
  sk: string,
  opts: { email: string; name?: string; phone?: string; shipping?: PeShipping }
): Promise<{ id?: string; error?: string }> {
  const form = new URLSearchParams();
  form.set("email", opts.email);
  if (opts.name) form.set("name", opts.name);
  if (opts.phone) form.set("phone", opts.phone);
  const sh = opts.shipping;
  if (sh && sh.line1) {
    form.set("shipping[name]", sh.name || opts.name || opts.email);
    if (sh.phone) form.set("shipping[phone]", sh.phone);
    form.set("shipping[address][line1]", sh.line1);
    if (sh.line2) form.set("shipping[address][line2]", sh.line2);
    if (sh.city) form.set("shipping[address][city]", sh.city);
    if (sh.state) form.set("shipping[address][state]", sh.state);
    if (sh.postal_code) form.set("shipping[address][postal_code]", sh.postal_code);
    if (sh.country) form.set("shipping[address][country]", sh.country);
    // Mirror onto the billing address so the PaymentElement can prefill.
    form.set("address[line1]", sh.line1);
    if (sh.city) form.set("address[city]", sh.city);
    if (sh.state) form.set("address[state]", sh.state);
    if (sh.postal_code) form.set("address[postal_code]", sh.postal_code);
    if (sh.country) form.set("address[country]", sh.country);
  }

  // Reuse an existing customer for this email if one exists.
  try {
    const res = await fetch(
      `${STRIPE}/customers?email=${encodeURIComponent(opts.email)}&limit=1`,
      { headers: { Authorization: `Bearer ${sk}` }, cache: "no-store" }
    );
    const list = (await res.json().catch(() => ({}))) as { data?: { id: string }[] };
    const existing = list.data?.[0]?.id;
    if (existing) {
      const upd = await stripePost(sk, `/customers/${existing}`, form);
      if (upd.ok) return { id: existing };
    }
  } catch {
    /* fall through to create */
  }

  const created = await stripePost(sk, "/customers", form);
  if (!created.ok) {
    return {
      error:
        (created.json.error as { message?: string })?.message || "customer create failed",
    };
  }
  return { id: String(created.json.id) };
}

function peError(json: Record<string, unknown>, fallback: string): string {
  return (json.error as { message?: string })?.message || fallback;
}

/** Extract the invoice's PaymentIntent client_secret from an expanded subscription. */
function extractInvoicePI(sub: Record<string, unknown>): {
  clientSecret?: string;
  invoiceId?: string;
  amountDue?: number;
} {
  const inv = sub.latest_invoice as Record<string, unknown> | undefined;
  if (!inv) return {};
  const pi = inv.payment_intent as Record<string, unknown> | undefined;
  return {
    clientSecret: pi?.client_secret ? String(pi.client_secret) : undefined,
    invoiceId: inv.id ? String(inv.id) : undefined,
    amountDue: typeof inv.amount_due === "number" ? inv.amount_due : undefined,
  };
}

interface CreateOpts {
  sk: string;
  flow: CheckoutFlow;
  src: string;
  bump: BumpChoice;
  email: string;
  name?: string;
  shipping?: PeShipping;
  /** Email-first OTO: attach the purchase to this already-created account. */
  userId?: string | null;
}

export async function createPaymentElementSubscription(
  opts: CreateOpts
): Promise<PeResult> {
  const { sk, flow, src, bump, email, name, shipping, userId } = opts;

  const cust = await findOrCreateCustomer(sk, {
    email,
    name,
    phone: shipping?.phone,
    shipping,
  });
  if (!cust.id) return { error: cust.error || "customer failed" };

  const form = new URLSearchParams();
  form.set("customer", cust.id);
  form.set("items[0][price]", CLUB_MONTHLY_PRICE);
  form.set("payment_behavior", "default_incomplete");
  form.set("payment_settings[save_default_payment_method]", "on_subscription");
  form.set("expand[0]", "latest_invoice.payment_intent");
  form.set("metadata[kind]", flow === "vip" ? "challenge_vip" : "club_membership");
  form.set("metadata[flow]", PE_FLOW);
  if (src) form.set("metadata[src]", src);
  if (bump && bump !== "none") form.set("metadata[bump]", bump);
  // Email-first OTO: stamp the account id so the invoice.paid webhook
  // (peSession → client_reference_id) lands the grant on the existing family.
  if (userId) form.set("metadata[user_id]", userId);

  // One-time add-invoice-items on the first invoice.
  let ai = 0;
  if (flow === "vip") {
    form.set("trial_period_days", String(VIP_TRIAL_DAYS));
    form.set(`add_invoice_items[${ai}][price]`, VIP_TICKET_PRICE);
    ai += 1;
  }
  if (bump && bump !== "none") {
    const bp = BUMP_PRICE[bump as keyof typeof BUMP_PRICE];
    if (bp) {
      form.set(`add_invoice_items[${ai}][price]`, bp);
      ai += 1;
    }
  }

  const { ok, json } = await stripePost(sk, "/subscriptions", form);
  if (!ok) {
    console.error("pe subscription error:", JSON.stringify(json).slice(0, 400));
    return { error: peError(json, "subscription create failed") };
  }

  const { clientSecret, invoiceId, amountDue } = extractInvoicePI(json);
  if (!clientSecret) {
    // A $0-due invoice (shouldn't happen — club charges now, vip has the $197
    // ticket) leaves no PI to confirm; surface an error rather than a dead form.
    console.error("pe subscription had no invoice PI:", JSON.stringify(json).slice(0, 300));
    return { error: "no payment due", subscriptionId: String(json.id) };
  }

  return {
    clientSecret,
    subscriptionId: String(json.id),
    invoiceId,
    amountDue,
    customerId: cust.id,
  };
}

/** Best-effort cleanup of an unconfirmed subscription (verification / abandoned). */
export async function cancelIncompleteSubscription(sk: string, subId: string) {
  try {
    await fetch(`${STRIPE}/subscriptions/${subId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sk}` },
    });
  } catch {
    /* best-effort */
  }
}
