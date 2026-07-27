"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { beltProgress } from "@/lib/belts";
import { Meter } from "@/components/f0/parts";

/**
 * BeltHeroStrip — the always-visible belt/XP progress hero for the Home command
 * center (Lane 11A). Shows the member's current belt (colored swatch + name), a
 * progress bar toward the next belt/degree, and the XP remaining. Register-aware
 * copy (kids get a warmer line). Colors come from the belt itself so it reads in
 * both themes.
 *
 * CANVAS V2 (M1): the paper-card is gone. This is now the same ruled strip the
 * Club home closes on (clubhome/YouStrip) so a family account and a solo account
 * wear one rank object rather than two — hairline rule, belt swatch drawn as a
 * belt, type scale for hierarchy, and the shared Meter for progress. Every
 * string, the `data-tour` hook and the belt maths are untouched.
 */
export default function BeltHeroStrip({ xp, isKid = false }: { xp: number; isKid?: boolean }) {
  const { current, next, pct, toNext, nextIsNewBelt } = beltProgress(xp);

  return (
    <section className="f0-rule-top pt-4" data-tour="belt" aria-label="Your belt">
      <div className="flex items-center gap-3.5">
        <span
          className="h-8 w-2.5 shrink-0 rounded-full"
          style={{
            backgroundColor: current.belt.hex,
            boxShadow: `inset 0 0 0 1px ${current.belt.borderHex}`,
          }}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate font-display text-[15px] font-extrabold text-ink">
              {current.label}
              <span className="ml-1.5 font-body text-[12px] font-normal text-soft">
                · {current.level.name}
              </span>
            </p>
            <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-soft">
              {xp.toLocaleString()} XP
            </span>
          </div>

          <Meter pct={pct} className="mt-2" />

          <p className="mt-1.5 text-[12px] text-soft">
            {next
              ? isKid
                ? `${toNext.toLocaleString()} XP to level up${nextIsNewBelt ? ` to your ${next.belt.name} belt!` : "!"}`
                : `${toNext.toLocaleString()} XP to ${next.label}`
              : "Black Belt earned — top of the ladder"}
          </p>
        </div>

        <Link
          href="/belts"
          className="f0-focus f0-press inline-flex shrink-0 items-center gap-1 rounded-md font-display text-[13px] font-bold text-gold-700 hover:text-gold-600"
        >
          {isKid ? "My belt" : "The ladder"}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
