"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { beltProgress } from "@/lib/belts";
import { Meter } from "@/components/f0/parts";

/**
 * YOU — canvas v2, board 01, the closing object on Home.
 *
 * The canvas draws "YOU · Black Belt", an XP bar and a 48px conic SCORE dial
 * reading 87. Two of those three ship:
 *
 *   · BELT + XP are real. `xp_for_users` (migration 118) is the exact lifetime
 *     total, and src/lib/belts.ts turns it into the shipped five-belt ladder.
 *     The strip derives everything from `beltProgress` so it can never drift
 *     from /belts.
 *   · THE DIAL DOES NOT. Plan §1.5: the club-sentiment arc is the only gauge in
 *     the app, and a personal "score" numeral next to it would additionally be a
 *     member-performance figure (§0.1) with nothing behind it. Progress is a bar
 *     and a numeral, exactly as the belts screen renders it.
 *
 * The belt colour is INTRINSIC (a blue belt is blue in every theme), so the
 * swatch is an inline hex from BELTS — the one sanctioned place in this lane
 * where colour does not come from a token. It is a swatch, not chrome: no belt
 * colour leaks into the surrounding type, which keeps purple out of the UI while
 * the purple BELT remains a belt.
 *
 * FOUNDING / HONEST ABSENCE: `xp === null` means the read failed or the member
 * has no XP row yet — the strip states that and points at the ladder rather than
 * printing a zero that looks like a rank.
 */
export default function YouStrip({
  xp,
  isKid = false,
}: {
  /** Lifetime XP. `null` = unavailable, NOT zero. */
  xp: number | null;
  isKid?: boolean;
}) {
  if (xp == null) {
    return (
      <section className="f0-rule-top pt-4" aria-label="Your rank">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-[14px] leading-snug text-soft">
            Your rank starts with your first rep — reading, rating and posting all
            count.
          </p>
          <Link
            href="/belts"
            className="f0-focus f0-press inline-flex shrink-0 items-center gap-1 rounded-md font-display text-[13px] font-bold text-gold-700 hover:text-gold-600"
          >
            The ladder <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    );
  }

  const { current, next, pct, toNext } = beltProgress(xp);

  return (
    <section className="f0-rule-top pt-4" aria-label="Your rank">
      <div className="flex items-center gap-3.5">
        {/* Belt swatch — a belt, drawn as a belt: a bar with its knot. */}
        <span
          className="h-7 w-2.5 shrink-0 rounded-full"
          style={{
            backgroundColor: current.belt.hex,
            boxShadow: `inset 0 0 0 1px ${current.belt.borderHex}`,
          }}
          aria-hidden
        />

        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-soft">
            You ·{" "}
            <span className="text-ink">{current.label}</span>
          </p>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-soft">
            {next
              ? `${xp.toLocaleString()} XP · ${toNext.toLocaleString()} to ${next.label}`
              : `${xp.toLocaleString()} XP · top of the ladder`}
          </p>
          <Meter pct={pct} className="mt-2 max-w-xs" />
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
