"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { m, AnimatePresence } from "@/lib/motion";
import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import ScenarioDecisionPanel from "@/components/simulator/ScenarioDecisionPanel";
import ScenarioResultPanel from "@/components/simulator/ScenarioResultPanel";
import ChartDrawingTools from "@/components/simulator/ChartDrawingTools";
import { Meter } from "@/components/f0/parts";
import { getScenarioById, SCENARIOS, type Decision } from "@/lib/simulator/scenarios";
import { generatePatternBars } from "@/lib/simulator/pattern-injector";
import type { OHLCV } from "@/lib/simulator/market-engine";
import type { PriceLine, ChartHandle } from "@/components/simulator/CandlestickChart";
import { createClient } from "@/lib/supabase/client";
import { XP, awardXp, hasXpForRef } from "@/lib/xp";

/**
 * PATTERN PRACTICE — one scenario, canvas v2.
 *
 * Canvas reference: "21 Micro Lesson" (App Light L1640-1687) — a progress track
 * with a counter across the top, the question set at display weight, the scene,
 * then lettered answer rows and an XP footer. All of that is here; the tape,
 * the pattern injector and the scoring rubric are untouched.
 *
 * BACKEND: passing a pattern now BANKS REAL XP. `sim_scenario_scores` already
 * recorded the attempt; nothing ever wrote to `xp_events`, so the canvas's
 * "+10 XP" would have been a lie. It is written once per pattern, guarded by
 * `hasXpForRef`, and the footer reports what was actually banked — including
 * "already banked" on a repeat pass.
 */

const CandlestickChart = dynamic(
  () => import("@/components/simulator/CandlestickChart"),
  { ssr: false }
);

type Phase = "intro" | "playing" | "decision" | "resolution" | "result";

