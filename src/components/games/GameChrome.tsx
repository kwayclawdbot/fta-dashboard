"use client";

import Link from "next/link";
import { m } from "@/lib/motion";
import { RefreshCw, ArrowRight, Volume2, VolumeX } from "lucide-react";
import StreakFlame from "./StreakFlame";
import Burst from "./Burst";

/**
 * SHARED GAME CHROME — the frame around both games. The play mechanics live in
 * CandleBattleGame / TrendOrTrapGame and are untouched by this file; everything
 * here is header, scoreboard, and result state.
 *
 * FORM: no card. The top bar is a display title over a mono scoreboard with a
 * hairline beneath it, and the end screen is a display-scale result over a
 * measure strip — the same vocabulary the rest of the app uses, so a game does
 * not read as a different product.
 *
 * COLOUR LAW: the scoreboard carries no green/red. A score is not a price, so
 * the correct-count, the streak, and the XP award all sit in ink with the mode
 * accent (family gold / club volt orange / FTA metallic) reserved for progress
 * and the play action. Green/red appear only inside the games themselves, where
 * they mean buyers/sellers — i.e. price.
 *
 * DARK: every surface value is a semantic token (ink / soft / sand / paper) or
 * the gold ramp, which flips at :root[data-theme="dark"]. The previous version
 * of this file painted `bg-card`/`paper-card` boxes and a hardcoded green XP
 * figure; both are gone.
 */

/** Top bar shared by both games: title, score, streak, sound, progress. */
export function GameTopBar({
  title,
  tagline,
  score,
  total,
  streak,
  points,
  index,
  muted,
  onToggleSound,
}: {
  title: string;
  tagline: string;
  score: number;
  total: number;
  streak: number;
  points: number;
  index: number;
  muted: boolean;
  onToggleSound: () => void;
}) {
  return (
    <header className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
            Round {Math.min(index + 1, total)} of {total}
          </p>
          <h1 className="mt-1.5 font-display text-display-2 font-extrabold uppercase text-ink">
            {title}
          </h1>
          <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-soft">{tagline}</p>
        </div>

        <div className="flex shrink-0 items-start gap-5">
          <div className="text-right">
            <p className="font-mono text-[20px] font-semibold leading-none tabular-nums text-ink">
              {score}
              <span className="text-soft">/{total}</span>
            </p>
            <p className="mt-1.5 text-eyebrow font-display font-bold uppercase text-soft">
              Score
            </p>
          </div>
          <div className="min-w-[42px] text-right">
            <div className="flex justify-end">
              <StreakFlame streak={streak} showZero />
            </div>
            <p className="mt-1.5 text-eyebrow font-display font-bold uppercase text-soft">
              Streak
            </p>
          </div>
          <button
            onClick={onToggleSound}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sand text-soft transition-colors hover:text-ink"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Progress — a run of ticks, not a pill. Accent = progress toward an
          action, which is the one thing the accent is for. */}
      <div className="mt-5 flex items-center gap-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-700">
          {points} pts
        </span>
        <span className="flex flex-1 items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < index ? "bg-gold-500" : i === index ? "bg-gold-400" : "bg-sand"
              }`}
            />
          ))}
        </span>
      </div>
    </header>
  );
}

/** End screen shared by both games: result, measures, XP, replay. */
export function GameEndScreen({
  passed,
  score,
  total,
  bestStreak,
  points,
  xpAwarded,
  onReplay,
  backHref,
  backLabel,
}: {
  passed: boolean;
  score: number;
  total: number;
  bestStreak: number;
  points: number;
  xpAwarded: number;
  onReplay: () => void;
  backHref: string;
  backLabel: string;
}) {
  const pct = Math.round((score / total) * 100);
  return (
    <div className="mx-auto max-w-2xl">
      <m.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        {passed && <Burst count={26} power={150} />}

        <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
          Session complete
        </p>
        <h2 className="mt-2 font-display text-display-1 font-extrabold uppercase text-ink">
          {passed ? "Clean read" : "Good reps"}
        </h2>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-soft">
          {passed
            ? `You called ${score} of ${total} correctly (${pct}%). That clears the bar — the session paid XP.`
            : `You called ${score} of ${total} correctly (${pct}%). The bar is 70% — run it again and the session pays XP.`}
        </p>

        {/* Measure strip — three measures on the paper, no boxes. */}
        <div className="mt-8 flex items-stretch">
          <div className="min-w-0 flex-1 pr-4 sm:pr-6">
            <p className="font-display text-display-2 font-extrabold tabular-nums text-ink">
              {score}
              <span className="text-soft">/{total}</span>
            </p>
            <p className="mt-1.5 text-eyebrow font-display font-bold uppercase text-soft">
              Correct
            </p>
          </div>
          <div className="min-w-0 flex-1 border-l border-sand pl-4 pr-4 sm:pl-6 sm:pr-6">
            <p className="font-display text-display-2 font-extrabold tabular-nums text-ink">
              {bestStreak}
            </p>
            <p className="mt-1.5 text-eyebrow font-display font-bold uppercase text-soft">
              Best streak
            </p>
          </div>
          <div className="min-w-0 flex-1 border-l border-sand pl-4 sm:pl-6">
            <m.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="font-display text-display-2 font-extrabold tabular-nums text-ink"
            >
              {xpAwarded > 0 ? `+${xpAwarded}` : "—"}
            </m.p>
            <p className="mt-1.5 text-eyebrow font-display font-bold uppercase text-soft">
              {passed ? "XP earned" : "XP · need 70%"}
            </p>
          </div>
        </div>

        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
          {points} combo points this session · combo points are not saved
        </p>

        <div className="f0-rule-top mt-6 flex items-center gap-4 pt-6">
          <Link
            href={backHref}
            className="cta-button inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
          >
            {backLabel} <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={onReplay}
            className="inline-flex items-center gap-2 font-display text-[14px] font-bold text-gold-700 transition-colors hover:text-gold-600"
          >
            <RefreshCw className="h-4 w-4" /> Play again
          </button>
        </div>
      </m.section>
    </div>
  );
}
