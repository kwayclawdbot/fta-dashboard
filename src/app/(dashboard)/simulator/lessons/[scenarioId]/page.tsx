"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BookOpen, Play } from "lucide-react";
import Link from "next/link";
import ScenarioDecisionPanel from "@/components/simulator/ScenarioDecisionPanel";
import ScenarioResultPanel from "@/components/simulator/ScenarioResultPanel";
import { getScenarioById, SCENARIOS, type Decision } from "@/lib/simulator/scenarios";
import { generatePatternBars } from "@/lib/simulator/pattern-injector";
import { sma } from "@/lib/simulator/indicators";
import type { OHLCV } from "@/lib/simulator/market-engine";
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

  const stopPlayback = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start chart playback
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

  // Play resolution bars after decision
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

    // Pattern identification score (0-50)
    const isCorrectDecision = decision === scenario.correctAction;
    const patternScore = isCorrectDecision ? 50 : 0;

    // Trade P&L score (0-50)
    const patternEnd =
      allBarsRef.current.pattern[allBarsRef.current.pattern.length - 1]?.close ?? 100;
    const resolutionEnd =
      allBarsRef.current.resolution[allBarsRef.current.resolution.length - 1]?.close ??
      patternEnd;
    const priceChange = (resolutionEnd - patternEnd) / patternEnd;

    let tradeScore = 0;
    if (decision === "buy") {
      tradeScore = priceChange > 0 ? Math.min(50, Math.round(priceChange * 500)) : 0;
    } else if (decision === "sell") {
      tradeScore = priceChange < 0 ? Math.min(50, Math.round(Math.abs(priceChange) * 500)) : 0;
    } else {
      // "wait" — score based on how volatile/unclear the resolution was
      const absChange = Math.abs(priceChange);
      tradeScore = absChange < 0.03 ? 50 : absChange < 0.05 ? 30 : 10;
    }

    const totalScore = patternScore + tradeScore;
    const passed = totalScore >= 60;

    setScores({ pattern: patternScore, trade: tradeScore, total: totalScore, passed });
    setPhase("result");

    // Save to Supabase
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
      // ignore if tables don't exist
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

  // Cleanup on unmount
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

  const sma20 = sma(visibleBars, 20);

  const currentIdx = SCENARIOS.findIndex((s) => s.id === scenarioId);
  const hasNext = currentIdx < SCENARIOS.length - 1;

  return (
    <div className="space-y-4">
      {/* Back link */}
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
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
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

          {/* Chart */}
          <div className="bg-midnight-900 border border-midnight-700/50 rounded-lg p-2">
            {visibleBars.length > 0 ? (
              <CandlestickChart
                bars={visibleBars}
                sma20={sma20}
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
            <p className="text-[10px] font-mono text-midnight-500 px-1">
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
          {/* Education panel */}
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
          </div>

          {/* Phase-specific panels */}
          <AnimatePresence mode="wait">
            {phase === "intro" && (
              <motion.div
                key="intro"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  onClick={startPlayback}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gold-400/10 border border-gold-400/30 text-gold-400 hover:bg-gold-400/20 transition-colors text-sm font-display font-semibold"
                >
                  <Play className="w-4 h-4" />
                  Start Practice
                </button>
              </motion.div>
            )}

            {phase === "decision" && (
              <motion.div
                key="decision"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ScenarioDecisionPanel
                  patternName={scenario.name}
                  onDecision={playResolution}
                />
              </motion.div>
            )}

            {phase === "result" && userDecision && (
              <motion.div
                key="result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
