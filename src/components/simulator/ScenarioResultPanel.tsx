"use client";

import { m } from "@/lib/motion";
import { CheckCircle, XCircle, RotateCcw, ArrowRight } from "lucide-react";
import type { Decision } from "@/lib/simulator/scenarios";

interface ScenarioResultPanelProps {
  patternName: string;
  userDecision: Decision;
  correctDecision: Decision;
  patternScore: number;     // 0-50
  tradeScore: number;       // 0-50
  totalScore: number;       // 0-100
  passed: boolean;          // >= 60
  explanation: string;
  onRetry: () => void;
  onNext: () => void;
  hasNext: boolean;
}

const DECISION_LABELS: Record<Decision, string> = {
  buy: "Buy",
  sell: "Sell",
  wait: "Wait",
};

export default function ScenarioResultPanel({
  patternName,
  userDecision,
  correctDecision,
  patternScore,
  tradeScore,
  totalScore,
  passed,
  explanation,
  onRetry,
  onNext,
  hasNext,
}: ScenarioResultPanelProps) {
  const isCorrectDecision = userDecision === correctDecision;

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-midnight-900 border border-midnight-700/50 rounded-lg p-5"
    >
      {/* Score header */}
      <div className="flex items-center gap-3 mb-4">
        {passed ? (
          <CheckCircle className="w-8 h-8 text-green-400" />
        ) : (
          <XCircle className="w-8 h-8 text-red-500" />
        )}
        <div>
          <h3 className="text-lg font-display font-bold text-midnight-100">
            {totalScore}/100
          </h3>
          <p
            className={`text-xs font-medium ${
              passed ? "text-green-400" : "text-red-500"
            }`}
          >
            {passed ? "PASSED" : "NEEDS PRACTICE"} — {patternName}
          </p>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-midnight-800/50 rounded-lg p-3">
          <p className="text-[10px] text-midnight-400 mb-1">Pattern ID</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-medium text-midnight-100">
              {patternScore}/50
            </span>
            {isCorrectDecision && (
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            )}
          </div>
          <p className="text-[10px] text-midnight-500 mt-0.5">
            You: {DECISION_LABELS[userDecision]} → Correct:{" "}
            {DECISION_LABELS[correctDecision]}
          </p>
        </div>
        <div className="bg-midnight-800/50 rounded-lg p-3">
          <p className="text-[10px] text-midnight-400 mb-1">Trade P&L</p>
          <span className="text-sm font-mono font-medium text-midnight-100">
            {tradeScore}/50
          </span>
          <p className="text-[10px] text-midnight-500 mt-0.5">
            Based on outcome
          </p>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-2 bg-midnight-800 rounded-full mb-4 overflow-hidden">
        <m.div
          initial={{ width: 0 }}
          animate={{ width: `${totalScore}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${
            passed
              ? "bg-gradient-to-r from-green-400 to-green-500"
              : "bg-gradient-to-r from-red-500 to-red-400"
          }`}
        />
      </div>

      {/* Explanation */}
      <div className="bg-midnight-800/30 rounded-lg p-3 mb-4 border border-midnight-700/30">
        <p className="text-xs text-midnight-300 leading-relaxed">
          {explanation}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onRetry}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-midnight-800 border border-midnight-700/50 text-midnight-300 hover:text-gold-400 hover:border-gold-400/30 transition-colors text-sm font-medium"
        >
          <RotateCcw className="w-4 h-4" />
          Retry
        </button>
        {hasNext && (
          <button
            onClick={onNext}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gold-400/10 border border-gold-400/30 text-gold-400 hover:bg-gold-400/20 transition-colors text-sm font-medium"
          >
            Next Pattern
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </m.div>
  );
}
