export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { FIC_CHECKOUT_URL } from "@/lib/free-class";
import PricingMatrix from "@/components/entitlements/PricingMatrix";

/**
 * /pricing — the canonical three-tier pricing surface (MONETIZATION-GATES.md).
 * Cheat Code Free / Cheat Code Club $99 / FTA, matrix-driven from the single
 * source of truth (src/lib/entitlements). Copy philosophy: free = participate in
 * the network; Club = unlock the intelligence. It MUST match the in-app walls —
 * it does, because both read PRICING_MATRIX / FEATURE_ACCESS.
 */

const FTA_URL = "/upgrade"; // FTA is a separate advanced upgrade (its own page).

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-8 text-center">
        <span className="text-[11px] font-display font-bold uppercase tracking-[0.16em] text-gold-700">
          Membership
        </span>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
          Participate free. Unlock the intelligence.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-soft">
          The whole community is free — read, post, vote, and shape what the Club
          is watching. Cheat Code Club adds the layer on top: interpretation,
          personalization, monitoring, and Kai working for you.
        </p>
      </header>

      {/* Tier cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="paper-card p-5">
          <p className="font-display text-lg font-bold text-ink">Cheat Code Free</p>
          <p className="mt-0.5 text-2xl font-bold text-ink">$0</p>
          <p className="mt-2 text-sm text-soft">
            Participate in the network. Community, starter lessons, a taste of Kai
            and research.
          </p>
        </div>

        <div className="paper-card p-5 ring-2 ring-gold-300">
          <p className="font-display text-lg font-bold text-gold-700">
            Cheat Code Club
          </p>
          <p className="mt-0.5 text-2xl font-bold text-ink">
            $99<span className="text-base font-medium text-soft">/mo</span>
          </p>
          <p className="mt-2 text-sm text-soft">
            Unlock the intelligence — Kai Watch, Club Intelligence, unlimited
            research, and the whole household included.
          </p>
          <a
            href={FIC_CHECKOUT_URL}
            className="cta-button mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm"
          >
            Join the Club <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="paper-card p-5">
          <p className="font-display text-lg font-bold text-ink">FTA</p>
          <p className="mt-0.5 text-2xl font-bold text-ink">Advanced</p>
          <p className="mt-2 text-sm text-soft">
            The trade-ready academy — a 6-week live trading program on top of your
            Club membership.
          </p>
          <Link
            href={FTA_URL}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sand px-5 py-3 text-sm font-display font-semibold text-ink transition-colors hover:bg-white/50"
          >
            Explore FTA <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* The binding matrix */}
      <div className="paper-card p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Sparkles className="h-4 w-4 text-gold-600" /> Compare every feature
        </h2>
        <PricingMatrix />
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-soft">
        Cheat Code measures and interprets community attention — it is education,
        never financial advice. One Club membership covers your entire household.
      </p>
    </div>
  );
}
