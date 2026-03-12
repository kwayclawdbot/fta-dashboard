"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  X,
  Sparkles,
  ArrowRight,
  Crown,
} from "lucide-react";
import { createCheckoutUrl, PLANS } from "@/lib/stripe";

type Tier = "challenge" | "academy";

const features = [
  { label: "Trading Foundations Course", challenge: true, academy: true },
  { label: "5-Day Guided Challenge", challenge: true, academy: true },
  { label: "Community Access", challenge: true, academy: true },
  { label: "Basic Progress Tracking", challenge: true, academy: true },
  { label: "Email Support", challenge: true, academy: true },
  { label: "All Courses Unlocked", challenge: false, academy: true },
  { label: "Live Trading Sessions", challenge: false, academy: true },
  { label: "AI Trading Coach", challenge: false, academy: true },
  { label: "Family Management (up to 6)", challenge: false, academy: true },
  { label: "Advanced Progress & Badges", challenge: false, academy: true },
  { label: "Priority Support", challenge: false, academy: true },
  { label: "Lifetime Updates", challenge: false, academy: true },
];

export default function UpgradePage() {
  // Placeholder current plan
  const currentPlan: string = "free";
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);

  async function handleCheckout(tier: Tier) {
    setLoadingTier(tier);
    try {
      const url = await createCheckoutUrl(tier, "placeholder-family-id");
      if (url.startsWith("#")) {
        alert(`Checkout for ${PLANS[tier].name} will redirect to Stripe. (Placeholder)`);
      } else {
        window.location.href = url;
      }
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center mb-10"
      >
        <h2 className="font-display text-3xl font-bold text-midnight-100">
          Upgrade Your Academy
        </h2>
        <p className="text-midnight-400 text-sm mt-2 font-body max-w-lg mx-auto">
          Choose the plan that fits your family&apos;s goals. Invest in your
          family&apos;s financial education today.
        </p>
      </motion.div>

      {/* Plan Cards -- cards are appropriate here */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        {(["challenge", "academy"] as const).map((tier, i) => {
          const plan = PLANS[tier];
          const isCurrent = currentPlan === tier;
          const isAcademy = tier === "academy";

          return (
            <motion.div
              key={tier}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
              className={`relative rounded-xl p-6 border transition-colors ${
                isAcademy
                  ? "border-gold-400/30 bg-midnight-900/50"
                  : "border-midnight-700/40 bg-midnight-900/30"
              } ${isCurrent ? "ring-1 ring-gold-400" : ""}`}
            >
              {isAcademy && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-0.5 rounded-full bg-gold-400 text-midnight-950 text-[11px] font-display font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  Most Popular
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 right-4 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[11px] font-display font-bold">
                  <Crown className="w-3 h-3" />
                  Current
                </div>
              )}

              <div className="mb-5 pt-1">
                <h3 className="font-display text-lg font-bold text-midnight-100">
                  {plan.name}
                </h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold text-midnight-50">
                    ${plan.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-midnight-400 font-body">
                    {plan.period}
                  </span>
                </div>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Check className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                    <span className="text-midnight-200 font-body">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(tier)}
                disabled={isCurrent || loadingTier === tier}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold font-display transition-colors ${
                  isCurrent
                    ? "bg-midnight-800 border border-midnight-700 text-midnight-400 cursor-default"
                    : isAcademy
                      ? "cta-button"
                      : "bg-midnight-800 border border-midnight-700 text-midnight-200 hover:bg-midnight-700"
                }`}
              >
                {isCurrent
                  ? "Current Plan"
                  : loadingTier === tier
                    ? "Loading..."
                    : `Get ${plan.name}`}
                {!isCurrent && loadingTier !== tier && (
                  <ArrowRight className="w-4 h-4" />
                )}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Feature Comparison Table -- no glow, just subtle border */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="rounded-lg border border-midnight-700/40 overflow-hidden"
      >
        <div className="px-6 py-3 border-b border-midnight-800/50 bg-midnight-900/30">
          <h3 className="font-display text-sm font-semibold text-midnight-200">
            Feature Comparison
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-midnight-800/50">
                <th className="text-left px-6 py-2.5 text-xs font-display font-semibold text-midnight-400 uppercase tracking-wider">
                  Feature
                </th>
                <th className="text-center px-4 py-2.5 text-xs font-display font-semibold text-midnight-400 uppercase tracking-wider w-28">
                  Challenge
                </th>
                <th className="text-center px-4 py-2.5 text-xs font-display font-semibold text-gold-400 uppercase tracking-wider w-28">
                  Academy
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, i) => (
                <tr
                  key={feature.label}
                  className={i < features.length - 1 ? "border-b border-midnight-800/30" : ""}
                >
                  <td className="px-6 py-2.5 text-sm text-midnight-200 font-body">
                    {feature.label}
                  </td>
                  <td className="text-center px-4 py-2.5">
                    {feature.challenge ? (
                      <Check className="w-4 h-4 text-green-400 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-midnight-600 mx-auto" />
                    )}
                  </td>
                  <td className="text-center px-4 py-2.5">
                    {feature.academy ? (
                      <Check className="w-4 h-4 text-gold-400 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-midnight-600 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
