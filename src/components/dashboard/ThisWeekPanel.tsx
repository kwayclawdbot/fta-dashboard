"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays,
  HeartHandshake,
  LineChart,
  ListChecks,
  MessageCircleQuestion,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import type { FicWeek } from "@/lib/fic";
import MoneyMachine from "@/components/fic/MoneyMachine";

interface Props {
  week: FicWeek | null;
  isKid: boolean;
  isTeen: boolean;
  isParent: boolean;
}

export default function ThisWeekPanel({ week, isKid, isTeen, isParent }: Props) {
  const isChild = isKid || isTeen;

  if (!week) {
    return (
      <div className="paper-card p-8 text-center">
        <CalendarDays className="w-8 h-8 text-gold-500 mx-auto mb-3" />
        <h2 className="font-display text-xl font-semibold text-ink mb-2">
          This week is being prepared
        </h2>
        <p className="text-soft max-w-md mx-auto">
          Your family&apos;s next Company of the Week and club assignment land
          here soon. Check back shortly.
        </p>
      </div>
    );
  }

  const weekLabel = new Date(week.week_start + "T00:00:00").toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric" }
  );
  const ticker = week.company_ticker?.toUpperCase();

  return (
    <div className="space-y-6">
      {/* Class — slimmed to a single-row RSVP strip so it reads as the thin
          thing it is. The rich MoneyMachine below is the marquee (audit #8):
          the class band no longer sits as a large near-empty gold block above
          the teaching visual. Title + week on the left, RSVP on the right. */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="paper-card p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap"
      >
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-chip-amber text-gold-700 shrink-0">
          <Sparkles className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-soft">
            This Week in FIC · Week of {weekLabel}
          </p>
          <h2 className="font-display text-base sm:text-lg font-bold text-ink leading-snug truncate">
            {week.class_title}
          </h2>
        </div>
        <Link
          href="/live-sessions"
          className="cta-button inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm shrink-0 w-full sm:w-auto justify-center"
        >
          <CalendarDays className="w-4 h-4" />
          {isKid ? "See the class" : "RSVP"}
        </Link>
      </motion.div>

      {/* Company of the Week — the MoneyMachine teaching visual (the marquee) */}
      {(week.company_name || week.cotw_what_they_do) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="space-y-4"
        >
          <MoneyMachine
            companyName={week.company_name}
            ticker={ticker ?? null}
            whatTheyDo={week.cotw_what_they_do}
            howTheyMakeMoney={week.cotw_how_they_make_money}
            whyCustomersLove={week.cotw_why_customers_love}
            whyInvestorsWatch={week.cotw_why_investors_watch}
            whatCouldGoWrong={week.cotw_what_could_go_wrong}
            kid={isKid}
          />

          {ticker && (
            <Link
              href={`/chart?symbol=${ticker}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-700 hover:text-gold-800"
            >
              <LineChart className="w-4 h-4" />
              Open {ticker} in the Practice Chart
            </Link>
          )}

          {week.cotw_discussion_question && (
            <div className="mt-5 p-4 rounded-xl bg-chip-sky border border-sky-200/50">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-800 mb-1 flex items-center gap-1.5">
                <MessageCircleQuestion className="w-4 h-4" />
                Family discussion question
              </p>
              <p className="text-sm text-ink leading-relaxed">
                {week.cotw_discussion_question}
              </p>
            </div>
          )}

          {week.cotw_watchlist_assignment && (
            <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-paper border border-sand">
              <ListChecks className="w-5 h-5 text-gold-700 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-soft mb-0.5">
                  Watchlist assignment
                </p>
                <p className="text-sm text-ink leading-relaxed">
                  {week.cotw_watchlist_assignment}
                </p>
                <Link
                  href={ticker ? `/watchlist?add=${ticker}` : "/watchlist"}
                  className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-gold-700 hover:text-gold-800"
                >
                  <Target className="w-4 h-4" />
                  Add to Family Watchlist
                </Link>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Family assignment */}
      {week.family_assignment && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="paper-card p-6"
        >
          <h3 className="font-display text-base font-semibold text-ink flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-gold-600" />
            Your family assignment
          </h3>
          <p className="text-sm text-ink leading-relaxed whitespace-pre-line">
            {week.family_assignment}
          </p>
        </motion.div>
      )}

      {/* Parent prompt — parents only */}
      {isParent && week.parent_prompt && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="paper-card p-6 border-l-4 border-l-gold-400"
        >
          <h3 className="font-display text-base font-semibold text-ink flex items-center gap-2 mb-2">
            <HeartHandshake className="w-4 h-4 text-gold-600" />
            Parent prompt
          </h3>
          <p className="text-sm text-ink leading-relaxed whitespace-pre-line">
            {week.parent_prompt}
          </p>
          <Link
            href="/parent-corner"
            className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-gold-700 hover:text-gold-800"
          >
            More in Parent Corner
          </Link>
        </motion.div>
      )}

      {/* Kid challenge — kids & teens */}
      {isChild && week.kid_challenge && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="paper-card p-6 border-l-4 border-l-sky-400"
        >
          <h3 className="font-display text-base font-semibold text-ink flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-sky-600" />
            {isKid ? "Your challenge this week" : "Your challenge"}
          </h3>
          <p
            className={`text-ink leading-relaxed whitespace-pre-line ${
              isKid ? "text-base" : "text-sm"
            }`}
          >
            {week.kid_challenge}
          </p>
        </motion.div>
      )}
    </div>
  );
}
