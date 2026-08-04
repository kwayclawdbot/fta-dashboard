"use client";

import Link from "next/link";
import { m } from "@/lib/motion";
import {
  ArrowRight,
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
import Ticker from "@/components/ui/Ticker";
import { BoardSection } from "@/components/clubhome/board";

/**
 * THIS WEEK — the family's week, rebuilt in the board-01 card language.
 *
 * WHAT DIED: five `paper-card` boxes, a `.cta-button` RSVP, and two raw-palette
 * tinted panels (bg-chip-sky / border-sky-200) that introduced a colour the
 * system does not own. WHAT REPLACED THEM: one brand-tinted `club-b-warm` object
 * carrying the class and its round orange action orb — the single warm object on
 * the surface — then `BoardSection` marks over white `club-b-card` objects for
 * the assignment, the prompt and the challenge.
 *
 * WARM, NOT CHILDISH: this renders for parents, teens and kids from the same
 * component. The register is the adult one; the kid variant differs in COPY and
 * reading size, never in a softer or more toy-like treatment.
 *
 * NO CLOCK IN RENDER: the week label was `new Date(week_start).toLocaleDateString`,
 * which is both an impure call in render and locale-dependent (server and client
 * can disagree and blow up hydration). `week_start` is a plain YYYY-MM-DD string,
 * so it is formatted by parsing the string itself — deterministic everywhere.
 *
 * COLOUR LAW: nothing here is a price, so nothing here is green or red. Orange is
 * the brand action colour and carries the RSVP and the two "go do it" links.
 */

interface Props {
  week: FicWeek | null;
  isKid: boolean;
  isTeen: boolean;
  isParent: boolean;
  /** Solo (individual, non-parent) member — a family of one. De-parents copy. */
  isSolo?: boolean;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-07-27" → "July 27". Pure string work: no Date, no locale. */
function weekLabelFor(weekStart: string): string {
  const [, mm, dd] = (weekStart || "").split("-");
  const month = MONTHS[Number(mm) - 1];
  const day = Number(dd);
  if (!month || !Number.isFinite(day)) return weekStart || "—";
  return `${month} ${day}`;
}

export default function ThisWeekPanel({
  week,
  isKid,
  isTeen,
  isParent,
  isSolo = false,
}: Props) {
  const isChild = isKid || isTeen;

  /* HONEST ABSENCE — this is a stated empty, not a loading state: the caller
     only renders the panel once the week query has settled. */
  if (!week) {
    return (
      <div className="club-b-card px-5 py-6">
        <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
          This week&apos;s company <span className="text-accent">drops soon</span>
        </p>
        <p className="mt-2.5 max-w-[62ch] text-[14px] leading-relaxed text-soft">
          {isSolo ? "Your" : "Your family's"} next Company of the Week and the
          family assignment land here. While you wait, the last company you
          studied is on your Watchlist.
        </p>
      </div>
    );
  }

  const weekLabel = weekLabelFor(week.week_start);
  const ticker = week.company_ticker?.toUpperCase();

  return (
    <div className="space-y-7">
      {/* ── The class — the ONE brand-tinted object on this surface. The whole
             card is the affordance (the board's warm objects are), so the orb
             is the drawn action mark rather than a second tab stop. ────────── */}
      <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          href="/live-sessions"
          className="club-b-warm f0-focus f0-press flex items-center gap-3.5 px-[15px] py-[14px]"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft tabular-nums">
              {isSolo ? "This Week in the Club" : "This Week in FIC"} · Week of{" "}
              {weekLabel}
            </span>
            <span className="mt-1 block truncate font-display text-[16px] font-extrabold leading-snug text-ink sm:text-[18px]">
              {week.class_title}
            </span>
            <span className="mt-1.5 block font-display text-[12.5px] font-bold text-gold-700">
              {isKid ? "See the class" : "RSVP"}
            </span>
          </span>
          <span className="club-b-orb h-10 w-10 shrink-0" aria-hidden>
            <CalendarDays className="h-4 w-4" />
          </span>
        </Link>
      </m.div>

      {/* ── Company of the Week — the MoneyMachine teaching visual ────────── */}
      {(week.company_name || week.cotw_what_they_do) && (
        <m.div
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
              className="f0-focus inline-flex items-center gap-1.5 font-display text-[13px] font-bold text-gold-700 transition-colors hover:text-gold-600"
            >
              <LineChart className="h-4 w-4" />
              Open{" "}
              <Ticker symbol={ticker} variant="chip" size="sm" tone="family" />{" "}
              in the Practice Chart
            </Link>
          )}

          {week.cotw_discussion_question && (
            <BoardSection
              id="fic-week-question"
              label={isSolo ? "Discussion" : "Family discussion"}
              mark="question"
            >
              <div className="club-b-card mt-2.5 flex gap-3 px-4 py-3.5">
                <MessageCircleQuestion
                  className="mt-0.5 h-4 w-4 shrink-0 text-soft"
                  aria-hidden
                />
                <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-ink">
                  {week.cotw_discussion_question}
                </p>
              </div>
            </BoardSection>
          )}

          {week.cotw_watchlist_assignment && (
            <BoardSection
              id="fic-week-watchlist"
              label="Watchlist"
              mark="assignment"
            >
              <div className="club-b-card mt-2.5 flex gap-3 px-4 py-3.5">
                <ListChecks
                  className="mt-0.5 h-4 w-4 shrink-0 text-soft"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-relaxed text-ink">
                    {week.cotw_watchlist_assignment}
                  </p>
                  <Link
                    href={ticker ? `/watchlist?add=${ticker}` : "/watchlist"}
                    className="f0-focus mt-2.5 inline-flex items-center gap-1.5 font-display text-[13px] font-bold text-gold-700 transition-colors hover:text-gold-600"
                  >
                    <Target className="h-4 w-4" />
                    {isSolo ? "Add to my Watchlist" : "Add to Family Watchlist"}
                  </Link>
                </div>
              </div>
            </BoardSection>
          )}
        </m.div>
      )}

      {/* ── The week's assignment ─────────────────────────────────────────── */}
      {week.family_assignment && (
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <BoardSection
            id="fic-week-assignment"
            label={isSolo ? "Your assignment" : "Your family"}
            mark={isSolo ? "this week" : "assignment"}
          >
            <div className="club-b-card mt-2.5 flex gap-3 px-4 py-3.5">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-soft" aria-hidden />
              <p className="min-w-0 flex-1 whitespace-pre-line text-[14px] leading-relaxed text-ink">
                {week.family_assignment}
              </p>
            </div>
          </BoardSection>
        </m.div>
      )}

      {/* ── Parent prompt — parents only (gate unchanged) ─────────────────── */}
      {isParent && week.parent_prompt && (
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <BoardSection
            id="fic-week-prompt"
            label={isSolo ? "Go deeper" : "Parent"}
            mark={isSolo ? "this week" : "prompt"}
          >
            <div className="club-b-card mt-2.5 flex gap-3 px-4 py-3.5">
              <HeartHandshake
                className="mt-0.5 h-4 w-4 shrink-0 text-soft"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink">
                  {week.parent_prompt}
                </p>
                {!isSolo && (
                  <Link
                    href="/parent-corner"
                    className="f0-focus mt-2.5 inline-flex items-center gap-1.5 font-display text-[13px] font-bold text-gold-700 transition-colors hover:text-gold-600"
                  >
                    More in Parent Corner
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </BoardSection>
        </m.div>
      )}

      {/* ── Kid challenge — kids & teens (gate unchanged) ─────────────────── */}
      {isChild && week.kid_challenge && (
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <BoardSection
            id="fic-week-challenge"
            label="Your"
            mark={isKid ? "challenge this week" : "challenge"}
          >
            <div className="club-b-card mt-2.5 flex gap-3 px-4 py-3.5">
              <Sparkles
                className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                aria-hidden
              />
              <p
                className={`min-w-0 flex-1 whitespace-pre-line leading-relaxed text-ink ${
                  isKid ? "text-[16px]" : "text-[14px]"
                }`}
              >
                {week.kid_challenge}
              </p>
            </div>
          </BoardSection>
        </m.div>
      )}
    </div>
  );
}
