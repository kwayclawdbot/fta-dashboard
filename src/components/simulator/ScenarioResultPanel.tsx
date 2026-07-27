"use client";

import { m } from "@/lib/motion";
import { Check, RotateCcw, ArrowRight } from "lucide-react";
import { Meter } from "@/components/f0/parts";
import type { Decision } from "@/lib/simulator/scenarios";

/**
 * THE RESULT — what you called, what the tape did, and what it scored.
 *
 * Same scoring inputs and same actions as before; the two little score tiles
 * and the bordered explanation box are now ruled ledger rows and a ruled note.
 *
 * COLOUR LAW: a score is not a price, so pass/fail is NOT green/red — it is the
 * brand check plus the word, and the meter is volt (progress you can act on).
 * That also stops "PASSED" in green reading like a winning trade when the call
 * itself may have lost money.
 */

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
  /** XP actually written to `xp_events` for this pass, or null if none was
   *  (already earned on a previous pass, or the pattern was not passed). */
  xpAwarded?: number | null;
  /** True while the XP write is still in flight — loading, not "zero". */
  xpPending?: boolean;
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
  xpAwarded = null,
  xpPending = false,
}: ScenarioResultPanelProps) {
  const isCorrectDecision = userDecision === correctDecision;

  return (
    <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-soft">
        {patternName}
      </p>
      <p className="mt-2 font-display text-display-2 font-extrabold tabular-nums text-ink">
        <span className="font-mono">{totalScore}</span>
        <span className="text-soft">/100</span>
      </p>
      <p
        className={`mt-1.5 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] ${
          passed ? "text-gold-700" : "text-soft"
        }`}
      >
        {passed && <Check className="h-3.5 w-3.5" />}
        {passed ? "Passed" : "Needs another rep"}
      </p>

      {/* The shared f0 Meter: its fill rides --accent-solid, so the bar is club
          orange here and family gold on a Family-Mode account with no branch at
          the call site. Progress is an ACTION colour by law — never a price. */}
      <Meter pct={totalScore} className="mt-3" />

      <div className="f0-ledger mt-3">
        <div className="f0-ledger-row justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-[13.5px] font-bold text-ink">
              Pattern read
            </p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-soft">
              You called {DECISION_LABELS[userDecision]} · the pattern was{" "}
              {DECISION_LABELS[correctDecision]}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[14px] font-semibold tabular-nums text-ink">
            {isCorrectDecision && <Check className="h-3.5 w-3.5 text-gold-600" />}
            {patternScore}/50
          </span>
        </div>

        <div className="f0-ledger-row justify-between gap-4">
          <div className="min-w-0">
            <p className="font-display text-[13.5px] font-bold text-ink">Outcome</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-soft">
              Scored on what the tape actually did next
            </p>
          </div>
          <span className="shrink-0 font-mono text-[14px] font-semibold tabular-nums text-ink">
            {tradeScore}/50
          </span>
        </div>
      </div>

      <p className="mt-4 border-l-2 border-sand py-1 pl-3.5 text-[13px] leading-relaxed text-soft">
        {explanation}
      </p>

      {/* Canvas "21 Micro Lesson" footer (App Light L1681-1686): the XP earned
          sits on a rule to the left of the forward action. It reports a REAL
          `xp_events` write — a pattern already passed once earns nothing again
          and says so, rather than showing a number that was not banked. */}
      <div className="f0-rule-top mt-4 flex items-center gap-3 pt-3.5">
        <span
          className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-gold-700"
          aria-live="polite"
        >
          {xpPending
            ? "Banking XP…"
            : xpAwarded
              ? `+${xpAwarded} XP`
              : passed
                ? "Already banked"
                : "No XP yet"}
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="f0-focus f0-press ml-auto inline-flex items-center gap-1.5 rounded-xl border border-sand px-4 py-2.5 font-display text-[13px] font-bold text-ink transition-colors hover:border-gold-400 hover:text-gold-700"
        >
          <RotateCcw className="h-4 w-4" />
          Run it again
        </button>
        {hasNext && (
          <button
            type="button"
            onClick={onNext}
            className="cta-button f0-focus f0-press inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px]"
          >
            Next pattern
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </m.div>
  );
}
