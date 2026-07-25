import { redirect } from "next/navigation";
import { cleanSrc, vipGateOpen, VIP_CANCEL_URL } from "@/lib/server/checkout-sessions";
import CheckoutClient from "@/components/checkout/CheckoutClient";

export const dynamic = "force-dynamic";

/**
 * /checkout/vip — the fully custom $197 Challenge VIP checkout. Reached from GET
 * /api/challenge/vip-checkout?src=… (the challenge page's "Go VIP" CTA). Hard-
 * gated behind app_settings.challenge_vip_enabled. The page owns the whole form;
 * Stripe's Payment Element renders only the card fields; the subscription (with a
 * 30-day trial + the $197 ticket on the first invoice) is created on submit and
 * confirmed inline.
 */
export default async function CheckoutVipPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  if (!(await vipGateOpen())) redirect(VIP_CANCEL_URL);

  const { src: rawSrc } = await searchParams;
  const src = cleanSrc(rawSrc) || "funnel";
  const publishableKey =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null;

  return (
    <CheckoutClient
      flow="vip"
      src={src}
      publishableKey={publishableKey}
      eyebrow="Challenge VIP"
      title="Claim your VIP ticket."
      subtitle="Everything in the 5-day challenge at VIP level — your printed textbook, your first month of Club, the private VIP room, and every session replay."
      backHref={VIP_CANCEL_URL}
      backLabel="Back to the challenge"
    />
  );
}
