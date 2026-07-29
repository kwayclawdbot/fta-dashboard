"use client";

/**
 * OwnershipScore — the Collection header score. Total + a tasteful expandable
 * breakdown, each component labeled. Locked decision #4: never ranks by
 * returns; there are no returns anywhere in this surface.
 */

import { useEffect, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { Trophy, ChevronDown } from "lucide-react";
import { getScore, type OwnershipScore as Score } from "./api";
import { demoScore } from "./demo";

const EASE = [0.23, 1, 0.32, 1] as const;

export default function OwnershipScore({ demo = false }: { demo?: boolean }) {
  const reduce = useReducedMotion();
  const [score, setScore] = useState<Score | null>(demo ? demoScore() : null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Demo score is set from the initializer; nothing to fetch.
    if (demo) return;
    let alive = true;
    getScore().then((res) => {
      if (alive && res.ok) setScore(res.data);
    });
    return () => {
      alive = false;
    };
  }, [demo]);

  // Silent when the score service isn't available — never a broken header.
  if (!score) return null;

  const hasBreakdown = score.breakdown.length > 0;

  return (
    <div className="rounded-2xl border border-sand bg-card shadow-[var(--shadow-soft)]">
      <button
        onClick={() => hasBreakdown && setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
          hasBreakdown ? "cursor-pointer" : "cursor-default"
        }`}
        aria-expanded={hasBreakdown ? open : undefined}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-400/15 text-gold-700">
          <Trophy className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
            Ownership Score
          </div>
          <div className="font-mono text-xl font-bold tabular-nums text-ink">
            {score.total.toLocaleString("en-US")}
          </div>
        </div>
        {hasBreakdown && (
          <m.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="text-soft"
          >
            <ChevronDown className="h-4 w-4" />
          </m.span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && hasBreakdown && (
          <m.div
            key="breakdown"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            className="overflow-hidden"
          >
            <ul className="border-t border-sand px-4 py-3">
              {score.breakdown.map((c) => (
                <li
                  key={c.key}
                  className="flex items-start justify-between gap-4 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink">{c.label}</div>
                    {c.detail && (
                      <div className="text-xs text-soft">{c.detail}</div>
                    )}
                  </div>
                  <div className="shrink-0 font-mono text-sm font-bold tabular-nums text-gold-700">
                    +{c.points.toLocaleString("en-US")}
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-sand px-4 py-2.5 text-[11px] leading-relaxed text-soft">
              Your score rewards holding, breadth, gifting and learning — never
              performance. Owning longer counts for more.
            </p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
