"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ArrowRight, Sparkles, Users, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const FIC_URL = "https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a";
const FTA_URL = "https://buy.stripe.com/9B6aEXdbt9pH2Sw8hlbEA0b";

const PROGRAMS = [
  {
    key: "fic",
    name: "Family Investing Club",
    price: "$99",
    period: "/month",
    icon: Users,
    url: FIC_URL,
    featured: false,
    blurb:
      "The foundations library for the whole family. Kids, teens, and adults each get their own track.",
    features: [
      "Full foundations course library",
      "Kids, teens, and adult tracks",
      "Daily 5 flashcards and practice games",
      "Family progress, XP, and badges",
      "Community access",
    ],
  },
  {
    key: "fta",
    name: "FTA Trade Ready",
    price: "$2,997",
    period: "6-week cohort",
    icon: GraduationCap,
    url: FTA_URL,
    featured: true,
    blurb:
      "The live 6-week program that takes a beginner to trade ready — and includes Family Investing Club access.",
    features: [
      "Everything in Family Investing Club",
      "6 weeks of live classes and drills",
      "Weekly execution playbook",
      "Trading simulator and pattern practice",
      "Coach feedback and live Q&A",
    ],
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const supabase = createClient();

  // Billing is parent-only — children never see upgrade/billing.
  useEffect(() => {
    async function guard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role === "child") router.replace("/dashboard");
    }
    guard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center mb-10"
      >
        <h1 className="font-display text-3xl font-bold text-ink">
          Choose your program
        </h1>
        <p className="text-soft text-sm mt-2 max-w-lg mx-auto">
          Start with the Family Investing Club, or go all in with the FTA
          Trade Ready cohort. Both put the whole family on the same page.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        {PROGRAMS.map((p, i) => {
          const Icon = p.icon;
          return (
            <motion.div
              key={p.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`relative paper-card p-6 flex flex-col ${
                p.featured ? "ring-2 ring-gold-400" : ""
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-0.5 rounded-full bg-gold-500 text-white text-[11px] font-display font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  Go all in
                </div>
              )}

              <div className="w-11 h-11 rounded-xl bg-chip-amber text-gold-800 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5" />
              </div>

              <h2 className="font-display text-lg font-bold text-ink">
                {p.name}
              </h2>
              <div className="mt-1 mb-3 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold text-ink">
                  {p.price}
                </span>
                <span className="text-sm text-soft">{p.period}</span>
              </div>
              <p className="text-sm text-soft leading-relaxed mb-4">{p.blurb}</p>

              <ul className="space-y-2.5 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
                    <span className="text-midnight-200">{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-bold transition-colors ${
                  p.featured
                    ? "cta-button"
                    : "border border-sand text-ink hover:bg-paper"
                }`}
              >
                Get {p.name}
                <ArrowRight className="w-4 h-4" />
              </a>
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-xs text-soft max-w-lg mx-auto">
        Checkout opens securely with Stripe in a new tab. During the beta,
        enrollment is activated on your account manually right after checkout.
      </p>
    </div>
  );
}
