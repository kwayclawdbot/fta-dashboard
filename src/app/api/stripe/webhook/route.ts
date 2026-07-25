import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { provisionMembership } from "@/lib/server/membership";
import { provisionChallengeVip } from "@/lib/server/challenge-vip";
import { provisionClubMembership } from "@/lib/server/club-membership";
import {
  peSessionFromInvoice,
  peSessionFromPaymentIntent,
} from "@/lib/server/pe-session";

/**
 * Stripe checkout.session.completed → provision membership + send the
 * create-account email. Signature verified manually (no stripe sdk needed).
 */
function verify(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=") as [string, string])
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 600) return false; // 10 min tolerance
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${payload}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

// FIC $99.00 / FTA $2,997.00 — mapped by checkout total (cents).
function programFor(amountTotal: number | null | undefined): "fic" | "fta" {
  return amountTotal != null && amountTotal >= 100000 ? "fta" : "fic";
}

/**
 * Route a reconstructed Payment-Element session to the same provisioning as the
 * legacy Checkout flows (both call idempotent provisioners, now keyed on the
 * subscription id). Only flow=pe sessions reach here (peSession* returns null
 * otherwise), so legacy subscriptions' invoice.paid events are ignored — they
 * provision via checkout.session.completed and never double-fire.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dispatchPeProvision(session: any): Promise<void> {
  const kind = session?.metadata?.kind;
  if (kind === "challenge_vip") {
    const r = await provisionChallengeVip(session);
    if (!r.ok) console.error("pe challenge_vip provision failed:", r.error);
  } else if (kind === "club_membership") {
    const r = await provisionClubMembership(session);
    if (!r.ok) console.error("pe club provision failed:", r.error);
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });
  const payload = await req.text();
  if (!verify(payload, req.headers.get("stripe-signature"), secret))
    return NextResponse.json({ error: "bad signature" }, { status: 400 });

  const event = JSON.parse(payload);

  // ── Payment Element (custom checkout) flow ──────────────────────────────────
  // These subscriptions are paid via an inline invoice PaymentIntent, so
  // provisioning triggers on invoice.paid (primary) + payment_intent.succeeded
  // (fallback), keyed on the subscription id. peSession* returns null for legacy
  // (non-pe) subscriptions so those are left to checkout.session.completed.
  if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
    const sk = process.env.STRIPE_SECRET_KEY;
    if (sk) {
      const session = await peSessionFromInvoice(sk, event.data?.object ?? {});
      if (session) await dispatchPeProvision(session);
    }
    return NextResponse.json({ received: true });
  }
  if (event.type === "payment_intent.succeeded") {
    const sk = process.env.STRIPE_SECRET_KEY;
    const pi = event.data?.object ?? {};
    if (sk && pi.invoice) {
      const session = await peSessionFromPaymentIntent(sk, pi);
      if (session) await dispatchPeProvision(session);
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data?.object ?? {};
    // Shop (physical book) purchases are handled by /api/shop/webhook — never
    // provision a membership for them. Stripe fans every event to every
    // endpoint, so guard by our metadata tag before any provisioning.
    if (s.metadata?.kind === "shop") {
      return NextResponse.json({ received: true, skipped: "shop" });
    }
    // Challenge VIP ticket ($197, Lane C9): tier=vip marker + Club (fic)
    // enrollment + textbook order + VIP emails. Its own handler; never falls
    // through to the generic amount-mapped membership provisioning below.
    if (s.metadata?.kind === "challenge_vip") {
      const result = await provisionChallengeVip(s);
      if (!result.ok) {
        console.error("challenge_vip provision failed:", result.error);
        return NextResponse.json({ error: "vip provision failed" }, { status: 500 });
      }
      return NextResponse.json({ received: true, vip: result.vipId, created: result.created });
    }
    // Cheat Code Club $99/mo membership (marketing-site guest checkout): explicit
    // kind branch so a subscription-mode Club session provisions the $99 membership
    // + creates/links the account + CRM. Session-idempotent (keyed on stripe_session
    // in pending_memberships) so it never double-provisions with the /club/welcome
    // safety-net, a Stripe retry, or the legacy amount-mapped payment-link path.
    if (s.metadata?.kind === "club_membership") {
      const result = await provisionClubMembership(s);
      if (!result.ok) {
        console.error("club_membership provision failed:", result.error);
        return NextResponse.json({ error: "club provision failed" }, { status: 500 });
      }
      return NextResponse.json({ received: true, club: true, created: result.created });
    }
    const email: string | undefined =
      s.customer_details?.email || s.customer_email;
    if (email) {
      // FTA — Challenge Offer ($1,500): metadata kind=fta_challenge. Grants the
      // FTA tier (superset of Club via TIER_ACCESS) FOR LIFE, plus a 12-month
      // Club window stamped onto enrollments.club_until (migration 127). After
      // the year the family stays tier 'fta' but club_lapsed strips Club-level
      // surfaces to free while FTA academy access stays forever; paying $99/mo
      // (a fic enrollment) restores full Club. ONLY fta_challenge gets the clock
      // — every regular fta ($2,997) / fic buyer keeps club_until NULL =
      // unlimited. Any other checkout maps by amount ($99 → fic, ≥$1,000 → fta).
      const isChallenge = s.metadata?.kind === "fta_challenge";
      const program: "fic" | "fta" = isChallenge
        ? "fta"
        : programFor(s.amount_total);
      const result = await provisionMembership({
        email,
        program,
        source: "stripe",
        stripeSession: s.id,
        clubMonths: isChallenge ? 12 : undefined,
      });
      if (!result.ok) {
        console.error("stripe provision failed:", result.error);
        return NextResponse.json({ error: "provision failed" }, { status: 500 });
      }
    }
  }
  return NextResponse.json({ received: true });
}
