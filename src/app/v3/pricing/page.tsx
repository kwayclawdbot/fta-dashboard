import { getPricingViewModel } from "@/ui-v3/onboard-data";
import PricingScreen from "@/ui-v3/components/onboard/PricingScreen";

/**
 * /v3/pricing — "11 Pricing".
 *
 * NO auth guard: pricing is the one onboarding screen both a visitor and a
 * signed-in member have a reason to see (the board's own ✕ implies it opens
 * over something). The only member-specific value is where ✕ returns to.
 *
 * The CTA is a plain link to GET /api/club/checkout, which is the STABLE public
 * checkout contract the marketing site already points at — the same entry point,
 * carrying this screen as its attribution.
 */
export const dynamic = "force-dynamic";

export default async function V3PricingPage() {
  const model = await getPricingViewModel();
  return <PricingScreen model={model} />;
}
