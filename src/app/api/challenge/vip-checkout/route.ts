import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createVipCheckoutSession,
  vipGateOpen,
  cleanSrc,
  VIP_CANCEL_URL,
} from "@/lib/server/checkout-sessions";

export const dynamic = "force-dynamic";

/**
 * Challenge VIP ticket ($197) checkout entry point. The marketing site's "Go VIP"
 * CTA points straight at GET /api/challenge/vip-checkout?src=funnel — a STABLE
 * public contract that must not change.
 *
 * Checkout is now CUSTOM-BRANDED via Stripe Embedded Checkout rendered inside our
 * own /checkout/vip page (VIP-TICKET Cheat Code Club shell). So:
 *
 *   GET  ?src=funnel            — GUEST. 302 → /checkout/vip?src=… (the page
 *        server-creates the embedded session + renders the ticket shell).
 *   GET  ?src=funnel&fallback=1 — FALLBACK. Create a HOSTED session and 302 to
 *        checkout.stripe.com (the "Continue to secure checkout" escape hatch).
 *   POST                         — AUTHED in-app upsell. Returns JSON { url }
 *        (hosted) for a client redirect; client_reference_id = user id. Unchanged.
 *
 * Stripe structure (Club $99/mo + 30d trial + one-time $197 ticket, shipping +
 * phone collection, metadata.kind=challenge_vip) is shared with the page via
 * src/lib/server/checkout-sessions.ts — webhook/provisioning untouched.
 *
 * Hard-gated behind app_settings.challenge_vip_enabled until the owner verifies.
 */

/**
 * GET — guest entry. Gate-checked. Default: bounce to the branded /checkout/vip
 * page. With ?fallback=1: create a hosted session and 302 to Stripe.
 */
export async function GET(req: NextRequest) {
  if (!(await vipGateOpen())) return NextResponse.redirect(VIP_CANCEL_URL, 302);

  const src = cleanSrc(req.nextUrl.searchParams.get("src")) || "funnel";
  const fallback = req.nextUrl.searchParams.get("fallback") === "1";

  if (!fallback) {
    const dest = new URL("/checkout/vip", req.nextUrl.origin);
    dest.searchParams.set("src", src);
    return NextResponse.redirect(dest, 302);
  }

  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return NextResponse.redirect(VIP_CANCEL_URL, 302);
  const rawBump = req.nextUrl.searchParams.get("bump");
  const bump = rawBump === "kids_bundle" ? rawBump : "none";
  const { url, error } = await createVipCheckoutSession({
    sk,
    origin: req.nextUrl.origin,
    src,
    uiMode: "hosted",
    bump,
  });
  if (error || !url) return NextResponse.redirect(VIP_CANCEL_URL, 302);
  return NextResponse.redirect(url, 302);
}

/**
 * POST — authed in-app upsell. Returns JSON { url } (hosted) for a client
 * redirect. Keeps client_reference_id = user id so the webhook links to the
 * existing family.
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

  const { url, error } = await createVipCheckoutSession({
    sk,
    origin: req.nextUrl.origin,
    src,
    uiMode: "hosted",
    userId: user.id,
    email: (user.email || "").trim().toLowerCase(),
  });
  if (error || !url) {
    return NextResponse.json({ error: error || "stripe error" }, { status: 502 });
  }
  return NextResponse.json({ url });
}
