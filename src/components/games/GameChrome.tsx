"use client";

import Link from "next/link";
import { m } from "@/lib/motion";
import { RefreshCw, ArrowRight, Volume2, VolumeX } from "lucide-react";
import StreakFlame from "./StreakFlame";
import Burst from "./Burst";
import { Dial } from "@/components/clubhome/board";

/**
 * SHARED GAME CHROME — the frame around both games. The play mechanics live in
 * CandleBattleGame / TrendOrTrapGame and are untouched by this file; everything
 * here is header, scoreboard, and result state.
 *
 * FORM: a game is the app's ONE immersive moment, and the board reserves its
 * dark island for exactly that (board 08, "In the room", is near-black). So the
 * HUD is a `.night-island` bar that sits directly above the game's own island
 * stage and reads as one continuous dark column: round eyebrow, display title,
 * mono tabular score and streak, a sound control, and the round ticks. The
 * previous version was a hairline `f0-section-rule`/`f0-rule-top` header on
 * paper, floating above a dark stage — two systems in one screen.
 *
 * The END SCREEN comes back out onto the paper, because the session is over: it
 * is the board's tinted accent card (`.club-b-warm`) carrying the result, the
 * bounded conic Dial, and the measures in translucent `.club-b-chip` wells —
 * the same objects board 01 uses for the YOU strip.
 *
 * WHAT THE DIAL MEASURES: the share of this session's rounds you called
 * correctly. It is bounded 0–100 by construction — the only kind of number a
 * ring can honestly carry — and it is a practice-drill result about the player,
 * never a market accuracy or hit-rate claim.
 *
 * COLOUR LAW: the scoreboard carries no green/red. A score is not a price, so
 * the correct-count, the streak, and the XP award all sit in ink (or island ink)
 * with the mode accent (family gold / club orange / FTA metallic) reserved for
 * progress and the play action. Green/red appear only inside the games
 * themselves, where they mean buyers/sellers — i.e. price.
 *
 * DARK: the island is theme-invariant by design (it is the immersive moment);
 * type on it rides `--island-ink` through inheritance rather than a `text-ink`
 * utility, and everything on the paper is a semantic token or a `.club-b-*`
 * class, so both themes fall out with no `dark:` variant.
 *
 * ADULT-FIRST: this is the kid-facing corner of the app and the register is
 * deliberately the SAME as the adult surfaces. The reward for winning is a burst
 * and a number, not a bevel.
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
    <header className="night-island mb-4 px-5 py-5 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent tabular-nums">
            Round {Math.min(index + 1, total)} of {total}
          </p>
          <h1 className="mt-1.5 font-display text-display-2 font-extrabold uppercase leading-[1.05]">
            {title}
          </h1>
          <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed opacity-70">
            {tagline}
          </p>
        </div>

        <div className="flex shrink-0 items-start gap-4 sm:gap-5">
          <div className="text-right">
            <p className="font-mono text-[20px] font-semibold leading-none tabular-nums">
              {score}
              <span className="opacity-55">/{total}</span>
            </p>
            <p className="mt-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] opacity-55">
              Score
            </p>
          </div>
          <div className="min-w-[42px] text-right">
            <div className="flex justify-end">
              <StreakFlame streak={streak} showZero />
            </div>
            <p className="mt-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] opacity-55">
              Streak
            </p>
          </div>
          <button
            onClick={onToggleSound}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            className="f0-focus f0-press grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 transition-colors hover:bg-white/10"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Progress — a run of ticks. Accent = progress toward an action, which is
          the one thing the accent is for. */}
      <div className="mt-5 flex items-center gap-3">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent tabular-nums">
          {points} pts
        </span>
        <span className="flex flex-1 items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < index ? "bg-accent" : i === index ? "bg-accent opacity-55" : "bg-white/15"
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
        className="club-b-warm f0-grain relative px-5 py-6 sm:px-6"
      >
        {passed && <Burst count={26} power={150} />}

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
              Session
              <span className="text-accent"> complete</span>
            </p>
            <h2 className="mt-2 font-display text-display-1 font-extrabold uppercase leading-[1.05] text-ink">
              {passed ? (
                <>
                  Clean <span className="f0-underline-mark">read</span>
                </>
              ) : (
                <>
                  Good <span className="f0-underline-mark">reps</span>
                </>
              )}
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-soft">
              {passed
                ? `You called ${score} of ${total} correctly (${pct}%). That clears the bar — the session paid XP.`
                : `You called ${score} of ${total} correctly (${pct}%). The bar is 70% — run it again and the session pays XP.`}
            </p>
          </div>

          <Dial
            pct={pct}
            value={`${score}/${total}`}
            label="ROUNDS"
            size={64}
            title={`You called ${score} of ${total} rounds correctly this session`}
          />
        </div>

        {/* Measures — translucent wells on the tinted card, as the board draws
            them. No boxes-in-boxes, no equal-column card grid. */}
        <div className="relative mt-6 flex flex-wrap gap-2">
          <span className="club-b-chip inline-flex items-baseline gap-1.5 px-3 py-1.5">
            <span className="font-mono text-[14px] font-semibold tabular-nums text-ink">
              {score}
              <span className="text-soft">/{total}</span>
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
              Correct
            </span>
          </span>
          <span className="club-b-chip inline-flex items-baseline gap-1.5 px-3 py-1.5">
            <span className="font-mono text-[14px] font-semibold tabular-nums text-ink">
              {bestStreak}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
              Best streak
            </span>
          </span>
          <m.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="club-b-chip inline-flex items-baseline gap-1.5 px-3 py-1.5"
          >
            <span
              className={`font-mono text-[14px] font-semibold tabular-nums ${
                xpAwarded > 0 ? "text-accent" : "text-soft"
              }`}
            >
              {xpAwarded > 0 ? `+${xpAwarded}` : "—"}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
              {passed ? "XP earned" : "XP · need 70%"}
            </span>
          </m.span>
        </div>

        <p className="relative mt-4 font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft tabular-nums">
          {points} combo points this session · combo points are not saved
        </p>

        <div className="relative mt-6 flex flex-wrap items-center gap-4">
          <Link
            href={backHref}
            className="f0-focus f0-press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)]"
          >
            {backLabel} <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={onReplay}
            className="f0-focus f0-press inline-flex items-center gap-2 font-display text-[14px] font-bold text-gold-700 transition-colors hover:text-gold-600"
          >
            <RefreshCw className="h-4 w-4" /> Play again
          </button>
        </div>
      </m.section>
    </div>
  );
}
