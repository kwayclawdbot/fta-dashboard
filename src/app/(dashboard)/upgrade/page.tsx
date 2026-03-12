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

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
};

export default function UpgradePage() {
  // Placeholder current plan
  const currentPlan: string = "free";
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);

  async function handleCheckout(tier: Tier) {
    setLoadingTier(tier);
    try {
      const url = await createCheckoutUrl(tier, "placeholder-family-id");
      if (url.startsWith("#")) {
        // Placeholder — just show it works
        alert(`Checkout for ${PLANS[tier].name} will redirect to Stripe. (Placeholder)`);
      } else {
        window.location.href = url;
      }
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <h2 className="font-display text-3xl font-bold text-midnight-100">
          Upgrade Your <span className="text-gradient-gold">Academy</span>
        </h2>
        <p className="text-midnight-400 text-sm mt-2 font-body max-w-lg mx-auto">
          Choose the plan that fits your family&apos;s goals. Invest in your
          family&apos;s financial education today.
        </p>
      </motion.div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(["challenge", "academy"] as const).map((tier, i) => {
          const plan = PLANS[tier];
          const isCurrent = currentPlan === tier;
          const isAcademy = tier === "academy";

          return (
            <motion.div
              key={tier}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ y: -6 }}
              className={`relative rounded-2xl p-6 transition-all ${
                isAcademy
                  ? "glow-border-strong bg-midnight-900/80"
                  : "glow-border bg-midnight-900/60"
              } ${isCurrent ? "ring-2 ring-gold-400" : ""}`}
            >
              {isAcademy && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-1 rounded-full bg-gold-400 text-midnight-950 text-xs font-display font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  Most Popular
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 right-4 flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-display font-bold">
                  <Crown className="w-3 h-3" />
                  Current Plan
                </div>
              )}

              <div className="mb-6 pt-2">
                <h3 className="font-display text-xl font-bold text-midnight-100">
                  {plan.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold text-gradient-gold">
                    ${plan.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-midnight-400 font-body">
                    {plan.period}
                  </span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <div className="w-5 h-5 rounded-full bg-gold-400/10 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-gold-400" />
                    </div>
                    <span className="text-midnight-200 font-body">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCheckout(tier)}
                disabled={isCurrent || loadingTier === tier}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold font-display uppercase tracking-wider transition-all ${
                  isCurrent
                    ? "bg-midnight-800 border border-midnight-600 text-midnight-400 cursor-default"
                    : isAcademy
                      ? "cta-button"
                      : "bg-midnight-800 border border-gold-400/30 text-gold-400 hover:bg-gold-400/10"
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
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="glow-border rounded-2xl bg-midnight-900/60 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gold-400/10">
          <h3 className="font-display text-lg font-bold text-midnight-100">
            Feature Comparison
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-midnight-700">
                <th className="text-left px-6 py-3 text-sm font-display font-semibold text-midnight-300">
                  Feature
                </th>
                <th className="text-center px-4 py-3 text-sm font-display font-semibold text-midnight-300 w-32">
                  Challenge
                </th>
                <th className="text-center px-4 py-3 text-sm font-display font-semibold text-gold-400 w-32">
                  Academy
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, i) => (
                <tr
                  key={feature.label}
                  className={`border-b border-midnight-800/50 ${
                    i % 2 === 0 ? "bg-midnight-900/30" : ""
                  }`}
                >
                  <td className="px-6 py-3 text-sm text-midnight-200 font-body">
                    {feature.label}
                  </td>
                  <td className="text-center px-4 py-3">
                    {feature.challenge ? (
                      <Check className="w-4 h-4 text-green-400 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-midnight-600 mx-auto" />
                    )}
                  </td>
                  <td className="text-center px-4 py-3">
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
