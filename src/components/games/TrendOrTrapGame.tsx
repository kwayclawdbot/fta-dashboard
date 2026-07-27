"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
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
          Trend or Trap draws its charts from the published set. There is nothing to play
          right now — nothing is being generated in its place.
        </p>
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

      {/* Scenario. The round number lives in the top bar, so this is the ask
          and nothing else. The old round chip was green — green is price. */}
      <p className="mb-4 text-[15px] leading-relaxed text-ink">{round.prompt}</p>

      <m.div
        animate={shake && !reduce ? { x: [-6, 6, -5, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.45 }}
        className="night-island relative p-4 sm:p-5"
      >
        <AnimatePresence>{correct && phase === "result" && <Burst key={burstKey} />}</AnimatePresence>
        {correct && phase === "result" && <ScorePop key={popKey} label={pop} />}

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
      </m.div>

      {/* decision UI with the speed-bonus window as a depleting BAR (no rings) */}
      <AnimatePresence mode="wait">
        {phase === "decision" && (
          <m.div
            key="decide"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5"
          >
            <div className="mb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
                Quick correct calls earn bonus points
              </span>
              <TimerBar />
            </div>
            {/* A control PAIR, not a content grid — the two calls are mutually
                exclusive and must carry identical weight. Green/red here are
                the direction of PRICE, the law's own exception. */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => choose("CLIMBING")}
                className="f0-focus f0-press flex min-h-[64px] items-center justify-center gap-2 rounded-xl border-2 border-green-500/40 bg-green-500/10 font-display text-lg font-extrabold text-price-up transition hover:bg-green-500/20"
              >
                <TrendingUp className="h-5 w-5" /> CLIMBING
              </button>
              <button
                onClick={() => choose("FALLING")}
                className="f0-focus f0-press flex min-h-[64px] items-center justify-center gap-2 rounded-xl border-2 border-red-500/40 bg-red-500/10 font-display text-lg font-extrabold text-price-down transition hover:bg-red-500/20"
              >
                <TrendingDown className="h-5 w-5" /> FALLING
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "result" && (
          <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
            {/* The verdict. A hairline-ruled block, not a tinted bubble: the
                only colour is on the outcome word, and it is a PRICE colour
                because the outcome is the direction price actually took. */}
            <div
              className={`border-l-2 pl-4 ${
                correct ? "border-green-500/60" : "border-red-500/60"
              }`}
            >
              <p className="mb-1.5 font-display text-eyebrow font-bold uppercase">
                {correct ? (
                  <span className="flex items-center gap-1.5 text-price-up">
                    <Check className="h-3.5 w-3.5" /> Correct — it was{" "}
                    {round.answer.toLowerCase()}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-price-down">
                    <X className="h-3.5 w-3.5" /> It was {round.answer.toLowerCase()}
                  </span>
                )}
              </p>
              <p className="text-[15px] leading-relaxed text-ink">{round.why}</p>
            </div>
            <button
              onClick={g.advance}
              className="f0-focus f0-press mt-4 min-h-[52px] w-full rounded-full bg-accent font-display text-[14px] font-extrabold uppercase tracking-[0.06em] text-night-950"
            >
              {g.index + 1 >= g.total ? "See results" : "Next chart"}
            </button>
          </m.div>
        )}
      </AnimatePresence>

      {/* First-round primer — a hairline note, not a boxed tip card. */}
      {g.index === 0 && phase === "popin" && (
        <div className="f0-rule-top mt-6 flex items-center gap-3 pt-4">
          <Image
            src="/art/levelup-story.jpg"
            alt=""
            width={64}
            height={64}
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
          <p className="text-[13px] leading-relaxed text-soft">
            Each candle is one battle. Line them up and they tell a story — climbing higher,
            or rolling over. Some are{" "}
            <b className="font-semibold text-gold-700">traps</b>: a fake move before the real
            one.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Depleting BAR — the speed-bonus window.
 *
 * This was a radial countdown ring. The adoption plan bans radial gauges beyond
 * the club-sentiment arc (§1.5) and calls out games as exactly where rings are
 * tempting: a ring encodes one number less legibly than a bar, and a second dial
 * in the app dilutes the one that means something. A depleting bar also reads
 * its remaining time at a glance from across a table, which is how a kid
 * actually plays this.
 *
 * Track + fill read from theme tokens (--sand / --accent-solid), so it is both
 * mode- and theme-correct: metallic on the FTA desk, gold in Family Mode.
 * Reduced motion gets a static full bar rather than a jump to empty — an empty
 * bar would state, falsely, that the bonus window has closed.
 */
function TimerBar() {
  const reduce = useReducedMotion();
  return (
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-sand" aria-hidden>
      <m.div
        className="h-full rounded-full bg-accent"
        initial={{ width: "100%" }}
        animate={{ width: reduce ? "100%" : "0%" }}
        transition={{ duration: reduce ? 0 : TIMER_MS / 1000, ease: "linear" }}
      />
    </div>
  );
}
