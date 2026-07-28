"use client";

import { m } from "@/lib/motion";
import {
  Users,
  LineChart,
  BellRing,
  ShieldCheck,
  KeyRound,
  LogIn,
  ArrowRight,
} from "lucide-react";
import { BoardSection } from "@/components/clubhome/board";

/**
 * /club/welcome view — the landing after a $99 Cheat Code Club membership
 * checkout. Cheat Code Club branding throughout (brand rule: CCC everywhere; FIC
 * only in Family Mode). Handles new-guest (set password) vs existing (log in),
 * and degrades gracefully on a bogus session_id.
 *
 * BOARD LANGUAGE (legacy purge): three `paper-card` panels, a gold `ring-2` and
 * three `.cta-button` fills are gone. The screen is now the board's own set —
 * a display masthead, ONE brand-tinted `club-b-warm` object carrying the single
 * action, and a white `club-b-card` under a `BoardSection` mark for what the
 * membership includes.
 *
 * THE SUPPORT ADDRESS: `support@cheatcode.com` is the only support address in
 * the product. The not-found branch used to point at a second, different inbox;
 * it now points at the one that exists.
 *
 * COMMERCIAL STRING: the billing disclosure line is verbatim and must stay so.
 */

/** The one support address in the product. */
const SUPPORT_EMAIL = "support@cheatcode.com";

function Header() {
  return (
    <div className="w-full border-b border-sand">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
          Cheat Code <span className="text-accent">Club</span>
        </span>
        <a
          href="/login"
          className="f0-focus font-display text-[12px] font-semibold text-soft transition-colors hover:text-ink"
        >
          Log in
        </a>
      </div>
    </div>
  );
}

const INCLUDED = [
  {
    icon: Users,
    title: "The full Club",
    body: "The member network, the community watchlist, and every Club surface — all unlocked.",
  },
  {
    icon: LineChart,
    title: "Insights & tools",
    body: "The screener, watchlists, and member insights that help you find and follow the right names.",
  },
  {
    icon: BellRing,
    title: "Your family, included",
    body: "Add your family to your one membership — everyone learns together, no extra cost.",
  },
];

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
        <div className="mx-auto max-w-lg px-5 py-16">
          <h1 className="font-display text-[30px] font-extrabold uppercase leading-[1.05] text-ink">
            We couldn&apos;t find that{" "}
            <span className="f0-underline-mark">checkout</span>
          </h1>
          <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-soft">
            This link looks incomplete or expired. If you just joined the Club,
            check your email for your receipt and set-up link — or reach us at{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="f0-focus font-semibold text-gold-700 transition-colors hover:text-gold-600"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            and we&apos;ll sort it out right away.
          </p>
          <a
            href="/login"
            className="f0-focus f0-press mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)]"
          >
            Log in <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    );
  }

  const isNew = accountState === "new";

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Header />
      <div className="mx-auto max-w-lg px-5 py-8 sm:py-12">
        {/* ── Masthead ─────────────────────────────────────────────────────── */}
        <m.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
            You&apos;re in <span className="text-accent">the Club</span>
          </p>
          <h1 className="mt-3 font-display text-[32px] font-extrabold uppercase leading-[1.02] text-ink sm:text-[38px]">
            Welcome to Cheat Code{" "}
            <span className="f0-underline-mark">Club</span>
            {firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-3 max-w-[52ch] text-[14.5px] leading-relaxed text-soft">
            Your membership is live. You&apos;ve got the full Club — the network,
            the insights, and the tools — and your whole family is included on one
            membership.
          </p>
        </m.header>

        {/* ── The ONE action — the brand-tinted object on this screen ──────── */}
        <m.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="club-b-warm mt-8 px-[15px] py-[16px]"
          aria-labelledby="club-welcome-next"
        >
          <div className="flex items-start gap-3.5">
            <span className="club-b-orb h-10 w-10 shrink-0" aria-hidden>
              {isNew ? (
                <KeyRound className="h-4 w-4" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id="club-welcome-next"
                className="font-display text-[18px] font-extrabold uppercase leading-tight text-ink"
              >
                {isNew ? "One step to finish" : "You're all set — log in"}
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-soft">
                {isNew
                  ? "We set up your account with the email you used at checkout. Set a password and you'll drop straight into the Club."
                  : "That email already has an account, so we added your Club membership right to it. Log in and everything's waiting."}
              </p>
            </div>
          </div>

          {isNew ? (
            setupUrl ? (
              <a
                href={setupUrl}
                className="f0-focus f0-press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)]"
              >
                Set my password &amp; enter
                <ArrowRight className="h-4 w-4" />
              </a>
            ) : (
              /* HONEST STATE: no set-up link came back, so we say so rather than
                 rendering a button that goes nowhere. */
              <p className="mt-4 text-[13px] leading-relaxed text-soft">
                Check your email for a sign-in link to finish setting up your
                account.
              </p>
            )
          ) : (
            <a
              href="/login"
              className="f0-focus f0-press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)]"
            >
              Log in to the Club
              <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </m.section>

        {/* ── What the membership includes ─────────────────────────────────── */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mt-9"
        >
          <BoardSection
            id="club-welcome-includes"
            label="What your membership"
            mark="includes"
          >
            <ul className="mt-2.5 space-y-2.5">
              {INCLUDED.map(({ icon: Icon, title, body }) => (
                <li key={title} className="club-b-card flex gap-3 px-4 py-3.5">
                  <Icon
                    className="mt-0.5 h-4 w-4 shrink-0 text-soft"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="font-display text-[15px] font-bold leading-snug text-ink">
                      {title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-soft">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </BoardSection>
        </m.div>

        {/* Billing disclosure — VERBATIM commercial string, do not retype. */}
        <p className="mt-8 flex items-start gap-1.5 text-[12px] leading-relaxed text-soft">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          $99/mo · cancel anytime in one click. Education, not financial advice.
        </p>
        <p className="mt-4 font-mono text-[9.5px] uppercase tracking-[0.16em] text-soft">
          See you inside.
        </p>
      </div>
    </div>
  );
}
