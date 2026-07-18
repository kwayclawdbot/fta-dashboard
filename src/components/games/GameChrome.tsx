"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy, RefreshCw, ArrowRight, Volume2, VolumeX } from "lucide-react";
import StreakFlame from "./StreakFlame";
import Burst from "./Burst";

/** Top bar shared by both games: score, streak flame, combo points, sound, dots. */
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
    <div className="mb-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
          <p className="text-soft text-sm">{tagline}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-display text-lg font-bold text-ink leading-none">
              {score}
              <span className="text-soft text-sm font-normal">/{total}</span>
            </p>
            <p className="text-[10px] text-soft mt-1">Score</p>
          </div>
          <div className="text-right min-w-[42px]">
            <div className="flex justify-end">
              <StreakFlame streak={streak} showZero />
            </div>
            <p className="text-[10px] text-soft mt-1">Streak</p>
          </div>
          <button
            onClick={onToggleSound}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            className="w-11 h-11 shrink-0 rounded-xl border border-sand bg-white flex items-center justify-center text-soft hover:text-ink hover:bg-paper transition-colors"
          >
            {muted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
          </button>
        </div>
      </div>

      {/* combo points + progress dots */}
      <div className="flex items-center gap-3 mt-4">
        <span className="text-xs font-display font-bold text-gold-700 tabular-nums">
          {points} pts
        </span>
        <div className="flex items-center gap-1.5 flex-1">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < index ? "bg-gold-500" : i === index ? "bg-gold-400" : "bg-sand"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** End screen shared by both games: score, best streak, XP burst, replay. */
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
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="paper-card p-8 text-center relative overflow-hidden"
      >
        {passed && <Burst count={26} power={150} />}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            passed ? "bg-chip-green" : "bg-chip-amber"
          }`}
        >
          <Trophy className={`w-8 h-8 ${passed ? "text-green-600" : "text-gold-600"}`} />
        </motion.div>
        <h2 className="font-display text-2xl font-bold text-ink mb-1">
          {passed ? "Great reading!" : "Good practice!"}
        </h2>
        <p className="text-soft mb-6">
          You scored {score} of {total} ({pct}%) · {points} pts
        </p>
        <div className="flex items-center justify-center gap-8 mb-6">
          <div>
            <p className="font-display text-2xl font-bold text-ink">
              {score}/{total}
            </p>
            <p className="text-xs text-soft">Correct</p>
          </div>
          <div>
            <div className="flex justify-center">
              <StreakFlame streak={bestStreak} size={26} showZero />
            </div>
            <p className="text-xs text-soft mt-1">Best streak</p>
          </div>
          <div>
            <motion.p
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 16 }}
              className="font-display text-2xl font-bold text-green-600"
            >
              +{xpAwarded}
            </motion.p>
            <p className="text-xs text-soft">{passed ? "XP earned" : "XP (need 70%)"}</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onReplay}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-sand text-ink text-sm font-medium hover:bg-paper"
          >
            <RefreshCw className="w-4 h-4" /> Play again
          </button>
          <Link
            href={backHref}
            className="cta-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
          >
            {backLabel} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
