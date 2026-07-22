/**
 * Lulu Print API v1 integration — SERVER ONLY. OAuth2 client-credentials, then
 * POST /print-jobs/ to submit a print-on-demand order.
 *
 * Degrades gracefully: if creds are absent (LULU_CLIENT_KEY / LULU_CLIENT_SECRET)
 * the caller treats the order as "awaiting fulfillment setup" and leaves it
 * status='paid' for the admin to submit manually once Lulu is wired up.
 *
 * Base URL defaults to the SANDBOX until the owner supplies production creds.
 */
import type { ShopOrderStatus } from "@/lib/shop";

const LULU_BASE = (process.env.LULU_API_BASE || "https://api.sandbox.lulu.com").replace(/\/$/, "");
const CLIENT_KEY = process.env.LULU_CLIENT_KEY || "";
const CLIENT_SECRET = process.env.LULU_CLIENT_SECRET || "";

export function luluConfigured(): boolean {
  return Boolean(CLIENT_KEY && CLIENT_SECRET);
}

export interface LuluShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state_code?: string;
  postcode: string;
  country_code: string;
  phone_number?: string;
  email?: string;
}

export interface LuluLineItem {
  pod_package_id: string;
  interior_source_url: string;
  cover_source_url: string;
  quantity: number;
  title: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) return cachedToken.token;

  const basic = Buffer.from(`${CLIENT_KEY}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(
    `${LULU_BASE}/auth/realms/glasstree/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`lulu auth failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ? json.expires_in * 1000 : 3600_000),
  };
  return cachedToken.token;
}

export interface CreatePrintJobResult {
  id: string;
  status: string;
  raw: unknown;
}

/**
 * Create a Lulu print job. Throws on any HTTP/network error — the caller flips
 * the order to 'fulfillment_error' and stores the message.
 */
export async function createPrintJob(opts: {
  contactEmail: string;
  externalId?: string;
  shipping: LuluShippingAddress;
  lineItems: LuluLineItem[];
  shippingLevel?: string;
}): Promise<CreatePrintJobResult> {
  const token = await getToken();
  const body = {
    contact_email: opts.contactEmail,
    external_id: opts.externalId,
    line_items: opts.lineItems.map((li) => ({
      pod_package_id: li.pod_package_id,
      quantity: li.quantity,
      title: li.title,
      printable_normalization: {
        interior: { source_url: li.interior_source_url },
        cover: { source_url: li.cover_source_url },
      },
    })),
    shipping_address: {
      name: opts.shipping.name,
      street1: opts.shipping.street1,
      street2: opts.shipping.street2 || undefined,
      city: opts.shipping.city,
      state_code: opts.shipping.state_code || undefined,
      postcode: opts.shipping.postcode,
      country_code: opts.shipping.country_code,
      phone_number: opts.shipping.phone_number || undefined,
      email: opts.shipping.email || opts.contactEmail,
    },
    shipping_level: opts.shippingLevel || "MAIL",
  };

  const res = await fetch(`${LULU_BASE}/print-jobs/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `lulu print-job failed (${res.status}): ${JSON.stringify(json).slice(0, 500)}`
    );
  }
  return {
    id: String((json as { id?: string | number }).id ?? ""),
    status: (json as { status?: { name?: string } }).status?.name ?? "CREATED",
    raw: json,
  };
}

export async function getPrintJob(id: string): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${LULU_BASE}/print-jobs/${id}/`, {
    headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`lulu status failed (${res.status}): ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

/** Map a Lulu print-job status name onto our internal order status. */
export function mapLuluStatus(luluName: string | undefined | null): ShopOrderStatus {
  switch ((luluName || "").toUpperCase()) {
    case "SHIPPED":
      return "shipped";
    case "IN_PRODUCTION":
    case "PRODUCTION_READY":
    case "PRODUCTION_DELAYED":
      return "in_production";
    case "CANCELED":
    case "REJECTED":
      return "canceled";
    case "ERROR":
      return "fulfillment_error";
    default:
      // CREATED / UNPAID / PAYMENT_IN_PROGRESS / etc.
      return "submitted";
  }
}

export const LULU_API_BASE = LULU_BASE;
