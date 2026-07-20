"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  ArrowRight,
  Sparkles,
  Users,
  GraduationCap,
  CalendarDays,
  Video,
  BadgeCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTier, TIER_CONFIG, type FamilyTier } from "@/lib/tier";
import TierBadge from "@/components/TierBadge";

const FIC_URL = "https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a";
const FTA_URL = "https://buy.stripe.com/9B6aEXdbt9pH2Sw8hlbEA0b";

const FIC_FEATURES = [
  "Full foundations course library",
  "Kids, teens, and adult tracks",
  "Daily 5 flashcards and practice games",
  "Family progress, XP, and badges",
  "Community access",
];

// What moving up to FTA actually unlocks — mirrors the access matrix.
const FTA_UPGRADE_BENEFITS = [
  "Everything in Family Investing Club",
  "All tracks for the whole family",
  "Advanced 6-week live trading curriculum",
  "Priority live classes, Q&A, and recordings",
  "Premium FTA badge in the community",
  "Trading simulator, drills, and coach feedback",
];

export default function UpgradePage() {
  const router = useRouter();
  const supabase = createClient();
  const [tier, setTier] = useState<FamilyTier | null>(null);

  // Billing is parent-only — children never see upgrade/billing.
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, family_id")
        .eq("id", user.id)
        .single();
      if (profile?.role === "child") {
        router.replace("/dashboard");
        return;
      }
      setTier(await getFamilyTier(supabase, profile?.family_id));
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (tier === null) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  // ── FTA families: premium status, not a sales pitch ──
  if (tier === "fta") {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="paper-card p-8 ring-2 ring-gold-400 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center mx-auto mb-4 shadow-soft">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <h1 className="font-display text-2xl font-bold text-ink">
              You&apos;re an FTA family
            </h1>
            <TierBadge tier="fta" size="md" />
          </div>
          <p className="text-soft text-sm max-w-md mx-auto">
            {TIER_CONFIG.fta.name} — your whole family has full access to
            everything, including all of the Family Investing Club.
          </p>

          <div className="grid sm:grid-cols-2 gap-2.5 text-left mt-6 mb-8">
            {FTA_UPGRADE_BENEFITS.map((f) => (
              <div key={f} className="flex items-start gap-2 text-sm">
                <BadgeCheck className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
                <span className="text-midnight-200">{f}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/courses"
              className="cta-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
            >
              <CalendarDays className="w-4 h-4" />
              Continue the program
            </Link>
            <Link
              href="/live-sessions"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm border border-sand text-ink hover:bg-paper transition-colors font-display font-semibold"
            >
              <Video className="w-4 h-4" />
              Live classes
            </Link>
          </div>
        </motion.div>

        <p className="text-center text-xs text-soft mt-6">
          Questions about your membership? Reach out to your coach in the
          community.
        </p>
      </div>
    );
  }

  // ── FIC families: current plan + the upgrade path to FTA ──
  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center mb-10"
      >
        <h1 className="font-display text-3xl font-bold text-ink">
          Upgrade to FTA
        </h1>
        <p className="text-soft text-sm mt-2 max-w-lg mx-auto">
          Your family is on the Family Investing Club. The FTA Trade Ready
          cohort takes you from foundations to trade ready — live, together.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        {/* Current plan: FIC */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative paper-card p-6 flex flex-col"
        >
          <div className="w-11 h-11 rounded-xl bg-chip-sky text-sky-800 flex items-center justify-center mb-4">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold text-ink">
              Family Investing Club
            </h2>
            <TierBadge tier="fic" />
          </div>
          <div className="mt-1 mb-3 flex items-baseline gap-1">
            <span className="font-display text-3xl font-bold text-ink">$99</span>
            <span className="text-sm text-soft">/month</span>
          </div>
          <p className="text-sm text-soft leading-relaxed mb-4">
            The foundations library for the whole family. Kids, teens, and
            adults each get their own track.
          </p>
          <ul className="space-y-2.5 mb-6 flex-1">
            {FIC_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
                <span className="text-midnight-200">{f}</span>
              </li>
            ))}
          </ul>
          <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-bold border border-sand text-soft">
            <BadgeCheck className="w-4 h-4 text-green-600" />
            Your current plan
          </div>
        </motion.div>

        {/* Upgrade: FTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="relative paper-card p-6 flex flex-col ring-2 ring-gold-400"
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-0.5 rounded-full bg-gold-500 text-white text-[11px] font-display font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            Go all in
          </div>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-gold-400 to-gold-600 text-white flex items-center justify-center mb-4 shadow-soft">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold text-ink">
              FTA Trade Ready
            </h2>
            <TierBadge tier="fta" />
          </div>
          <div className="mt-1 mb-3 flex items-baseline gap-1">
            <span className="font-display text-3xl font-bold text-ink">
              $2,997
            </span>
            <span className="text-sm text-soft">6-week cohort</span>
          </div>
          <p className="text-sm text-soft leading-relaxed mb-4">
            The live 6-week program that takes a beginner to trade ready — and
            includes everything in your Family Investing Club membership.
          </p>
          <ul className="space-y-2.5 mb-6 flex-1">
            {FTA_UPGRADE_BENEFITS.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
                <span className="text-midnight-200">{f}</span>
              </li>
            ))}
          </ul>
          <a
            href={FTA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-button w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-bold"
          >
            Upgrade to FTA
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>

      <p className="text-center text-xs text-soft max-w-lg mx-auto">
        Checkout opens securely with Stripe in a new tab. During the beta, your
        upgrade is activated on your account manually right after checkout.{" "}
        <a
          href={FIC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-700 hover:text-gold-800 font-semibold"
        >
          Manage FIC billing
        </a>
      </p>
    </div>
  );
}
