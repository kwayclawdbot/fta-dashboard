"use client";

import { Zap } from "lucide-react";
import { beltProgress } from "@/lib/belts";

/**
 * BeltHeroStrip — the always-visible belt/XP progress hero for the Home command
 * center (Lane 11A). Shows the member's current belt (colored swatch + name), a
 * progress bar toward the next belt/degree, and the XP remaining. Register-aware
 * copy (kids get a warmer line). Colors come from the belt itself so it reads in
 * both themes.
 */
export default function BeltHeroStrip({ xp, isKid = false }: { xp: number; isKid?: boolean }) {
  const bp = beltProgress(xp);
  const { current, next, pct, toNext, nextIsNewBelt } = bp;
  return (
    <div className="paper-card p-4 sm:p-5" data-tour="belt">
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${current.belt.hex}22`, border: `1.5px solid ${current.belt.borderHex}` }}
        >
          <Zap className="h-5 w-5" style={{ color: current.belt.hex }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-display text-base font-bold text-ink">
              {current.label}
              <span className="ml-1.5 font-body text-xs font-normal text-soft">
                · {current.level.name}
              </span>
            </p>
            <span className="shrink-0 text-xs font-semibold text-soft">{xp.toLocaleString()} XP</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sand">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: current.belt.hex }}
            />
          </div>
          <p className="mt-1 text-[11px] text-soft">
            {next
              ? isKid
                ? `${toNext.toLocaleString()} XP to level up${nextIsNewBelt ? ` to your ${next.belt.name} belt!` : "!"}`
                : `${toNext.toLocaleString()} XP to ${next.label}`
              : "Black Belt earned — top of the ladder"}
          </p>
        </div>
      </div>
    </div>
  );
}
