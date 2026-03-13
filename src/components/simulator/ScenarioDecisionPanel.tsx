"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import type { Decision } from "@/lib/simulator/scenarios";

interface ScenarioDecisionPanelProps {
  patternName: string;
  onDecision: (decision: Decision) => void;
}

export default function ScenarioDecisionPanel({
  patternName,
  onDecision,
}: ScenarioDecisionPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-midnight-900 border border-gold-400/20 rounded-lg p-5"
    >
      <h3 className="text-sm font-display font-semibold text-gold-400 mb-1">
        Decision Point
      </h3>
      <p className="text-xs text-midnight-400 mb-4">
        Based on the chart pattern forming, what would you do here?
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => onDecision("buy")}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-green-400/10 border border-green-400/30 text-green-400 hover:bg-green-400/20 transition-colors text-sm font-medium"
        >
          <TrendingUp className="w-4 h-4" />
          Buy
        </button>
        <button
          onClick={() => onDecision("sell")}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-colors text-sm font-medium"
        >
          <TrendingDown className="w-4 h-4" />
          Sell
        </button>
        <button
          onClick={() => onDecision("wait")}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-gold-400/10 border border-gold-400/30 text-gold-400 hover:bg-gold-400/20 transition-colors text-sm font-medium"
        >
          <Clock className="w-4 h-4" />
          Wait
        </button>
      </div>

      <p className="text-[10px] text-midnight-500 mt-3 text-center">
        Identifying: {patternName}
      </p>
    </motion.div>
  );
}
