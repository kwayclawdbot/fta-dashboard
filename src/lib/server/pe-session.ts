import "server-only";
import { PE_FLOW } from "@/lib/server/payment-element";

/**
 * Bridge the Payment Element flow back onto the existing session-shaped
 * provisioning. The custom checkout creates a subscription (default_incomplete)
 * whose first invoice is paid inline — so provisioning now triggers on
 * `invoice.paid` (+ a `payment_intent.succeeded` fallback), NOT
 * checkout.session.completed. This helper reconstructs a Checkout-Session-shaped
 * object from an invoice so provisionClubMembership / provisionChallengeVip /
 * fulfillOrderBump run UNCHANGED, keyed on the subscription id for idempotency.
 *
 * Only subscriptions stamped metadata.flow="pe" are handled here — the legacy
 * hosted/embedded Checkout subscriptions keep provisioning via their session
 * event, so nothing double-provisions.
 */

const STRIPE = "https://api.stripe.com/v1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = Record<string, any>;

async function get(sk: string, path: string): Promise<Any | null> {
  try {
    const res = await fetch(`${STRIPE}${path}`, {
      headers: { Authorization: `Bearer ${sk}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Any;
  } catch {
    return null;
  }
}

/** Given a PaymentIntent, return its invoice id (subscription invoices only). */
export function invoiceIdFromPaymentIntent(pi: Any): string | null {
  return typeof pi?.invoice === "string" ? pi.invoice : null;
}

/**
 * Build a session-shaped object from a subscription-invoice. `invoice` may be the
 * raw webhook object (has customer + subscription ids). Returns null when it's not
 * a Payment-Element subscription (flow!=pe) or can't be resolved.
 */
export async function peSessionFromInvoice(
  sk: string,
  invoice: Any
): Promise<Any | null> {
  const subId =
    typeof invoice?.subscription === "string" ? invoice.subscription : null;
  if (!subId) return null;

  const sub = await get(sk, `/subscriptions/${subId}`);
  if (!sub) return null;
  if (sub.metadata?.flow !== PE_FLOW) return null; // legacy flow — not ours

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : typeof sub.customer === "string"
      ? sub.customer
      : null;
  const customer = customerId ? await get(sk, `/customers/${customerId}`) : null;

  const email = String(
    invoice.customer_email || customer?.email || ""
  ).trim().toLowerCase();
  const name = customer?.shipping?.name || customer?.name || "";
  const phone = customer?.shipping?.phone || customer?.phone || "";
  const shippingAddr = customer?.shipping?.address || customer?.address || null;

  return {
    id: subId, // idempotency key (stable across invoice + PI-fallback events)
    object: "pe_session",
    customer: customerId,
    customer_email: email || undefined,
    customer_details: {
      email: email || undefined,
      name: name || undefined,
      phone: phone || undefined,
      address: shippingAddr || undefined,
    },
    // normalizeShipping() reads this first for physical fulfillment.
    shipping_details: shippingAddr
      ? { name: name || undefined, phone: phone || undefined, address: shippingAddr }
      : undefined,
    subscription: subId,
    client_reference_id: sub.metadata?.user_id || null,
    amount_total:
      typeof invoice.amount_paid === "number"
        ? invoice.amount_paid
        : typeof invoice.amount_due === "number"
        ? invoice.amount_due
        : null,
    currency: invoice.currency || "usd",
    metadata: {
      kind: sub.metadata?.kind,
      src: sub.metadata?.src,
      bump: sub.metadata?.bump,
      door: sub.metadata?.door,
      flow: sub.metadata?.flow,
      user_id: sub.metadata?.user_id,
    },
  };
}

/** Build a session from a PaymentIntent (fallback path) by resolving its invoice. */
export async function peSessionFromPaymentIntent(
  sk: string,
  pi: Any
): Promise<Any | null> {
  const invId = invoiceIdFromPaymentIntent(pi);
  if (!invId) return null;
  const invoice = await get(sk, `/invoices/${invId}`);
  if (!invoice) return null;
  return peSessionFromInvoice(sk, invoice);
}
