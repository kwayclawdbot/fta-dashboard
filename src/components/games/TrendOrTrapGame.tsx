"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, X, TrendingUp, TrendingDown } from "lucide-react";
import { useGameRounds } from "@/lib/games/useGameRounds";
import type { SeriesChart } from "@/lib/games/types";
import CandleRenderer from "./CandleRenderer";
import Burst from "./Burst";
import ScorePop from "./ScorePop";
import { GameTopBar, GameEndScreen } from "./GameChrome";
import { useGameSound } from "./useGameSound";

type Phase = "popin" | "decision" | "resolving" | "result";
const POP_MS = 190;
const TIMER_MS = 8000;

export default function TrendOrTrapGame() {
  const g = useGameRounds("trend-or-trap");
  const reduce = useReducedMotion();
  const sound = useGameSound();

  const [phase, setPhase] = useState<Phase>("popin");
  const [revealed, setRevealed] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [popKey, setPopKey] = useState(0);
  const [pop, setPop] = useState("+10");
  const [shake, setShake] = useState(false);
  const decisionStart = useRef(0);

  const round = g.current;
  const data = round?.chart_data as SeriesChart | undefined;
  const di = data?.decisionIndex ?? 0;
  const n = data?.candles.length ?? 0;
  const correct = picked !== null && picked === round?.answer;

  // reset per round
  useEffect(() => {
    setPhase("popin");
    setRevealed(0);
    setPicked(null);
    setShake(false);
  }, [g.index, g.done]);

  // pop candles in up to the decision point
  useEffect(() => {
    if (phase !== "popin" || !data) return;
    if (reduce) {
      setRevealed(di);
      decisionStart.current = performance.now();
      setPhase("decision");
      return;
    }
    if (revealed >= di) {
      decisionStart.current = performance.now();
      setPhase("decision");
      return;
    }
    const t = setTimeout(
      () => {
        setRevealed((r) => r + 1);
        sound.play("tick");
      },
      revealed === 0 ? 260 : POP_MS
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, revealed, data, reduce]);

  // resolution candles pop in after the call
  useEffect(() => {
    if (phase !== "resolving" || !data) return;
    if (reduce) {
      setRevealed(n);
      finishReveal();
      return;
    }
    if (revealed >= n) {
      finishReveal();
      return;
    }
    const t = setTimeout(() => {
      setRevealed((r) => r + 1);
      sound.play("tick");
    }, POP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, revealed, data]);

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
    const elapsed = performance.now() - decisionStart.current;
    const bonus = Math.max(0, Math.round((1 - elapsed / TIMER_MS) * 6));
    const isRight = value === round.answer;
    setPicked(value);
    setPop(`+${isRight ? 10 + Math.min(g.streak, 5) * 2 + bonus : 0}`);
    g.recordResult(isRight, bonus);
    setPhase("resolving");
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

  const showResolution = phase === "resolving" || phase === "result";

  return (
    <div className="max-w-2xl mx-auto">
      <GameTopBar
        title="Trend or Trap"
        tagline="A chart is just battles in a row. Read it, then call the move."
        score={g.score}
        total={g.total}
        streak={g.streak}
        points={g.points}
        index={g.index}
        muted={sound.muted}
        onToggleSound={sound.toggle}
      />

      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-chip-green px-2.5 py-1 text-[11px] font-semibold text-green-700">
          Round {g.index + 1}
        </span>
        <p className="text-sm text-soft leading-relaxed">{round.prompt}</p>
      </div>

      <motion.div
        animate={shake && !reduce ? { x: [-6, 6, -5, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.45 }}
        className="night-island relative p-4 sm:p-5"
      >
        <AnimatePresence>{correct && phase === "result" && <Burst key={burstKey} />}</AnimatePresence>
        {correct && phase === "result" && <ScorePop key={popKey} label={pop} tone="green" />}

        <CandleRenderer
          candles={data.candles}
          revealed={showResolution ? revealed : Math.min(revealed, di)}
          decisionIndex={di}
          highlightFrom={showResolution ? di : undefined}
          levels={data.levels}
          trendlines={data.trendlines}
        />

        <p className="mt-2 text-center text-xs text-night-300">
          {phase === "popin"
            ? "Battles landing one by one…"
            : phase === "decision"
              ? "Your call: where does it go next?"
              : phase === "resolving"
                ? "Watch it play out…"
                : correct
                  ? "You read it right."
                  : "That one was a trap."}
        </p>
      </motion.div>

      {/* decision UI with speed-bonus timer ring */}
      <AnimatePresence mode="wait">
        {phase === "decision" && (
          <motion.div
            key="decide"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <TimerRing />
              <span className="text-xs text-soft">Quick correct calls earn bonus points</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => choose("CLIMBING")}
                className="min-h-[64px] rounded-xl border-2 border-green-500/40 bg-chip-green text-green-700 font-display font-extrabold text-lg hover:bg-green-500/15 active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <TrendingUp className="w-5 h-5" /> CLIMBING
              </button>
              <button
                onClick={() => choose("FALLING")}
                className="min-h-[64px] rounded-xl border-2 border-red-500/40 bg-red-500/5 text-red-600 font-display font-extrabold text-lg hover:bg-red-500/10 active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <TrendingDown className="w-5 h-5" /> FALLING
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "result" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
            <div
              className={`relative rounded-2xl border p-4 ${
                correct ? "border-green-500/30 bg-chip-green/60" : "border-red-500/25 bg-red-500/5"
              }`}
            >
              <span
                className={`absolute -top-2 left-8 h-4 w-4 rotate-45 border-l border-t ${
                  correct ? "border-green-500/30 bg-chip-green/60" : "border-red-500/25 bg-red-50"
                }`}
              />
              <p className="flex items-center gap-1.5 font-display font-bold text-sm mb-1">
                {correct ? (
                  <span className="text-green-700 flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Correct — it was {round.answer.toLowerCase()}
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center gap-1.5">
                    <X className="w-4 h-4" /> It was {round.answer.toLowerCase()}
                  </span>
                )}
              </p>
              <p className="text-sm text-midnight-200 leading-relaxed">{round.why}</p>
            </div>
            <button
              onClick={g.advance}
              className="cta-button w-full min-h-[52px] rounded-xl text-base mt-4"
            >
              {g.index + 1 >= g.total ? "See results" : "Next chart"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {g.index === 0 && phase === "popin" && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-sand bg-white p-3">
          <Image
            src="/art/levelup-story.jpg"
            alt=""
            width={64}
            height={64}
            className="h-14 w-14 rounded-lg object-cover"
          />
          <p className="text-xs text-soft leading-relaxed">
            Each candle is one battle. Line them up and they tell a story — climbing higher, or
            rolling over. Some are <b className="text-gold-700">traps</b>: a fake move before the real
            one.
          </p>
        </div>
      )}
    </div>
  );
}

/** Depleting ring — purely cosmetic pressure + a nod to the speed bonus. */
function TimerRing() {
  const reduce = useReducedMotion();
  const C = 2 * Math.PI * 13;
  return (
    <svg width={34} height={34} viewBox="0 0 34 34">
      <circle cx={17} cy={17} r={13} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={3} />
      <motion.circle
        cx={17}
        cy={17}
        r={13}
        fill="none"
        stroke="#F59E0B"
        strokeWidth={3}
        strokeLinecap="round"
        transform="rotate(-90 17 17)"
        strokeDasharray={C}
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: reduce ? 0 : C }}
        transition={{ duration: reduce ? 0 : TIMER_MS / 1000, ease: "linear" }}
      />
    </svg>
  );
}
