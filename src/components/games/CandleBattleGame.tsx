"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
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

  /* LOADING ≠ EMPTY (§0.4). A spinner here was indistinguishable from the
     "no rounds are loaded" state below, which is a real state whenever the
     `game_items` set is unpublished. This skeleton is the game's own shape. */
  if (g.loading) {
    return (
      <div className="mx-auto max-w-2xl" aria-busy="true">
        <div className="h-3 w-28 animate-pulse rounded bg-sand" />
        <div className="mt-3 h-9 w-56 animate-pulse rounded bg-sand" />
        <div className="mt-5 h-1 w-full animate-pulse rounded-full bg-sand/60" />
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-sand/40" />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="h-16 animate-pulse rounded-xl bg-sand/40" />
          <div className="h-16 animate-pulse rounded-xl bg-sand/40" />
        </div>
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
      <div className="mx-auto max-w-2xl border-l-2 border-sand py-1 pl-4">
        <p className="font-display text-display-3 font-extrabold text-ink">
          No rounds are loaded
        </p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-soft">
          Candle Battle draws its rounds from the published set. There is nothing to play
          right now — nothing is being generated in its place.
        </p>
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

      {/* Scenario. The round number lives in the top bar, so this is the ask
          and nothing else — a lede over the stage, not a chip in a row. */}
      <p className="mb-4 text-[15px] leading-relaxed text-ink">{round.prompt}</p>

      {/* dark night-island stage */}
      <m.div
        animate={shake && !reduce ? { x: [-6, 6, -5, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.45 }}
        className="night-island relative p-4 sm:p-5"
      >
        <AnimatePresence>{correct && phase === "result" && <Burst key={burstKey} />}</AnimatePresence>
        {correct && phase === "result" && <ScorePop key={popKey} label={`+${10 + Math.min(g.streak - 1, 5) * 2}`} />}

        <FormingCandle data={data} progress={progress} reveal={phase === "result"} />

        <div className="mt-3">
          <TugOfWar lean={lean} />
        </div>

        {phase === "forming" && (
          <p className="mt-3 text-center text-xs text-night-300 animate-pulse">
            The battle is forming…
          </p>
        )}
      </m.div>

      {/* Decision buttons. A control PAIR, not a content grid: the two calls are
          mutually exclusive and must carry identical weight, which is the one
          case where two equal columns is the correct form. Green/red here mean
          buyers vs sellers — i.e. PRICE, the law's own exception. */}
      <AnimatePresence mode="wait">
        {phase === "decision" && (
          <m.div
            key="decide"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 grid grid-cols-2 gap-3"
          >
            <button
              onClick={() => choose("GREEN TEAM")}
              className="f0-focus f0-press min-h-[64px] rounded-xl border-2 border-green-500/40 bg-green-500/10 font-display text-lg font-extrabold text-price-up transition hover:bg-green-500/20"
            >
              GREEN TEAM
            </button>
            <button
              onClick={() => choose("RED TEAM")}
              className="f0-focus f0-press min-h-[64px] rounded-xl border-2 border-red-500/40 bg-red-500/10 font-display text-lg font-extrabold text-price-down transition hover:bg-red-500/20"
            >
              RED TEAM
            </button>
          </m.div>
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
          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5"
          >
            {/* The verdict. A hairline-ruled block, not a tinted bubble: the
                only colour is on the outcome word, and it is a PRICE colour
                because the outcome literally is who won the price battle. */}
            <div
              className={`border-l-2 pl-4 ${
                correct ? "border-green-500/60" : "border-red-500/60"
              }`}
            >
              <p className="mb-1.5 font-display text-eyebrow font-bold uppercase">
                {correct ? (
                  <span className="flex items-center gap-1.5 text-price-up">
                    <Check className="h-3.5 w-3.5" /> Correct — {round.answer} won
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-price-down">
                    <X className="h-3.5 w-3.5" /> The {round.answer} won this one
                  </span>
                )}
              </p>
              <p className="text-[15px] leading-relaxed text-ink">{round.why}</p>
            </div>
            <button
              onClick={g.advance}
              className="f0-focus f0-press mt-4 min-h-[52px] w-full rounded-full bg-accent font-display text-[14px] font-extrabold uppercase tracking-[0.06em] text-night-950"
            >
              {g.index + 1 >= g.total ? "See results" : "Next battle"}
            </button>
          </m.div>
        )}
      </AnimatePresence>

      {/* First-round primer — a hairline note, not a boxed tip card. */}
      {g.index === 0 && phase === "forming" && (
        <div className="f0-rule-top mt-6 flex items-center gap-3 pt-4">
          <Image
            src="/art/tug-of-war.jpg"
            alt=""
            width={64}
            height={64}
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
          <p className="text-[13px] leading-relaxed text-soft">
            Every candle is a tug-of-war. The{" "}
            <b className="font-semibold text-price-up">green team</b> (buyers) pulls price up,
            the <b className="font-semibold text-price-down">red team</b> (sellers) pulls it
            down. The close tells you who won.
          </p>
        </div>
      )}
    </div>
  );
}
