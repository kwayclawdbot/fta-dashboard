"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, ArrowRight, Sparkles, Video, MessageCircle } from "lucide-react";
import { FIC_CHECKOUT_URL } from "@/lib/free-class";

/**
 * Shown in place of a locked member feature for FREE-tier families. Kept warm
 * and inviting (never punitive) — it names what's behind the door and offers
 * the two forward paths: join FIC, or head to the free class / community.
 */
export default function FreeLocked({ feature }: { feature: string }) {
  return (
    <div className="max-w-lg mx-auto py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="paper-card p-8 text-center"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gold-400/15 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-gold-700" />
        </div>
        <span className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-gold-700">
          A member feature
        </span>
        <h1 className="font-display text-2xl font-bold text-ink mt-1.5">
          {feature} is part of the club
        </h1>
        <p className="text-soft text-sm mt-2.5 max-w-sm mx-auto leading-relaxed">
          Join the Family Investing Club to unlock the full course library, the
          family watchlist, kid missions, games, practice, and weekly member
          classes — everyone under your roof, one membership.
        </p>

        <a
          href={FIC_CHECKOUT_URL}
          className="cta-button mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px]"
        >
          Join FIC — $99/mo <ArrowRight className="w-4 h-4" />
        </a>

        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <Link
            href="/free-class"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-display font-semibold text-ink border border-sand hover:bg-white/50 transition-colors"
          >
            <Video className="w-4 h-4 text-gold-600" /> Free class
          </Link>
          <Link
            href="/community"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-display font-semibold text-ink border border-sand hover:bg-white/50 transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-gold-600" /> Community
          </Link>
        </div>

        <Link
          href="/upgrade"
          className="mt-4 inline-flex items-center justify-center gap-1.5 text-xs text-gold-700 font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5" /> See everything membership includes
        </Link>
      </motion.div>
    </div>
  );
}
