"use client";

import Link from "next/link";

import { beltProgress } from "@/lib/belts";
import { LEVELS } from "@/lib/xp";
import { Dial } from "./board";

/**
 * YOU — board 01's closing object, built as drawn.
 *
 * The board draws a peach-tinted card: a 34px orange rounded-square carrying the
 * brand diamond, "YOU · Black Belt", "XP 12,840 / 15,000" in mono, a 5px
 * progress bar, and a 48px conic dial on the right reading "87 / SCORE".
 *
 * THE DIAL SHIPS. An earlier pass dropped it on the grounds that a gauge next to
 * a personal numeral would read as a performance claim. The owner overruled the
 * no-gauge rule; the claim problem is real and is solved by what the ring is
 * WIRED TO, not by refusing to draw it.
 *
 * WHAT THE DIAL MEASURES, precisely: lifetime XP as a percentage of the top of
 * the belt ladder (LEVELS[last].min, the Black-belt threshold). It is a
 * PARTICIPATION read — XP is earned by reading, rating, posting and asking —
 * and it is bounded 0–100 by construction, which is the only kind of number a
 * ring can honestly carry.
 *
 * WHAT IT IS NOT, and must never become: a member accuracy or hit-rate figure.
 * Publishing one is a regulated performance claim. That line does not move, and
 * it is why the ring is labelled LADDER rather than SCORE — "score" next to a
 * belt in a trading app invites exactly the reading we cannot make.
 *
 * The two numbers are deliberately different reads of the same real total: the
 * BAR is progress through the CURRENT belt band, the RING is position on the
 * WHOLE ladder. Both come from `xp_for_users` (migration 118) through
 * `beltProgress`, so neither can drift from /belts.
 *
 * The belt is named, not swatched. The board writes "YOU · Black Belt" as type
 * and nothing else, and a white belt's own colour (#E8EAF0) rendered as a dot on
 * the peach card reads as a smudge rather than as a rank.
 *
 * FOUNDING / HONEST ABSENCE: `xp === null` means the read failed or the member
 * has no XP row yet. The card keeps its shape and states that, rather than
 * printing a zero that looks like a rank.
 */

/** Top of the ladder — the Black-belt threshold, read from the source of truth. */
const LADDER_TOP = LEVELS[LEVELS.length - 1]?.min || 1;

function Diamond() {
  return (
    <span
      className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-accent"
      aria-hidden
    >
      <span
        className="block h-[11px] w-[11px] rotate-45 rounded-[2px]"
        style={{ backgroundColor: "var(--accent-on)" }}
      />
    </span>
  );
}

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
      <Link
        href="/belts"
        className="club-b-warm f0-focus f0-press flex items-center gap-3 px-[15px] py-[13px]"
        aria-label="Your rank"
      >
        <Diamond />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-soft">
            YOU · <span className="font-bold text-ink">Unranked</span>
          </span>
          <span className="mt-[3px] block text-[11px] leading-snug text-soft">
            Your rank starts with your first rep — reading, rating and posting
            all count.
          </span>
        </span>
        <Dial
          pct={0}
          value="—"
          label="LADDER"
          title="Ladder progress unavailable"
        />
      </Link>
    );
  }

  const { current, next, pct } = beltProgress(xp);
  const ladderPct = Math.max(0, Math.min(100, Math.round((xp / LADDER_TOP) * 100)));
  const target = next ? next.level.min : LADDER_TOP;

  return (
    <Link
      href="/belts"
      className="club-b-warm f0-focus f0-press flex items-center gap-3 px-[15px] py-[13px]"
      aria-label={`${current.label}, ${xp.toLocaleString()} XP`}
    >
      <Diamond />

      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-soft">
          {isKid ? "ME" : "YOU"} ·{" "}
          <span className="font-bold text-ink">{current.label}</span>
        </span>
        <span className="mt-[3px] block font-mono text-[10px] text-soft tabular-nums">
          XP {xp.toLocaleString()} / {target.toLocaleString()}
        </span>
        <span
          className="mt-1.5 block h-[5px] overflow-hidden rounded-[3px] bg-sand"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className="block h-full rounded-[3px] transition-[width] duration-700 ease-out"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, var(--accent-a), var(--accent-strong))",
            }}
          />
        </span>
      </span>

      <Dial
        pct={ladderPct}
        value={String(ladderPct)}
        label="LADDER"
        title={`${ladderPct} percent of the way up the belt ladder`}
      />
    </Link>
  );
}
