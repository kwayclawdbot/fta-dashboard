"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  Flame,
  Trophy,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, GAME_PASS_RATIO } from "@/lib/xp";

const ROUNDS_PER_SESSION = 10;

interface GameItem {
  id: string;
  prompt: string;
  answer: string;
  why: string | null;
}

interface Option {
  label: string;
  value: string; // must match the item's `answer`
  tone: "green" | "red";
}

interface GameSessionProps {
  game: string; // db `game` key
  title: string;
  tagline: string;
  optionA: Option;
  optionB: Option;
  backHref: string;
  backLabel: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const toneBtn: Record<string, string> = {
  green:
    "border-green-500/40 bg-chip-green text-green-700 hover:bg-green-500/15",
  red: "border-red-500/30 bg-red-500/5 text-red-600 hover:bg-red-500/10",
};

export default function GameSession({
  game,
  title,
  tagline,
  optionA,
  optionB,
  backHref,
  backLabel,
}: GameSessionProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [rounds, setRounds] = useState<GameItem[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [done, setDone] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    const { data } = await supabase
      .from("game_items")
      .select("id, prompt, answer, why")
      .eq("game", game);
    setRounds(shuffle((data as GameItem[]) || []).slice(0, ROUNDS_PER_SESSION));
    setLoading(false);
  }, [supabase, game]);

  useEffect(() => {
    load();
  }, [load]);

  const current = rounds[index];
  const answered = picked !== null;
  const isCorrect = answered && picked === current?.answer;

  function choose(value: string) {
    if (answered || !current) return;
    setPicked(value);
    const correct = value === current.answer;
    if (correct) {
      setScore((s) => s + 1);
      setStreak((st) => {
        const ns = st + 1;
        setBestStreak((b) => Math.max(b, ns));
        return ns;
      });
    } else {
      setStreak(0);
    }
  }

  async function next() {
    if (index + 1 >= rounds.length) {
      setDone(true);
      const passed = score / rounds.length >= GAME_PASS_RATIO;
      await supabase.from("game_scores").insert({
        user_id: userId,
        game,
        score,
        rounds: rounds.length,
      });
      if (passed && userId) {
        await awardXp(supabase, userId, "game", XP.GAME, `${game}-${Date.now()}`);
        setXpAwarded(XP.GAME);
      }
    } else {
      setPicked(null);
      setIndex((i) => i + 1);
    }
  }

  function replay() {
    setRounds(shuffle(rounds));
    setIndex(0);
    setPicked(null);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setDone(false);
    setXpAwarded(0);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <div className="max-w-2xl mx-auto paper-card p-10 text-center">
        <Sparkles className="w-8 h-8 text-gold-500 mx-auto mb-3" />
        <p className="font-display text-lg font-semibold text-ink">
          No rounds available yet
        </p>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((score / rounds.length) * 100);
    const passed = score / rounds.length >= GAME_PASS_RATIO;
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="paper-card p-8 text-center"
        >
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              passed ? "bg-chip-green" : "bg-chip-amber"
            }`}
          >
            <Trophy
              className={`w-8 h-8 ${passed ? "text-green-600" : "text-gold-600"}`}
            />
          </div>
          <h2 className="font-display text-2xl font-bold text-ink mb-1">
            {passed ? "Great reading!" : "Good practice!"}
          </h2>
          <p className="text-soft mb-6">
            You scored {score} of {rounds.length} ({pct}%).
          </p>
          <div className="flex items-center justify-center gap-8 mb-6">
            <div>
              <p className="font-display text-2xl font-bold text-ink">
                {score}/{rounds.length}
              </p>
              <p className="text-xs text-soft">Correct</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-gold-600 flex items-center gap-1 justify-center">
                <Flame className="w-5 h-5" /> {bestStreak}
              </p>
              <p className="text-xs text-soft">Best streak</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-green-600">
                +{xpAwarded}
              </p>
              <p className="text-xs text-soft">
                {passed ? "XP earned" : "XP (need 70%)"}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={replay}
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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
          <p className="text-soft text-sm">{tagline}</p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="font-display text-lg font-bold text-ink">
              {score}
              <span className="text-soft text-sm font-normal">
                /{rounds.length}
              </span>
            </p>
            <p className="text-[11px] text-soft">Score</p>
          </div>
          <div>
            <p className="font-display text-lg font-bold text-gold-600 flex items-center gap-1">
              <Flame className="w-4 h-4" />
              {streak}
            </p>
            <p className="text-[11px] text-soft">Streak</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1.5 mb-6">
        {rounds.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < index ? "bg-gold-500" : i === index ? "bg-gold-400" : "bg-sand"
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current?.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="paper-card p-8 min-h-[220px] flex items-center justify-center text-center"
        >
          <p className="font-display text-2xl font-semibold text-ink leading-snug">
            {current?.prompt}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        {[optionA, optionB].map((opt) => {
          const chosen = picked === opt.value;
          const correctOpt = answered && current?.answer === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => choose(opt.value)}
              disabled={answered}
              className={`py-5 rounded-xl border-2 font-display font-bold text-lg transition-colors disabled:cursor-default ${
                answered
                  ? correctOpt
                    ? "border-green-500/50 bg-chip-green text-green-700"
                    : chosen
                      ? "border-red-500/40 bg-red-500/10 text-red-600"
                      : "border-sand bg-paper text-soft"
                  : toneBtn[opt.tone]
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Reveal */}
      <AnimatePresence>
        {answered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="overflow-hidden"
          >
            <div
              className={`mt-5 rounded-xl p-4 border ${
                isCorrect
                  ? "border-green-500/30 bg-chip-green/50"
                  : "border-red-500/20 bg-red-500/5"
              }`}
            >
              <p className="flex items-center gap-2 font-display font-bold text-sm mb-1">
                {isCorrect ? (
                  <span className="text-green-700 flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Correct
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center gap-1.5">
                    <X className="w-4 h-4" /> The answer was {current?.answer}
                  </span>
                )}
              </p>
              <p className="text-sm text-midnight-200 leading-relaxed">
                {current?.why}
              </p>
            </div>
            <button
              onClick={next}
              className="cta-button w-full py-3.5 rounded-xl text-base mt-4"
            >
              {index + 1 >= rounds.length ? "See results" : "Next round"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
