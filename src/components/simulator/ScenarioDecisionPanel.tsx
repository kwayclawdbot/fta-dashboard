"use client";

import { useState } from "react";
import { m } from "@/lib/motion";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import type { Decision } from "@/lib/simulator/scenarios";

/**
 * THE DECISION POINT — the moment the tape stops and you have to call it.
 *
 * Canvas v2 "21 Micro Lesson" (App Light L1662-1679) is the model: the question
 * sits above a STACK of full-width answer rows, each carrying a lettered chip on
 * the left, and the chosen row lights in brand orange with a soft tint. The old
 * three-across button row is replaced by that stack — the labels no longer have
 * to survive being squeezed to a third of a narrow rail, and the letter chip
 * gives each call an identity beyond its fill.
 *
 * COLOUR LAW: the three calls are not price readings, so none of them is green
 * or red. Selection is an ACTION, so the chosen row is brand orange via the
 * gold ramp (which flips per theme; `text-volt-*` does not). The volt rule down
 * the left is what marks this as the live moment.
 *
 * NO VERDICT: these are the MEMBER's calls on a synthetic teaching pattern —
 * the app is not telling anyone what to do with anything.
 */

interface ScenarioDecisionPanelProps {
  patternName: string;
  onDecision: (decision: Decision) => void;
}

const CALLS: {
  id: Decision;
  letter: string;
  label: string;
  hint: string;
  icon: typeof TrendingUp;
}[] = [
  {
    id: "buy",
    letter: "A",
    label: "Buy",
    hint: "You read this as a move up from here",
    icon: TrendingUp,
  },
  {
    id: "sell",
    letter: "B",
    label: "Sell",
    hint: "You read this as a move down from here",
    icon: TrendingDown,
  },
  {
    id: "wait",
    letter: "C",
    label: "Wait",
    hint: "Not enough in the tape to act on yet",
    icon: Clock,
  },
];

export default function ScenarioDecisionPanel({
  patternName,
  onDecision,
}: ScenarioDecisionPanelProps) {
  // Held only long enough for the chosen row to light before the resolution
  // starts playing — the canvas's selected state, not a form value.
  const [chosen, setChosen] = useState<Decision | null>(null);

  function choose(d: Decision) {
    if (chosen) return;
    setChosen(d);
    onDecision(d);
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-l-[3px] border-accent py-1 pl-4"
    >
      <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-gold-700">
        Decision point
      </p>
      <p className="mt-2 font-display text-[16px] font-bold leading-snug tracking-tight text-ink">
        The pattern has formed. What do you do here?
      </p>

      <div className="mt-3.5 flex flex-col gap-2" role="group" aria-label="Your call">
        {CALLS.map((c) => {
          const Icon = c.icon;
          const on = chosen === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => choose(c.id)}
              disabled={!!chosen && !on}
              className={`f0-focus f0-press flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors disabled:opacity-40 ${
                on ? "border-gold-400 bg-chip-amber" : "border-sand hover:border-gold-400"
              }`}
            >
              <span
                aria-hidden
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg font-mono text-[11px] font-bold ${
                  on ? "bg-accent text-night-950" : "bg-sand text-soft"
                }`}
              >
                {c.letter}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`flex items-center gap-1.5 font-display text-[14px] font-bold ${
                    on ? "text-gold-700" : "text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {c.label}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-soft">
                  {c.hint}
                </span>
              </span>
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
