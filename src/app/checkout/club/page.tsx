import { cleanSrc, CLUB_CANCEL_URL } from "@/lib/server/checkout-sessions";
import CheckoutClient from "@/components/checkout/CheckoutClient";
import { publicMode } from "@/lib/experience/server";

export const dynamic = "force-dynamic";

/**
 * /checkout/club — the fully custom $99/mo Cheat Code Club membership checkout.
 * Reached from GET /api/club/checkout?src=… (the marketing site's "Join the Club"
 * CTAs). The page owns the entire form; Stripe's Payment Element renders only the
 * card fields. The subscription + PaymentIntent are created on submit
 * (POST /api/checkout/confirm) and confirmed inline — no hosted/embedded page.
 */
export default async function CheckoutClubPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  const { src: rawSrc } = await searchParams;
  const src = cleanSrc(rawSrc) || "site";
  const mode = await publicMode();
  const publishableKey =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || null;

  return (
    <CheckoutClient
      mode={mode}
      flow="club"
      src={src}
      publishableKey={publishableKey}
      eyebrow="Join the Club"
      title="You're one step from the Club."
      subtitle="Set up your $99/mo membership — the member network, the insights, and the tools, with your whole family included on one membership."
      backHref={CLUB_CANCEL_URL}
      backLabel="Back to pricing"
    />
  );
}
