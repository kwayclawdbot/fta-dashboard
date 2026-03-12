/**
 * Stripe checkout integration.
 * Phase 1: returns placeholder URLs.
 * Phase 2: will call backend API to create real Stripe Checkout sessions.
 */

export async function createCheckoutUrl(
  tier: "challenge" | "academy",
  familyId: string
): Promise<string> {
  // TODO: call backend API to create Stripe Checkout session
  // const data = await apiFetch('/api/v1/checkout', {
  //   method: 'POST',
  //   body: JSON.stringify({ tier, family_id: familyId }),
  // });
  // return data.checkout_url;

  console.log(`[Stripe] Creating checkout for tier=${tier}, familyId=${familyId}`);
  return `#checkout-placeholder-${tier}`;
}

export const PLANS = {
  challenge: {
    name: "5-Day Challenge",
    price: 97,
    period: "one-time",
    features: [
      "Trading Foundations course",
      "5-day guided challenge",
      "Community access",
      "Basic progress tracking",
      "Email support",
    ],
  },
  academy: {
    name: "Full Academy",
    price: 4997,
    period: "one-time",
    features: [
      "All courses unlocked",
      "Live trading sessions",
      "AI trading coach",
      "Family management (up to 6)",
      "Advanced progress & badges",
      "Priority support",
      "Lifetime updates",
    ],
  },
} as const;
