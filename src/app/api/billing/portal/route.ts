import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * BILLING MANAGEMENT (B10) — the door out.
 *
 * The app could take a member's $99/mo and then offered them nowhere to change
 * a card, read an invoice or cancel. The only "Manage billing" link on /upgrade
 * pointed at the Club PAYMENT LINK, which starts a second subscription rather
 * than managing the first one. This route is the real door: Stripe's own
 * Customer Portal, opened for the family's existing customer.
 *
 *   GET  → { available }   Can this member open a portal? No Stripe call, so
 *                          the page can render the row's correct state on load
 *                          instead of finding out on click.
 *   POST → { url }         A one-time portal session. 409 { reason:"no_customer" }
 *                          when the family has no Stripe customer on file.
 *
 * NOTHING COMMERCIAL LIVES HERE. No price, no product, no checkout session —
 * the portal's contents are configured in the Stripe Dashboard. This route
 * cannot create, change or cancel a subscription; it only issues the link.
 *
 * WHY THE ADMIN CLIENT FOR ONE COLUMN: `families.stripe_customer_id` is a
 * billing identifier and is not (and should not become) readable through RLS by
 * every household member. The user is authenticated first, their family is read
 * from THEIR OWN profile row, and the service-role read is scoped to that one
 * family id. The customer id never leaves the server.
 *
 * Children never reach billing — the same rule /upgrade enforces.
 */

interface Resolved {
  customerId: string | null;
  /** A response to return immediately, if the caller is not eligible at all. */
  refusal: NextResponse | null;
}

async function resolveCustomer(): Promise<Resolved> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      customerId: null,
      refusal: NextResponse.json({ error: "Not signed in." }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, family_id")
    .eq("id", user.id)
    .single();

  if (profile?.role === "child") {
    return {
      customerId: null,
      refusal: NextResponse.json({ error: "Not available." }, { status: 403 }),
    };
  }
  if (!profile?.family_id) return { customerId: null, refusal: null };

  const admin = createAdminClient();
  const { data: family } = await admin
    .from("families")
    .select("stripe_customer_id")
    .eq("id", profile.family_id)
    .maybeSingle();

  const raw = (family?.stripe_customer_id || "").trim();
  return { customerId: raw || null, refusal: null };
}

/** Is there a portal to open? Answered without touching Stripe. */
export async function GET() {
  const { customerId, refusal } = await resolveCustomer();
  if (refusal) return refusal;
  return NextResponse.json({ available: customerId != null });
}

export async function POST(req: NextRequest) {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 500 });
  }

  const { customerId, refusal } = await resolveCustomer();
  if (refusal) return refusal;
  if (!customerId) {
    // Not an error the member caused — the surface has a designed state for it.
    return NextResponse.json(
      { error: "No billing account on file.", reason: "no_customer" },
      { status: 409 }
    );
  }

  // WHERE STRIPE SENDS THEM BACK. The portal is opened from two places now —
  // /upgrade and the MEMBERSHIP block in /settings — and dumping a member who
  // came from Settings onto the sales page is a worse landing than the one they
  // left. The caller may name its own return path; anything that isn't a plain
  // same-origin path is ignored (open-redirect guard), and the default stays
  // /settings, which is where a paying parent goes looking for billing.
  const body = (await req.json().catch(() => null)) as { returnTo?: unknown } | null;
  const asked = typeof body?.returnTo === "string" ? body.returnTo : "";
  const returnTo =
    asked.startsWith("/") && !asked.startsWith("//") ? asked : "/settings";

  const form = new URLSearchParams();
  form.set("customer", customerId);
  form.set("return_url", new URL(returnTo, req.nextUrl.origin).toString());

  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sk}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: { message?: string };
  };

  if (!res.ok || !json.url) {
    return NextResponse.json(
      { error: json.error?.message || "stripe error" },
      { status: 502 }
    );
  }
  return NextResponse.json({ url: json.url });
}
