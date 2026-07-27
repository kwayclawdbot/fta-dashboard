"use client";

import { m } from "@/lib/motion";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import type { Decision } from "@/lib/simulator/scenarios";

/**
 * THE DECISION POINT — the moment the tape stops and you have to call it.
 *
 * COLOUR LAW: the three calls are not price readings, so none of them is green
 * or red. They are three equal actions on the paper, separated by their word
 * and their arrow; the surface's charge comes from the volt rule down the left,
 * which is what marks this as the live moment.
 */

interface ScenarioDecisionPanelProps {
  patternName: string;
  onDecision: (decision: Decision) => void;
}

const CALLS: { id: Decision; label: string; icon: typeof TrendingUp }[] = [
  { id: "buy", label: "Buy", icon: TrendingUp },
  { id: "sell", label: "Sell", icon: TrendingDown },
  { id: "wait", label: "Wait", icon: Clock },
];

export default function ScenarioDecisionPanel({
  patternName,
  onDecision,
}: ScenarioDecisionPanelProps) {
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-l-[3px] border-volt-500 py-1 pl-4"
    >
      <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-gold-700">
        Decision point
      </p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink">
        The pattern has formed. What do you do here?
      </p>

      <div className="mt-3.5 flex gap-2">
        {CALLS.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onDecision(c.id)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sand py-3 font-display text-[13px] font-bold text-ink transition-colors hover:border-gold-400 hover:text-gold-700"
            >
              <Icon className="h-4 w-4" />
              {c.label}
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
        Reading: {patternName}
      </p>
    </m.div>
  );
}
