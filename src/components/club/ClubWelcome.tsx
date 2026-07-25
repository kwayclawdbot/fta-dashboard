"use client";

import { m } from "@/lib/motion";
import {
  PartyPopper,
  Users,
  LineChart,
  BellRing,
  ShieldCheck,
  KeyRound,
  LogIn,
  ArrowRight,
  Sparkles,
} from "lucide-react";

/**
 * /club/welcome view — the landing after a $99 Cheat Code Club membership
 * checkout. Cheat Code Club branding throughout (brand rule: CCC everywhere; FIC
 * only in Family Mode). Handles new-guest (set password) vs existing (log in),
 * and degrades gracefully on a bogus session_id.
 */

function Header() {
  return (
    <div className="w-full border-b border-sand">
      <div className="max-w-lg mx-auto px-5 h-14 flex items-center justify-between">
        <span className="font-display text-sm font-bold tracking-wide text-ink">
          CHEAT <span className="text-gold-700">CODE</span> CLUB
        </span>
        <a
          href="/login"
          className="text-xs font-display font-semibold text-soft hover:text-ink transition-colors"
        >
          Log in
        </a>
      </div>
    </div>
  );
}

export default function ClubWelcome({
  state,
  accountState = "existing",
  setupUrl = null,
  firstName = "",
}: {
  state: "ok" | "not_found";
  accountState?: "new" | "existing";
  setupUrl?: string | null;
  firstName?: string;
}) {
  if (state === "not_found") {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <Header />
        <div className="max-w-lg mx-auto px-5 py-16 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">
            We couldn&apos;t find that checkout
          </h1>
          <p className="text-soft text-sm mt-3 max-w-sm mx-auto leading-relaxed">
            This link looks incomplete or expired. If you just joined the Club,
            check your email for your receipt and set-up link — or reach us at{" "}
            <a
              href="mailto:hello@familyinvestingclub.com"
              className="text-gold-700 font-semibold"
            >
              hello@familyinvestingclub.com
            </a>{" "}
            and we&apos;ll sort it out right away.
          </p>
          <a
            href="/login"
            className="cta-button mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm"
          >
            Log in <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Header />
      <div className="max-w-lg mx-auto px-5 py-8 sm:py-12">
        {/* Celebration */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-chip-amber flex items-center justify-center mb-4">
            <PartyPopper className="w-7 h-7 text-gold-700" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-[11px] font-display font-bold uppercase tracking-[0.14em] mb-3">
            <Sparkles className="w-3 h-3" /> You&apos;re in the Club
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink leading-tight">
            Welcome to Cheat Code Club{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="text-soft text-sm mt-2.5 max-w-sm mx-auto leading-relaxed">
            Your membership is live. You&apos;ve got the full Club — the network,
            the insights, and the tools — and your whole family is included on one
            membership.
          </p>
        </m.div>

        {/* Finish setup / log in */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="paper-card ring-2 ring-gold-400 p-6 mt-7"
        >
          {accountState === "new" ? (
            <div className="text-center">
              <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0 mx-auto">
                <KeyRound className="w-6 h-6 text-gold-700" />
              </div>
              <h2 className="font-display text-xl font-bold text-ink mt-3">
                One step to finish
              </h2>
              <p className="text-sm text-soft mt-1.5 leading-relaxed max-w-sm mx-auto">
                We set up your account with the email you used at checkout. Set a
                password and you&apos;ll drop straight into the Club.
              </p>
              {setupUrl ? (
                <a
                  href={setupUrl}
                  className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[15px]"
                >
                  <KeyRound className="w-4 h-4" /> Set my password &amp; enter{" "}
                  <ArrowRight className="w-4 h-4" />
                </a>
              ) : (
                <p className="mt-4 text-sm text-soft">
                  Check your email for a sign-in link to finish setting up your
                  account.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0 mx-auto">
                <LogIn className="w-6 h-6 text-gold-700" />
              </div>
              <h2 className="font-display text-xl font-bold text-ink mt-3">
                You&apos;re all set — log in
              </h2>
              <p className="text-sm text-soft mt-1.5 leading-relaxed max-w-sm mx-auto">
                That email already has an account, so we added your Club membership
                right to it. Log in and everything&apos;s waiting.
              </p>
              <a
                href="/login"
                className="cta-button mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[15px]"
              >
                <LogIn className="w-4 h-4" /> Log in to the Club{" "}
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          )}
        </m.div>

        {/* What you got */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="paper-card p-5 mt-6"
        >
          <p className="text-[11px] font-display font-bold uppercase tracking-wider text-gold-700">
            What your membership includes
          </p>
          <ul className="mt-3 space-y-3.5">
            <li className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-gold-400/15 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-gold-700" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-[15px] font-bold text-ink leading-snug">
                  The full Club
                </p>
                <p className="text-sm text-soft leading-relaxed">
                  The member network, the community watchlist, and every Club
                  surface — all unlocked.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-gold-400/15 flex items-center justify-center shrink-0">
                <LineChart className="w-5 h-5 text-gold-700" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-[15px] font-bold text-ink leading-snug">
                  Insights &amp; tools
                </p>
                <p className="text-sm text-soft leading-relaxed">
                  The screener, watchlists, and member insights that help you find
                  and follow the right names.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-gold-400/15 flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5 text-gold-700" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-[15px] font-bold text-ink leading-snug">
                  Your family, included
                </p>
                <p className="text-sm text-soft leading-relaxed">
                  Add your family to your one membership — everyone learns
                  together, no extra cost.
                </p>
              </div>
            </li>
          </ul>
        </m.div>

        {/* Billing disclosure */}
        <p className="mt-6 text-center text-[12px] text-soft max-w-sm mx-auto leading-relaxed flex items-start justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          $99/mo · cancel anytime in one click. Education, not financial advice.
        </p>
        <p className="mt-4 text-center text-[12px] text-soft flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-gold-500" /> See you inside.
        </p>
      </div>
    </div>
  );
}
