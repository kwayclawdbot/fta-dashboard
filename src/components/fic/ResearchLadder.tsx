"use client";

import { m, useReducedMotion } from "@/lib/motion";
import { Binoculars, FlaskConical, Lock, ThumbsUp, ThumbsDown, Check } from "lucide-react";
import type { WatchStatus } from "@/lib/watchlist";

/**
 * <ResearchLadder> — the watchlist status ladder made glanceable and earned.
 * Three rungs: Watch → Study → Verdict. The current rung lights gold, future
 * rungs dim, and the Verdict rung carries a Lock until the research card is
 * complete — so advancing feels like climbing, and the verdict is a payoff for
 * doing the homework, not a dropdown flip.
 *
 * The Study rung shows research completeness (filled/total) as a tiny fill.
 * Presentational: the page owns the state machine and passes it in.
 */

const RUNGS: { key: "watch" | "study" | "verdict"; label: string; icon: React.ElementType }[] = [
  { key: "watch", label: "Watch", icon: Binoculars },
  { key: "study", label: "Study", icon: FlaskConical },
  { key: "verdict", label: "Verdict", icon: Lock },
];

function activeIndex(status: WatchStatus): number {
  if (status === "watch") return 0;
  if (status === "study") return 1;
  return 2; // favorite | avoid
}

export default function ResearchLadder({
  status,
  filled,
  total,
  researchDone,
  className = "",
}: {
  status: WatchStatus;
  filled: number;
  total: number;
  researchDone: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const active = activeIndex(status);
  const isVerdict = status === "favorite" || status === "avoid";

  return (
    <div className={`flex items-center gap-1 ${className}`} aria-label="Research progress">
      {RUNGS.map((rung, i) => {
        const done = i < active || (i === active && isVerdict);
        const current = i === active && !isVerdict;
        const reached = i <= active;

        // Verdict rung: locked until research complete.
        let Icon = rung.icon;
        if (rung.key === "verdict") {
          if (isVerdict) Icon = status === "favorite" ? ThumbsUp : ThumbsDown;
          else if (researchDone) Icon = Check;
          else Icon = Lock;
        }

        const tone =
          isVerdict && rung.key === "verdict"
            ? status === "favorite"
/* A verdict rung is a STANCE, not a price move — the green/red
                 pair here was the market ramp standing in for approval. Kept
                 is the ACTION colour; passed is a neutral filled rung. */
              ? "bg-accent text-[var(--accent-on)] ring-accent"
              : "bg-sand text-ink ring-sand"
            : reached
              ? "bg-gold-400 text-night-950 ring-gold-400"
              : rung.key === "verdict" && researchDone
                ? "bg-chip-amber text-gold-700 ring-gold-300"
                : "bg-paper text-midnight-500 ring-sand";

        return (
          <div key={rung.key} className="flex items-center gap-1">
            {i > 0 && (
              <div className="h-0.5 w-4 overflow-hidden rounded-full bg-sand">
                <m.div
                  className="h-full rounded-full bg-gold-400"
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: i <= active ? 1 : 0 }}
                  style={{ transformOrigin: "left" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            )}
            <div className="flex flex-col items-center gap-0.5">
              <m.div
                className={`flex h-6 w-6 items-center justify-center rounded-full ring-1 ${tone}`}
                animate={
                  current && !reduce
                    ? { scale: [1, 1.12, 1] }
                    : { scale: 1 }
                }
                transition={current ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
              </m.div>
              <span
                className={`text-[9px] font-semibold ${
                  reached || (rung.key === "verdict" && researchDone)
                    ? "text-gold-700"
                    : "text-midnight-500"
                }`}
              >
                {rung.key === "study" && current
                  ? `${filled}/${total}`
                  : rung.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
