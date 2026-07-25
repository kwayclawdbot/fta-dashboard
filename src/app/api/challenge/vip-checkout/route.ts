import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/challenge/vip-checkout → a Stripe Checkout Session for the $197
 * Challenge VIP ticket (Lane C9). Auth required: the buyer must be a registered
 * app user (the funnel registers first, then pays here at the thank-you), so the
 * session carries client_reference_id = the app user id for the webhook to link.
 *
 * Structure (owner-ratified): subscription mode on the Club $99/mo price with a
 * 30-day trial (first month included), plus a one-time $197 VIP line via
 * add_invoice_items = "$197 today, then $99/mo after 30 days". metadata.kind=
 * challenge_vip routes it to provisionChallengeVip in the webhook. Shipping
 * address is collected for the textbook.
 *
 *   NOTE: the exact today-vs-day-30 split of add_invoice_items under a trial
 *   must be confirmed with a Stripe TEST-mode checkout before going live — this
 *   endpoint stays hard-gated behind app_settings.challenge_vip_enabled (default
 *   false) until then. Uses the raw Stripe REST API (no SDK), same as the shop
 *   lane, on the live account.
 */

// Live catalog objects (Lane C9, created via the Stripe API):
//   Club $99/mo recurring price (existing FIC monthly).
const CLUB_MONTHLY_PRICE =
  process.env.CLUB_MONTHLY_PRICE_ID?.trim() || "price_1TuZg8F7Tbc3pSvJta0lUeVY";
//   Challenge VIP Ticket — $197 one-time (product prod_Ux0oQiDQ2IlkKT).
const VIP_TICKET_PRICE =
  process.env.VIP_TICKET_PRICE_ID?.trim() || "price_1Tx6n7F7Tbc3pSvJpgrwi2Nu";
const TRIAL_DAYS = 30;

export async function POST(req: NextRequest) {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return NextResponse.json({ error: "stripe not configured" }, { status: 500 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // HARD GATE — the live VIP checkout path is off until the owner verifies a
  // test-mode checkout and flips this flag.
  const admin = createAdminClient();
  const { data: gate } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "challenge_vip_enabled")
    .maybeSingle();
  if (gate?.value !== true) {
    return NextResponse.json(
      { error: "not_available", message: "VIP tickets aren't open yet — check back soon." },
      { status: 403 }
    );
  }

  const origin = req.nextUrl.origin;
  const email = (user.email || "").trim().toLowerCase();

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("line_items[0][price]", CLUB_MONTHLY_PRICE);
  form.set("line_items[0][quantity]", "1");
  form.set("subscription_data[trial_period_days]", String(TRIAL_DAYS));
  form.set("subscription_data[add_invoice_items][0][price]", VIP_TICKET_PRICE);
  form.set("subscription_data[add_invoice_items][0][quantity]", "1");
  form.set("subscription_data[metadata][kind]", "challenge_vip");
  form.set("subscription_data[metadata][user_id]", user.id);
  form.set("client_reference_id", user.id);
  if (email) form.set("customer_email", email);
  form.set("metadata[kind]", "challenge_vip");
  form.set("metadata[user_id]", user.id);
  form.set("shipping_address_collection[allowed_countries][0]", "US");
  form.set("shipping_address_collection[allowed_countries][1]", "CA");
  form.set("phone_number_collection[enabled]", "true");
  form.set("success_url", `${origin}/free-class/challenge?vip=paid`);
  form.set("cancel_url", `${origin}/free-class/challenge`);

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
    console.error("vip checkout stripe error:", JSON.stringify(json).slice(0, 400));
    return NextResponse.json(
      { error: (json as { error?: { message?: string } }).error?.message || "stripe error" },
      { status: 502 }
    );
  }
  return NextResponse.json({ url: (json as { url: string }).url, id: (json as { id: string }).id });
}
