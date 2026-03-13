"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle, Lock, BarChart3, CandlestickChart as CandlestickIcon } from "lucide-react";
import { SCENARIOS, type ScenarioDefinition, type Difficulty } from "@/lib/simulator/scenarios";
import { createClient } from "@/lib/supabase/client";

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  beginner: "bg-green-400/10 text-green-400 border-green-400/20",
  intermediate: "bg-gold-400/10 text-gold-400 border-gold-400/20",
  advanced: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function LessonsPage() {
  const [completedScenarios, setCompletedScenarios] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadScores() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data } = await supabase
          .from("sim_scenario_scores")
          .select("scenario_id, passed")
          .eq("user_id", user.id)
          .eq("passed", true);

        if (data) {
          setCompletedScenarios(new Set(data.map((d) => d.scenario_id)));
        }
      } catch {
        // tables may not exist yet
      }
      setLoading(false);
    }
    loadScores();
  }, []);

  const chartPatterns = SCENARIOS.filter((s) => s.category === "chart");
  const candlestickPatterns = SCENARIOS.filter((s) => s.category === "candlestick");
  const totalPassed = completedScenarios.size;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-display font-bold text-midnight-100">
          Pattern Practice
        </h1>
        <p className="text-xs text-midnight-400">
          Master chart and candlestick patterns through interactive scenarios
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 bg-midnight-800 rounded-full overflow-hidden max-w-xs">
            <div
              className="h-full bg-gradient-to-r from-gold-400 to-gold-500 rounded-full transition-all"
              style={{ width: `${(totalPassed / SCENARIOS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-midnight-400">
            {totalPassed}/{SCENARIOS.length} completed
          </span>
        </div>
      </div>

      {/* Chart Patterns Section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gold-400" />
          <h2 className="text-sm font-display font-semibold text-midnight-100">
            Chart Patterns
          </h2>
          <span className="text-[10px] text-midnight-500">({chartPatterns.length})</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {chartPatterns.map((s, i) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              completed={completedScenarios.has(s.id)}
              index={i}
            />
          ))}
        </div>
      </section>

      {/* Candlestick Patterns Section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <CandlestickIcon className="w-4 h-4 text-gold-400" />
          <h2 className="text-sm font-display font-semibold text-midnight-100">
            Candlestick Patterns
          </h2>
          <span className="text-[10px] text-midnight-500">({candlestickPatterns.length})</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {candlestickPatterns.map((s, i) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              completed={completedScenarios.has(s.id)}
              index={i}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ScenarioCard({
  scenario,
  completed,
  index,
}: {
  scenario: ScenarioDefinition;
  completed: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link
        href={`/simulator/lessons/${scenario.id}`}
        className={`block p-4 rounded-lg border transition-colors ${
          completed
            ? "bg-green-400/5 border-green-400/20 hover:border-green-400/40"
            : "bg-midnight-900 border-midnight-700/50 hover:border-gold-400/30"
        }`}
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-display font-semibold text-midnight-100">
            {scenario.name}
          </h3>
          {completed && <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />}
        </div>
        <p className="text-[11px] text-midnight-400 leading-relaxed mb-3 line-clamp-2">
          {scenario.description}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
              DIFFICULTY_COLORS[scenario.difficulty]
            }`}
          >
            {scenario.difficulty}
          </span>
          <span className="text-[10px] text-midnight-500">
            →{" "}
            {scenario.correctAction === "buy"
              ? "Bullish"
              : scenario.correctAction === "sell"
              ? "Bearish"
              : "Neutral"}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
