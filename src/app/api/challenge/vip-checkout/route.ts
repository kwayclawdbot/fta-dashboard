import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyContinuationToken } from "@/lib/server/challenge-token";

export const dynamic = "force-dynamic";

/**
 * Challenge VIP ticket ($197) checkout (Lane C9 → guest-checkout rework).
 *
 * TWO entry points, one shared Stripe config:
 *
 *   GET  /api/challenge/vip-checkout?src=funnel   — GUEST (unauthenticated).
 *        The marketing site's "Go VIP" CTA points straight here; we build a
 *        Stripe-hosted Checkout Session and 302 the browser to it. No account is
 *        required up front — Stripe collects the email + shipping, and the
 *        webhook (provisionChallengeVip) creates the account after payment.
 *
 *   POST /api/challenge/vip-checkout                — AUTHED (in-app upsell).
 *        The thank-you upsell for an already-registered challenger. Carries
 *        client_reference_id = the app user id so the webhook links straight to
 *        their existing family, and returns JSON { url } for a client redirect.
 *
 * Stripe structure (owner-ratified, verified live): subscription mode on the
 * Club $99/mo price with a 30-day trial (first month of Club included), PLUS the
 * $197 VIP ticket as a one-time second line item → $197 due today, $99/mo after
 * the trial. (The one-time price must be a second line_item — Stripe rejects
 * subscription_data.add_invoice_items on Checkout Sessions.) metadata.kind=
 * challenge_vip routes it to provisionChallengeVip; metadata.src carries funnel
 * attribution. Shipping address is collected for the textbook. Uses the raw
 * Stripe REST API (no SDK), same as the shop lane, on the live account.
 *
 * Hard-gated behind app_settings.challenge_vip_enabled until the owner verifies.
 */

// Live catalog objects (Lane C9, created via the Stripe API):
//   Club $99/mo recurring price (existing FIC monthly).
const CLUB_MONTHLY_PRICE =
  process.env.CLUB_MONTHLY_PRICE_ID?.trim() || "price_1TuZg8F7Tbc3pSvJta0lUeVY";
//   Challenge VIP Ticket — $197 one-time (product prod_Ux0oQiDQ2IlkKT).
const VIP_TICKET_PRICE =
  process.env.VIP_TICKET_PRICE_ID?.trim() || "price_1Tx6n7F7Tbc3pSvJpgrwi2Nu";
const TRIAL_DAYS = 30;

// Where a cancelled Checkout returns the guest — the marketing site's tickets
// section. TODO(cheatcode.com): once the club site moves to its own domain,
// point this at https://cheatcode.com/challenge/#tickets.
const CANCEL_URL = "https://cheatcode-club.vercel.app/challenge/#tickets";

async function vipGateOpen(): Promise<boolean> {
  const admin = createAdminClient();
  const { data: gate } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "challenge_vip_enabled")
    .maybeSingle();
  return gate?.value === true;
}

/**
 * Build the VIP Checkout Session against the live Stripe API. `userId`/`email`
 * are set for the authed upsell path and left blank for guest checkout (Stripe
 * collects the email itself). Returns { url } on success or { error } on failure.
 */
async function createVipSession(opts: {
  sk: string;
  origin: string;
  src: string;
  userId?: string | null;
  email?: string | null;
}): Promise<{ url?: string; error?: string }> {
  const { sk, origin, src, userId, email } = opts;

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  // Recurring Club membership — trialed for the first month.
  form.set("line_items[0][price]", CLUB_MONTHLY_PRICE);
  form.set("line_items[0][quantity]", "1");
  // One-time $197 VIP ticket — charged today on the first invoice.
  form.set("line_items[1][price]", VIP_TICKET_PRICE);
  form.set("line_items[1][quantity]", "1");
  form.set("subscription_data[trial_period_days]", String(TRIAL_DAYS));
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
  form.set(
    "success_url",
    `${origin}/challenge/vip-success?session_id={CHECKOUT_SESSION_ID}`
  );
  form.set("cancel_url", CANCEL_URL);

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
    return {
      error:
        (json as { error?: { message?: string } }).error?.message || "stripe error",
    };
  }
  return { url: (json as { url: string }).url };
}

function cleanSrc(raw: string | null | undefined): string {
  return (raw || "").trim().slice(0, 64);
}

/**
 * GET — guest checkout. 302 → Stripe. This is where the marketing site's "Go
 * VIP" button lands (?src=funnel). No auth. If the gate is closed or Stripe
 * errors, bounce back to the tickets section rather than showing a raw error.
 */
export async function GET(req: NextRequest) {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return NextResponse.redirect(CANCEL_URL, 302);

  if (!(await vipGateOpen())) return NextResponse.redirect(CANCEL_URL, 302);

  const src = cleanSrc(req.nextUrl.searchParams.get("src")) || "funnel";

  // Email-first OTO hand-off (C9b): a continuation token (?t=) prefills the
  // buyer's email + links the checkout to their already-created account, so the
  // webhook lands the VIP grant on the existing family. No token ⇒ plain guest.
  const cont = verifyContinuationToken(req.nextUrl.searchParams.get("t") || "");

  const { url, error } = await createVipSession({
    sk,
    origin: req.nextUrl.origin,
    src,
    userId: cont?.userId ?? null,
    email: cont?.email ?? null,
  });
  if (error || !url) return NextResponse.redirect(CANCEL_URL, 302);
  return NextResponse.redirect(url, 302);
}

/**
 * POST — authed in-app upsell. Returns JSON { url } for a client redirect. Keeps
 * client_reference_id = user id so the webhook links to the existing family.
 */
export async function POST(req: NextRequest) {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return NextResponse.json({ error: "stripe not configured" }, { status: 500 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (!(await vipGateOpen())) {
    return NextResponse.json(
      { error: "not_available", message: "VIP tickets aren't open yet — check back soon." },
      { status: 403 }
    );
  }

  let src = "";
  try {
    const body = (await req.json().catch(() => ({}))) as { src?: string };
    src = cleanSrc(body?.src);
  } catch {
    /* no body — fine */
  }
  if (!src) src = "thankyou_upsell";

  const { url, error } = await createVipSession({
    sk,
    origin: req.nextUrl.origin,
    src,
    userId: user.id,
    email: (user.email || "").trim().toLowerCase(),
  });
  if (error || !url) {
    return NextResponse.json({ error: error || "stripe error" }, { status: 502 });
  }
  return NextResponse.json({ url });
}
