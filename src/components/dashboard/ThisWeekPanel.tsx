"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  CalendarDays,
  HeartHandshake,
  LineChart,
  ListChecks,
  MessageCircleQuestion,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import type { FicWeek } from "@/lib/fic";

interface Props {
  week: FicWeek | null;
  isKid: boolean;
  isTeen: boolean;
  isParent: boolean;
}

function Section({
  icon: Icon,
  label,
  body,
}: {
  icon: React.ElementType;
  label: string;
  body: string | null;
}) {
  if (!body) return null;
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-gold-400/15 flex items-center justify-center shrink-0">
        <Icon className="w-[18px] h-[18px] text-gold-700" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-soft mb-0.5">
          {label}
        </p>
        <p className="text-sm text-ink leading-relaxed whitespace-pre-line">
          {body}
        </p>
      </div>
    </div>
  );
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
      {/* Class */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="paper-card p-6 lg:p-7"
      >
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            This Week in FIC
          </span>
          <span className="text-xs text-soft">Week of {weekLabel}</span>
        </div>
        <h2 className="font-display text-2xl font-bold text-ink leading-snug">
          {week.class_title}
        </h2>
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <Link
            href="/live-sessions"
            className="cta-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
          >
            <CalendarDays className="w-4 h-4" />
            {isKid ? "See the class" : "RSVP to the live class"}
          </Link>
        </div>
      </motion.div>

      {/* Company of the Week */}
      {(week.company_name || week.cotw_what_they_do) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="paper-card p-6 lg:p-7"
        >
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-gold-700" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-soft">
                  Company of the Week
                </p>
                <h3 className="font-display text-xl font-bold text-ink">
                  {week.company_name}
                  {ticker && (
                    <span className="ml-2 text-sm font-semibold text-gold-700 align-middle">
                      {ticker}
                    </span>
                  )}
                </h3>
              </div>
            </div>
            {ticker && (
              <Link
                href={`/chart?symbol=${ticker}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-700 hover:text-gold-800"
              >
                <LineChart className="w-4 h-4" />
                Practice chart
              </Link>
            )}
          </div>

          <div className="space-y-5">
            <Section
              icon={Building2}
              label="What they do"
              body={week.cotw_what_they_do}
            />
            <Section
              icon={TrendingUp}
              label="How they make money"
              body={week.cotw_how_they_make_money}
            />
            <Section
              icon={HeartHandshake}
              label="Why customers love them"
              body={week.cotw_why_customers_love}
            />
            <Section
              icon={Users}
              label="Why investors watch"
              body={week.cotw_why_investors_watch}
            />
            <Section
              icon={ShieldAlert}
              label="What could go wrong"
              body={week.cotw_what_could_go_wrong}
            />
          </div>

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
