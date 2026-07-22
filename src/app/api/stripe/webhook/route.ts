import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { provisionMembership } from "@/lib/server/membership";

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

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });
  const payload = await req.text();
  if (!verify(payload, req.headers.get("stripe-signature"), secret))
    return NextResponse.json({ error: "bad signature" }, { status: 400 });

  const event = JSON.parse(payload);
  if (event.type === "checkout.session.completed") {
    const s = event.data?.object ?? {};
    // Shop (physical book) purchases are handled by /api/shop/webhook — never
    // provision a membership for them. Stripe fans every event to every
    // endpoint, so guard by our metadata tag before any provisioning.
    if (s.metadata?.kind === "shop") {
      return NextResponse.json({ received: true, skipped: "shop" });
    }
    const email: string | undefined =
      s.customer_details?.email || s.customer_email;
    if (email) {
      const result = await provisionMembership({
        email,
        program: programFor(s.amount_total),
        source: "stripe",
        stripeSession: s.id,
      });
      if (!result.ok) {
        console.error("stripe provision failed:", result.error);
        return NextResponse.json({ error: "provision failed" }, { status: 500 });
      }
    }
  }
  return NextResponse.json({ received: true });
}
