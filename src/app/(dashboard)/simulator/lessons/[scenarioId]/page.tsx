"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { m, AnimatePresence } from "@/lib/motion";
import { ArrowLeft, BookOpen, Play } from "lucide-react";
import Link from "next/link";
import ScenarioDecisionPanel from "@/components/simulator/ScenarioDecisionPanel";
import ScenarioResultPanel from "@/components/simulator/ScenarioResultPanel";
import ChartDrawingTools from "@/components/simulator/ChartDrawingTools";
import { getScenarioById, SCENARIOS, type Decision } from "@/lib/simulator/scenarios";
import { generatePatternBars } from "@/lib/simulator/pattern-injector";
import type { OHLCV } from "@/lib/simulator/market-engine";
import type { PriceLine, ChartHandle } from "@/components/simulator/CandlestickChart";
import { createClient } from "@/lib/supabase/client";

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
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("sim_scenario_scores").insert({
        user_id: user.id,
        scenario_id: scenarioId,
        pattern_score: patternScore,
        trade_score: tradeScore,
        total_score: totalScore,
        passed,
        decision,
      });
    } catch {
      // ignore
    }
  }

  function handleRetry() {
    stopPlayback();
    setSeed(Math.floor(Math.random() * 100000));
    setPhase("intro");
    setUserDecision(null);
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
      <div className="text-center py-20">
        <p className="text-midnight-400">Pattern not found</p>
        <Link href="/simulator/lessons" className="text-gold-400 text-sm mt-2 inline-block">
          Back to lessons
        </Link>
      </div>
    );
  }

  const currentIdx = SCENARIOS.findIndex((s) => s.id === scenarioId);
  const hasNext = currentIdx < SCENARIOS.length - 1;
  const currentPrice = visibleBars.length > 0 ? visibleBars[visibleBars.length - 1].close : 0;

  return (
    <div className="space-y-4">
      <Link
        href="/simulator/lessons"
        className="inline-flex items-center gap-1.5 text-xs text-midnight-400 hover:text-gold-400 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All Patterns
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Chart */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-display font-bold text-midnight-100">
                {scenario.name}
              </h1>
              <p className="text-xs text-midnight-400">{scenario.description}</p>
            </div>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
                scenario.difficulty === "beginner"
                  ? "bg-green-400/10 text-green-400 border-green-400/20"
                  : scenario.difficulty === "intermediate"
                  ? "bg-gold-400/10 text-gold-400 border-gold-400/20"
                  : "bg-red-500/10 text-red-500 border-red-500/20"
              }`}
            >
              {scenario.difficulty}
            </span>
          </div>

          {/* Drawing tools */}
          {visibleBars.length > 0 && (
            <ChartDrawingTools chartRef={chartRef} currentPrice={currentPrice} />
          )}

          {/* Chart */}
          <div className="night-island border border-night-700/60 p-2">
            {visibleBars.length > 0 ? (
              <CandlestickChart
                ref={chartRef}
                bars={visibleBars}
                priceLines={hintPriceLines}
                height={380}
              />
            ) : (
              <div className="flex items-center justify-center" style={{ height: 380 }}>
                <p className="text-midnight-500 text-sm">
                  Press Start to begin
                </p>
              </div>
            )}
          </div>

          {/* Bar counter */}
          {phase !== "intro" && (
            <p className="text-[11px] text-midnight-500 px-1">
              Bar {visibleBars.length} •{" "}
              {phase === "playing"
                ? "Watching pattern form..."
                : phase === "decision"
                ? "Make your decision"
                : phase === "resolution"
                ? "Resolution playing..."
                : "Complete"}
            </p>
          )}
        </div>

        {/* Right: Education + Decision/Result */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-midnight-900 border border-midnight-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-gold-400" />
              <h3 className="text-sm font-display font-semibold text-midnight-100">
                Learn
              </h3>
            </div>
            <p className="text-xs text-midnight-300 leading-relaxed">
              {scenario.education}
            </p>
            {hintPriceLines.length > 0 && (
              <div className="mt-3 pt-3 border-t border-midnight-700/30">
                <p className="text-[11px] text-midnight-500">
                  Hint: greyed-out S/R levels are drawn on the chart
                </p>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {phase === "intro" && (
              <m.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button
                  onClick={startPlayback}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gold-400/10 border border-gold-400/30 text-gold-400 hover:bg-gold-400/20 transition-colors text-sm font-display font-semibold"
                >
                  <Play className="w-4 h-4" />
                  Start Practice
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
                />
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