export default function ScenarioPracticePage() {
  const params = useParams();
  const router = useRouter();
  const scenarioId = params.scenarioId as string;
  const scenario = getScenarioById(scenarioId);

  const [phase, setPhase] = useState<Phase>("intro");
  const [visibleBars, setVisibleBars] = useState<OHLCV[]>([]);
  const [userDecision, setUserDecision] = useState<Decision | null>(null);
  const [scores, setScores] = useState({ pattern: 0, trade: 0, total: 0, passed: false });
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));
  // Real XP outcome for this attempt — null until the write resolves.
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);
  const [xpPending, setXpPending] = useState(false);

  const chartRef = useRef<ChartHandle | null>(null);
  const allBarsRef = useRef<{
    leadIn: OHLCV[];
    pattern: OHLCV[];
    resolution: OHLCV[];
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const barIndexRef = useRef(0);

  // Generate pattern bars
  useEffect(() => {
    if (!scenario) return;
    const data = generatePatternBars(scenario, seed, 100);
    allBarsRef.current = data;
    barIndexRef.current = 0;
    setVisibleBars([]);
  }, [scenario, seed]);

  // Compute S/R hint lines from waypoints (greyed out)
  const hintPriceLines: PriceLine[] = useMemo(() => {
    if (!scenario || !allBarsRef.current) return [];
    const allPatternBars = [...allBarsRef.current.leadIn, ...allBarsRef.current.pattern];
    if (allPatternBars.length === 0) return [];

    // Find key support and resistance from the pattern waypoints
    const highs: number[] = [];
    const lows: number[] = [];
    const startPrice = allBarsRef.current.leadIn[0]?.close ?? 100;

    scenario.waypoints.forEach((wp) => {
      const price = startPrice * wp.priceRatio;
      if (wp.priceRatio >= 1.0) highs.push(price);
      else lows.push(price);
    });

    const lines: PriceLine[] = [];

    // Resistance — highest waypoint peaks
    if (highs.length > 0) {
      const resistance = Math.max(...highs);
      lines.push({
        price: Math.round(resistance * 100) / 100,
        color: "rgba(239, 68, 68, 0.25)",
        lineWidth: 1,
        lineStyle: 2,
        title: "R",
        axisLabelVisible: false,
      });
    }

    // Support — lowest waypoint troughs
    if (lows.length > 0) {
      const support = Math.min(...lows);
      lines.push({
        price: Math.round(support * 100) / 100,
        color: "rgba(74, 222, 128, 0.25)",
        lineWidth: 1,
        lineStyle: 2,
        title: "S",
        axisLabelVisible: false,
      });
    }

    // Neckline / midpoint for patterns like H&S, double top/bottom
    if (highs.length > 0 && lows.length > 0) {
      const neckline = startPrice;
      if (neckline !== Math.max(...highs) && neckline !== Math.min(...lows)) {
        lines.push({
          price: Math.round(neckline * 100) / 100,
          color: "rgba(251, 191, 36, 0.2)",
          lineWidth: 1,
          lineStyle: 3,
          title: "",
          axisLabelVisible: false,
        });
      }
    }

    return lines;
  }, [scenario, seed]);

  const stopPlayback = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  function startPlayback() {
    if (!allBarsRef.current) return;
    setPhase("playing");

    const allLeadInAndPattern = [
      ...allBarsRef.current.leadIn,
      ...allBarsRef.current.pattern,
    ];

    barIndexRef.current = 0;
    setVisibleBars([]);

    intervalRef.current = setInterval(() => {
      if (barIndexRef.current >= allLeadInAndPattern.length) {
        stopPlayback();
        setPhase("decision");
        return;
      }
      barIndexRef.current++;
      setVisibleBars(allLeadInAndPattern.slice(0, barIndexRef.current));
    }, 200);
  }

  function playResolution(decision: Decision) {
    if (!allBarsRef.current) return;
    setUserDecision(decision);
    setPhase("resolution");

    const currentBars = [
      ...allBarsRef.current.leadIn,
      ...allBarsRef.current.pattern,
    ];
    const resolution = allBarsRef.current.resolution;
    let resIdx = 0;

    intervalRef.current = setInterval(() => {
      if (resIdx >= resolution.length) {
        stopPlayback();
        calculateScores(decision);
        return;
      }
      resIdx++;
      setVisibleBars([...currentBars, ...resolution.slice(0, resIdx)]);
    }, 200);
  }

  function calculateScores(decision: Decision) {
    if (!scenario || !allBarsRef.current) return;

    const isCorrectDecision = decision === scenario.correctAction;
    const patternScore = isCorrectDecision ? 50 : 0;

    const patternEnd =
      allBarsRef.current.pattern[allBarsRef.current.pattern.length - 1]?.close ?? 100;
    const resolutionEnd =
      allBarsRef.current.resolution[allBarsRef.current.resolution.length - 1]?.close ?? patternEnd;
    const priceChange = (resolutionEnd - patternEnd) / patternEnd;

    let tradeScore = 0;
    if (decision === "buy") {
      tradeScore = priceChange > 0 ? Math.min(50, Math.round(priceChange * 500)) : 0;
    } else if (decision === "sell") {
      tradeScore = priceChange < 0 ? Math.min(50, Math.round(Math.abs(priceChange) * 500)) : 0;
    } else {
      const absChange = Math.abs(priceChange);
      tradeScore = absChange < 0.03 ? 50 : absChange < 0.05 ? 30 : 10;
    }

    const totalScore = patternScore + tradeScore;
    const passed = totalScore >= 60;

    setScores({ pattern: patternScore, trade: tradeScore, total: totalScore, passed });
    setPhase("result");
    saveScore(decision, patternScore, tradeScore, totalScore, passed);
  }

  async function saveScore(
    decision: Decision,
    patternScore: number,
    tradeScore: number,
    totalScore: number,
    passed: boolean
  ) {
    if (passed) setXpPending(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setXpPending(false);
        return;
      }
      await supabase.from("sim_scenario_scores").insert({
        user_id: user.id,
        scenario_id: scenarioId,
        pattern_score: patternScore,
        trade_score: tradeScore,
        total_score: totalScore,
        passed,
        decision,
      });

      // XP is banked once per pattern, ever. `ref_id` is the scenario id, so a
      // second pass is a no-op and the footer says "already banked" rather than
      // claiming XP that was not written.
      if (passed) {
        const ref = `scenario:${scenarioId}`;
        const already = await hasXpForRef(supabase, user.id, "game", ref);
        if (!already) {
          await awardXp(supabase, user.id, "game", XP.GAME, ref);
          setXpAwarded(XP.GAME);
        }
      }
    } catch {
      // ignore
    } finally {
      setXpPending(false);
    }
  }

  function handleRetry() {
    stopPlayback();
    setSeed(Math.floor(Math.random() * 100000));
    setPhase("intro");
    setUserDecision(null);
    setXpAwarded(null);
    setXpPending(false);
  }

  function handleNext() {
    const currentIdx = SCENARIOS.findIndex((s) => s.id === scenarioId);
    const nextIdx = (currentIdx + 1) % SCENARIOS.length;
    router.push(`/simulator/lessons/${SCENARIOS[nextIdx].id}`);
  }

  useEffect(() => {
    return () => stopPlayback();
  }, [stopPlayback]);

  if (!scenario) {
    return (
      <div className="mx-auto max-w-4xl py-20">
        <p className="font-display text-display-3 font-extrabold text-ink">
          That pattern isn&apos;t here
        </p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-soft">
          The link may be stale — the full set is one step back.
        </p>
        <Link
          href="/simulator/lessons"
          className="f0-focus mt-3 inline-flex items-center gap-1.5 rounded-full font-display text-[14px] font-bold text-gold-700"
        >
          <ArrowLeft className="h-4 w-4" />
          All patterns
        </Link>
      </div>
    );
  }

  const currentIdx = SCENARIOS.findIndex((s) => s.id === scenarioId);
  const hasNext = currentIdx < SCENARIOS.length - 1;
  const currentPrice = visibleBars.length > 0 ? visibleBars[visibleBars.length - 1].close : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      {/* Canvas "21 Micro Lesson" progress header (App Light L1642-1646): the
          way out, a track, and the counter — one row, no box. */}
      <div className="flex items-center gap-4">
        <Link
          href="/simulator/lessons"
          aria-label="Back to all patterns"
          className="f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All patterns
        </Link>
        <Meter
          pct={((currentIdx + 1) / SCENARIOS.length) * 100}
          className="min-w-0 flex-1"
        />
        <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-gold-700">
          {currentIdx + 1}/{SCENARIOS.length}
        </span>
      </div>

      {/* Chart canvas + the learn / decide rail. Asymmetric page layout, not an
          equal-column card grid — the canvas takes the room it needs. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-4">
          <header>
            <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
              Pattern practice · {scenario.difficulty}
            </p>
            <h1 className="mt-2 font-display text-display-2 font-extrabold text-ink">
              {scenario.name}
            </h1>
            <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-soft">
              {scenario.description}
            </p>
          </header>

          {visibleBars.length > 0 && (
            <ChartDrawingTools chartRef={chartRef} currentPrice={currentPrice} />
          )}

          <div className="chart-frame p-2">
            {visibleBars.length > 0 ? (
              <CandlestickChart
                ref={chartRef}
                bars={visibleBars}
                priceLines={hintPriceLines}
                height={380}
              />
            ) : (
              /* Inside .chart-frame the foreground is the frame's own cream, so
                 this placeholder inherits it — no hex, no bg-white. */
              <div className="flex items-center justify-center" style={{ height: 380 }}>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-60">
                  Press start to run the tape
                </p>
              </div>
            )}
          </div>

          {phase !== "intro" && (
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
              Bar {visibleBars.length} ·{" "}
              {phase === "playing"
                ? "Watching the pattern form"
                : phase === "decision"
                  ? "Make your call"
                  : phase === "resolution"
                    ? "Resolution playing"
                    : "Complete"}
            </p>
          )}
        </div>

        {/* Right rail: what to look for, then the call, then the result. */}
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="scenario-learn">
            <h2
              id="scenario-learn"
              className="f0-section-rule mb-2 font-display text-eyebrow font-bold uppercase text-soft"
            >
              <span className="shrink-0 whitespace-nowrap">What to look for</span>
            </h2>
            <p className="text-[13px] leading-relaxed text-ink/85">{scenario.education}</p>
            {hintPriceLines.length > 0 && (
              <p className="f0-rule-top mt-3 pt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
                Greyed support and resistance are drawn on the chart
              </p>
            )}
          </section>

          <AnimatePresence mode="wait">
            {phase === "intro" && (
              <m.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button
                  onClick={startPlayback}
                  className="f0-focus f0-press flex w-full items-center justify-center gap-2 rounded-xl bg-accent font-display font-bold tracking-[0.02em] text-[color:var(--accent-on)] py-3 text-[14px]"
                >
                  <Play className="h-4 w-4" />
                  Start practice
                </button>
              </m.div>
            )}

            {phase === "decision" && (
              <m.div key="decision" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ScenarioDecisionPanel
                  patternName={scenario.name}
                  onDecision={playResolution}
                />
              </m.div>
            )}

            {phase === "result" && userDecision && (
              <m.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ScenarioResultPanel
                  patternName={scenario.name}
                  userDecision={userDecision}
                  correctDecision={scenario.correctAction}
                  patternScore={scores.pattern}
                  tradeScore={scores.trade}
                  totalScore={scores.total}
                  passed={scores.passed}
                  explanation={scenario.education}
                  onRetry={handleRetry}
                  onNext={handleNext}
                  hasNext={hasNext}
                  xpAwarded={xpAwarded}
                  xpPending={xpPending}
                />
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
