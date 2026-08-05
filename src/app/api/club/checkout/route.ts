import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createClubCheckoutSession,
  cleanSrc,
  CLUB_CANCEL_URL,
} from "@/lib/server/checkout-sessions";
import { EXPERIENCE_HEADER, parseExperience } from "@/lib/experience/registry";

export const dynamic = "force-dynamic";

/**
 * Cheat Code Club $99/mo membership checkout entry point. The marketing site's
 * "Join the Club" CTAs point straight at GET /api/club/checkout?src=<attribution>
 * — this is a STABLE public contract and must not change.
 *
 * Checkout is now CUSTOM-BRANDED via Stripe Embedded Checkout rendered inside our
 * own /checkout/club page (warm-cream Cheat Code Club shell). So:
 *
 *   GET /api/club/checkout?src=<attr>            — GUEST. 302 → /checkout/club?src=…
 *        (the page server-creates the embedded session + renders the shell).
 *
 *   GET /api/club/checkout?src=<attr>&fallback=1 — FALLBACK. Create a Stripe-HOSTED
 *        session and 302 straight to checkout.stripe.com. This is the "Continue to
 *        secure checkout" escape hatch used when the embed can't mount client-side
 *        (script blocked / old browser) — never a dead end.
 *
 *   POST /api/club/checkout                       — AUTHED in-app upgrade. Returns
 *        JSON { url } (hosted) for a client redirect; carries client_reference_id =
 *        the app user id so the webhook links to the existing family. Unchanged.
 *
 * Stripe config (price, metadata.kind=club_membership, no trial) is shared with the
 * page via src/lib/server/checkout-sessions.ts — webhook/provisioning untouched.
 */

/**
 * GET — guest entry. Default: bounce to the branded /checkout/club page. With
 * ?fallback=1: create a hosted session and 302 to Stripe (the embed escape hatch).
 */
export async function GET(req: NextRequest) {
  const src = cleanSrc(req.nextUrl.searchParams.get("src")) || "site";
  const fallback = req.nextUrl.searchParams.get("fallback") === "1";

  if (!fallback) {
    const dest = new URL("/checkout/club", req.nextUrl.origin);
    dest.searchParams.set("src", src);
    return NextResponse.redirect(dest, 302);
  }

  // Fallback: hosted Stripe redirect (bump-aware so the escape hatch matches).
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return NextResponse.redirect(CLUB_CANCEL_URL, 302);
  const rawBump = req.nextUrl.searchParams.get("bump");
  const bump = rawBump === "textbook" || rawBump === "parents_bundle" ? rawBump : "none";
  const { url, error } = await createClubCheckoutSession({
    sk,
    door: parseExperience(req.headers.get(EXPERIENCE_HEADER)) ?? undefined,
    origin: req.nextUrl.origin,
    src,
    uiMode: "hosted",
    bump,
  });
  if (error || !url) return NextResponse.redirect(CLUB_CANCEL_URL, 302);
  return NextResponse.redirect(url, 302);
}

/**
 * POST — authed in-app upgrade. Returns JSON { url } (hosted) for a client
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

  let src = "";
  try {
    const body = (await req.json().catch(() => ({}))) as { src?: string };
    src = cleanSrc(body?.src);
  } catch {
    /* no body — fine */
  }
  if (!src) src = "in_app_upgrade";

  const { url, error } = await createClubCheckoutSession({
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
