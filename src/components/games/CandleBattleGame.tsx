"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useGameRounds } from "@/lib/games/useGameRounds";
import type { CandleChart } from "@/lib/games/types";
import FormingCandle from "./FormingCandle";
import TugOfWar from "./TugOfWar";
import Burst from "./Burst";
import ScorePop from "./ScorePop";
import { GameTopBar, GameEndScreen } from "./GameChrome";
import { useGameSound } from "./useGameSound";

type Phase = "forming" | "decision" | "resolving" | "result";
const FORM_MS = 2200;
const RESOLVE_MS = 1100;

export default function CandleBattleGame() {
  const g = useGameRounds("candle-battle");
  const reduce = useReducedMotion();
  const sound = useGameSound();

  const [phase, setPhase] = useState<Phase>("forming");
  const [progress, setProgress] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [popKey, setPopKey] = useState(0);
  const [shake, setShake] = useState(false);
  const lastTick = useRef(0);

  const round = g.current;
  const data = round?.chart_data as CandleChart | undefined;
  const correct = picked !== null && picked === round?.answer;

  // reset per round
  useEffect(() => {
    setPhase("forming");
    setProgress(0);
    setPicked(null);
    setShake(false);
  }, [g.index, g.done]);

  // forming sweep 0 -> decisionAt
  useEffect(() => {
    if (phase !== "forming" || !data) return;
    if (reduce) {
      setProgress(data.decisionAt);
      setPhase("decision");
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / FORM_MS, 1);
      setProgress(p * data.decisionAt);
      if (now - lastTick.current > 90) {
        sound.play("tick");
        lastTick.current = now;
      }
      if (p < 1) raf = requestAnimationFrame(step);
      else setPhase("decision");
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, data, reduce]);

  // resolving sweep decisionAt -> 1
  useEffect(() => {
    if (phase !== "resolving" || !data) return;
    if (reduce) {
      setProgress(1);
      finishReveal();
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = data.decisionAt;
    const step = (now: number) => {
      const p = Math.min((now - start) / RESOLVE_MS, 1);
      setProgress(from + p * (1 - from));
      if (p < 1) raf = requestAnimationFrame(step);
      else finishReveal();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, data]);

  function finishReveal() {
    setPhase("result");
    if (correct) {
      setBurstKey((k) => k + 1);
      setPopKey((k) => k + 1);
      sound.play("correct");
    } else {
      setShake(true);
      sound.play("wrong");
      setTimeout(() => setShake(false), 500);
    }
  }

  function choose(value: string) {
    if (phase !== "decision" || !round) return;
    setPicked(value);
    g.recordResult(value === round.answer);
    setPhase("resolving");
  }

  // live tug-of-war lean from the current tick
  let lean = 0;
  if (data) {
    const N = data.path.length;
    const k = Math.max(1, Math.min(Math.ceil(progress * N), N));
    const cur = phase === "result" ? data.c : data.path[k - 1];
    const span = (data.h - data.l) * 0.6 || 1;
    lean = Math.max(-1, Math.min(1, (cur - data.o) / span));
  }

  if (g.loading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (g.done) {
    return (
      <GameEndScreen
        passed={g.score / g.total >= 0.7}
        score={g.score}
        total={g.total}
        bestStreak={g.bestStreak}
        points={g.points}
        xpAwarded={g.xpAwarded}
        onReplay={g.replay}
        backHref="/games"
        backLabel="Back to games"
      />
    );
  }

  if (!round || !data) {
    return (
      <div className="max-w-2xl mx-auto paper-card p-10 text-center text-soft">
        No rounds available yet.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <GameTopBar
        title="Candle Battle"
        tagline="One candle is one battle. Watch it form — then call the winner."
        score={g.score}
        total={g.total}
        streak={g.streak}
        points={g.points}
        index={g.index}
        muted={sound.muted}
        onToggleSound={sound.toggle}
      />

      {/* scenario caption */}
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-chip-sky px-2.5 py-1 text-[11px] font-semibold text-sky-800">
          Round {g.index + 1}
        </span>
        <p className="text-sm text-soft leading-relaxed">{round.prompt}</p>
      </div>

      {/* dark night-island stage */}
      <motion.div
        animate={shake && !reduce ? { x: [-6, 6, -5, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.45 }}
        className="night-island relative p-4 sm:p-5"
      >
        <AnimatePresence>{correct && phase === "result" && <Burst key={burstKey} />}</AnimatePresence>
        {correct && phase === "result" && <ScorePop key={popKey} label={`+${10 + Math.min(g.streak - 1, 5) * 2}`} tone="green" />}

        <FormingCandle data={data} progress={progress} reveal={phase === "result"} />

        <div className="mt-3">
          <TugOfWar lean={lean} />
        </div>

        {phase === "forming" && (
          <p className="mt-3 text-center text-xs text-night-300 animate-pulse">
            The battle is forming…
          </p>
        )}
      </motion.div>

      {/* decision buttons */}
      <AnimatePresence mode="wait">
        {phase === "decision" && (
          <motion.div
            key="decide"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-3 mt-5"
          >
            <button
              onClick={() => choose("GREEN TEAM")}
              className="min-h-[64px] rounded-xl border-2 border-green-500/40 bg-chip-green text-green-700 font-display font-extrabold text-lg hover:bg-green-500/15 active:scale-[0.98] transition"
            >
              GREEN TEAM
            </button>
            <button
              onClick={() => choose("RED TEAM")}
              className="min-h-[64px] rounded-xl border-2 border-red-500/40 bg-red-500/5 text-red-600 font-display font-extrabold text-lg hover:bg-red-500/10 active:scale-[0.98] transition"
            >
              RED TEAM
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "resolving" && (
        <p className="mt-5 text-center text-sm font-medium text-soft">
          The candle is settling…
        </p>
      )}

      {/* reveal + why */}
      <AnimatePresence>
        {phase === "result" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5"
          >
            <div
              className={`relative rounded-2xl border p-4 ${
                correct
                  ? "border-green-500/30 bg-chip-green/60"
                  : "border-red-500/25 bg-red-500/5"
              }`}
            >
              {/* speech-bubble tail */}
              <span
                className={`absolute -top-2 left-8 h-4 w-4 rotate-45 border-l border-t ${
                  correct
                    ? "border-green-500/30 bg-chip-green/60"
                    : "border-red-500/25 bg-red-50"
                }`}
              />
              <p className="flex items-center gap-1.5 font-display font-bold text-sm mb-1">
                {correct ? (
                  <span className="text-green-700 flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Correct — {round.answer} won
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center gap-1.5">
                    <X className="w-4 h-4" /> The {round.answer} won this one
                  </span>
                )}
              </p>
              <p className="text-sm text-midnight-200 leading-relaxed">{round.why}</p>
            </div>
            <button
              onClick={g.advance}
              className="cta-button w-full min-h-[52px] rounded-xl text-base mt-4"
            >
              {g.index + 1 >= g.total ? "See results" : "Next battle"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* subtle intro art on first round, forming phase */}
      {g.index === 0 && phase === "forming" && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-sand bg-white p-3">
          <Image
            src="/art/tug-of-war.jpg"
            alt=""
            width={64}
            height={64}
            className="h-14 w-14 rounded-lg object-cover"
          />
          <p className="text-xs text-soft leading-relaxed">
            Every candle is a tug-of-war. The <b className="text-green-700">green team</b> (buyers)
            pulls price up, the <b className="text-red-600">red team</b> (sellers) pulls it down.
            The close tells you who won.
          </p>
        </div>
      )}
    </div>
  );
}
