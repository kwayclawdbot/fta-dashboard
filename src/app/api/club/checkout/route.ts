import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Cheat Code Club $99/mo membership checkout — the marketing site's "Join the
 * Club" CTAs point straight here.
 *
 * TWO entry points, one shared Stripe config:
 *
 *   GET  /api/club/checkout?src=<attribution>   — GUEST (unauthenticated).
 *        The marketing-site button lands here; we build a Stripe-hosted Checkout
 *        Session and 302 the browser to it. No account required up front — Stripe
 *        collects the email, and the webhook (provisionClubMembership) provisions
 *        the $99 membership + creates/links the account after payment.
 *
 *   POST /api/club/checkout                      — AUTHED (in-app upgrade).
 *        For an already-registered visitor who wants to add Club; carries
 *        client_reference_id = the app user id and returns JSON { url } for a
 *        client redirect. Additive — the existing FIC_CHECKOUT_URL payment-link
 *        upgrade paths keep working untouched.
 *
 * Stripe structure: subscription mode on the live Club $99/mo recurring price,
 * NO trial, email collected by Stripe. metadata.kind=club_membership routes the
 * webhook to provisionClubMembership; metadata.src carries attribution. Uses the
 * raw Stripe REST API (no SDK), same as the shop / VIP lanes, on the live account.
 */

// Live Club $99/mo recurring price (existing FIC monthly).
const CLUB_MONTHLY_PRICE =
  process.env.CLUB_MONTHLY_PRICE_ID?.trim() || "price_1TuZg8F7Tbc3pSvJta0lUeVY";

// Where a cancelled Checkout returns the guest — the marketing site's pricing.
// TODO(cheatcode.com): once the club site moves to its own domain, point this at
// https://cheatcode.com/pricing/.
const CANCEL_URL = "https://cheatcode-club.vercel.app/pricing/";

function cleanSrc(raw: string | null | undefined): string {
  return (raw || "").trim().slice(0, 64);
}

/**
 * Do we have any active promotion codes? Only then do we surface the promo-code
 * field at Checkout (an empty promo field is just friction / a support magnet).
 * Best-effort — any error → no field.
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

/**
 * Build the Club Checkout Session against the live Stripe API. `userId`/`email`
 * are set for the authed upgrade path and left blank for guest checkout (Stripe
 * collects the email itself). Returns { url } on success or { error } on failure.
 */
async function createClubSession(opts: {
  sk: string;
  origin: string;
  src: string;
  userId?: string | null;
  email?: string | null;
}): Promise<{ url?: string; error?: string }> {
  const { sk, origin, src, userId, email } = opts;

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  // Recurring Club membership — NO trial, $99/mo from day one.
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
  if (await hasActivePromoCodes(sk)) form.set("allow_promotion_codes", "true");
  form.set(
    "success_url",
    `${origin}/club/welcome?session_id={CHECKOUT_SESSION_ID}`
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
    console.error("club checkout stripe error:", JSON.stringify(json).slice(0, 400));
    return {
      error:
        (json as { error?: { message?: string } }).error?.message || "stripe error",
    };
  }
  return { url: (json as { url: string }).url };
}

/**
 * GET — guest checkout. 302 → Stripe. This is where the marketing site's "Join
 * the Club" button lands (?src=<attribution>). No auth. If Stripe errors, bounce
 * back to the pricing page rather than showing a raw error.
 */
export async function GET(req: NextRequest) {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return NextResponse.redirect(CANCEL_URL, 302);

  const src = cleanSrc(req.nextUrl.searchParams.get("src")) || "site";
  const { url, error } = await createClubSession({
    sk,
    origin: req.nextUrl.origin,
    src,
  });
  if (error || !url) return NextResponse.redirect(CANCEL_URL, 302);
  return NextResponse.redirect(url, 302);
}

/**
 * POST — authed in-app upgrade. Returns JSON { url } for a client redirect. Keeps
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

  let src = "";
  try {
    const body = (await req.json().catch(() => ({}))) as { src?: string };
    src = cleanSrc(body?.src);
  } catch {
    /* no body — fine */
  }
  if (!src) src = "in_app_upgrade";

  const { url, error } = await createClubSession({
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
