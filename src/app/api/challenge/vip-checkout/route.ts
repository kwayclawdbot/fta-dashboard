import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyContinuationToken } from "@/lib/server/challenge-token";
import {
  createVipCheckoutSession,
  vipGateOpen,
  cleanSrc,
  VIP_CANCEL_URL,
} from "@/lib/server/checkout-sessions";
import { EXPERIENCE_HEADER, parseExperience } from "@/lib/experience/registry";

export const dynamic = "force-dynamic";

/**
 * Challenge VIP ticket ($197) checkout entry point. The marketing site's "Go VIP"
 * CTA (and the email-first OTO at /free-class/vip-offer) point straight at GET
 * /api/challenge/vip-checkout?src=funnel[&t=<token>] — a STABLE public contract.
 *
 * Checkout is now CUSTOM-BRANDED via a Payment Element form on our own
 * /checkout/vip page (Stripe renders only the card fields). So:
 *
 *   GET  ?src=funnel[&t=…]      — GUEST/EMAIL-FIRST. 302 → /checkout/vip?src=…[&t=…].
 *        The continuation token (?t=) is passed through OPAQUELY (HMAC — no raw
 *        email in the URL); the page verifies it server-side to prefill the
 *        buyer's email and attach the purchase to their already-created account.
 *   GET  ?…&fallback=1          — FALLBACK. Create a HOSTED Checkout session and
 *        302 to Stripe (the escape hatch when the custom form can't mount). The
 *        token's userId/email ride along so the hosted session still links.
 *   POST                         — AUTHED in-app upsell. Returns JSON { url }
 *        (hosted) for a client redirect; client_reference_id = user id.
 *
 * Hard-gated behind app_settings.challenge_vip_enabled until the owner verifies.
 */

/**
 * GET — guest/email-first entry. Gate-checked. Default: bounce to the branded
 * /checkout/vip page (threading ?t= through). With ?fallback=1: create a hosted
 * session (bump- and token-aware) and 302 to Stripe.
 */
export async function GET(req: NextRequest) {
  if (!(await vipGateOpen())) return NextResponse.redirect(VIP_CANCEL_URL, 302);

  const src = cleanSrc(req.nextUrl.searchParams.get("src")) || "funnel";
  const token = req.nextUrl.searchParams.get("t") || "";
  const fallback = req.nextUrl.searchParams.get("fallback") === "1";

  if (!fallback) {
    const dest = new URL("/checkout/vip", req.nextUrl.origin);
    dest.searchParams.set("src", src);
    if (token) dest.searchParams.set("t", token); // opaque continuation token
    return NextResponse.redirect(dest, 302);
  }

  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return NextResponse.redirect(VIP_CANCEL_URL, 302);
  // Email-first OTO hand-off (C9b): a continuation token prefills the email +
  // links the hosted session to the already-created account.
  const cont = verifyContinuationToken(token);
  const rawBump = req.nextUrl.searchParams.get("bump");
  const bump = rawBump === "kids_bundle" ? rawBump : "none";
  const { url, error } = await createVipCheckoutSession({
    sk,
    door: parseExperience(req.headers.get(EXPERIENCE_HEADER)) ?? undefined,
    origin: req.nextUrl.origin,
    src,
    uiMode: "hosted",
    bump,
    userId: cont?.userId ?? null,
    email: cont?.email ?? null,
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
    door: parseExperience(req.headers.get(EXPERIENCE_HEADER)) ?? undefined,
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
