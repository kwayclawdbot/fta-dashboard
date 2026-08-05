import { NextRequest, NextResponse } from "next/server";
import { vipGateOpen, cleanSrc } from "@/lib/server/checkout-sessions";
import {
  createPaymentElementSubscription,
  type PeShipping,
} from "@/lib/server/payment-element";
import { verifyContinuationToken } from "@/lib/server/challenge-token";
import { bumpNeedsShipping } from "@/lib/checkout-bumps";
import type { BumpChoice, CheckoutFlow } from "@/lib/checkout-bumps";
import { EXPERIENCE_HEADER, parseExperience } from "@/lib/experience/registry";

export const dynamic = "force-dynamic";

/**
 * Custom-checkout confirm endpoint (Payment Element flow). Called on "Pay" after
 * elements.submit() validates. Creates the default_incomplete subscription for
 * the selected flow + bump and returns the first invoice's PaymentIntent
 * client_secret for the browser to confirm inline. No charge happens until the
 * browser confirms the returned client_secret.
 *
 * Body: { flow, src, bump, email, name?, shipping? } → { clientSecret,
 * subscriptionId, amount } | { error }
 */

const VALID_BUMPS: Record<CheckoutFlow, BumpChoice[]> = {
  club: ["none", "textbook", "parents_bundle"],
  vip: ["none", "kids_bundle"],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return NextResponse.json({ error: "stripe not configured" }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    flow?: string;
    src?: string;
    bump?: string;
    email?: string;
    name?: string;
    shipping?: PeShipping;
    token?: string;
  };

  const flow = (body.flow === "vip" ? "vip" : "club") as CheckoutFlow;
  const src = cleanSrc(body.src) || (flow === "vip" ? "funnel" : "site");
  const requested = (body.bump || "none") as BumpChoice;
  const bump = VALID_BUMPS[flow].includes(requested) ? requested : "none";

  // Email-first OTO continuation token — server-trusted. When present it fixes
  // the email + attaches the purchase to the already-created account (we never
  // trust a client-supplied email/userId to attach to an account).
  const cont = body.token ? verifyContinuationToken(body.token) : null;
  const email = (cont?.email || body.email || "").trim().toLowerCase();
  const userId = cont?.userId || null;
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }

  if (flow === "vip" && !(await vipGateOpen())) {
    return NextResponse.json({ error: "VIP tickets aren't open yet." }, { status: 403 });
  }

  // Physical items (VIP always ships a textbook; club ships only with a bump)
  // require a shipping address.
  const needsShipping = flow === "vip" || bumpNeedsShipping(bump);
  const shipping = body.shipping;
  if (needsShipping) {
    const a = shipping || {};
    if (!a.line1 || !a.city || !a.postal_code || !a.country) {
      return NextResponse.json(
        { error: "Please complete your shipping address." },
        { status: 400 }
      );
    }
  }

  const result = await createPaymentElementSubscription({
    sk,
    flow,
    src,
    bump,
    email,
    name: body.name?.trim() || shipping?.name?.trim(),
    shipping: needsShipping ? shipping : undefined,
    userId,
    door: parseExperience(req.headers.get(EXPERIENCE_HEADER)) ?? undefined,
  });

  if (result.error || !result.clientSecret) {
    return NextResponse.json(
      { error: result.error || "Could not start payment." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    clientSecret: result.clientSecret,
    subscriptionId: result.subscriptionId,
    amount: result.amountDue,
  });
}
