"use client";

/**
 * StreakFlame — the struck-match ember that replaces the 🔥 emoji.
 *
 * An emoji renders in the platform's own art register (Apple's glossy 3D flame
 * on iOS, Google's flat one on Android, a Windows outline on desktop), so the
 * one mark the streak surface is built around was the one mark the design
 * system did not control. This is the drawn replacement, to the same brief as
 * the Belt: single 2px line, flat fills, no gradients-as-decoration.
 *
 * Three states, and they are STATES, not sizes:
 *   unlit     — line only, cool grey. An empty slot, drawn as an empty slot.
 *   lit       — warm orange body with a gold core.
 *   milestone — the lit mark plus the spark ring (7/30/100-day marks).
 *
 * MOTION (spec #3, the ignite):
 *   path draw ......... stroke-dashoffset, 500ms ease-out
 *   number ............ slot-roll 300ms
 *   today's pip ....... spring pop
 *   idle .............. 2% breathe over 3s
 * `prefers-reduced-motion` collapses all four to a 120ms opacity fade.
 */
import { useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "@/lib/motion";

/* Warm ramp — intrinsic to fire, so it does not flip with the theme. The unlit
   cool grey DOES flip, because an empty slot belongs to the page. */
const EMBER = "#E85400";
const CORE = "#FFB020";
const SPARK = "#FDE68A";

export interface StreakFlameProps {
  /** Days in the streak. 0 → unlit. */
  streak: number;
  /** Rendered width in px. */
  size?: number;
  /** Show the numeral beside the mark. */
  showCount?: boolean;
  /** Render the numeral even at 0. */
  showZero?: boolean;
  /** Force the milestone treatment (otherwise derived from the count). */
  milestone?: boolean;
  /** Play the ignite draw on mount / when the streak increases. */
  ignite?: boolean;
  className?: string;
}

const MILESTONES = new Set([7, 14, 30, 50, 100, 200, 365]);

/** The one path everything else hangs off: a match head over a tapered ember. */
const BODY =
  "M12 2.5c2.6 3.4 1.4 5.6-.2 7.6-1.5 1.9-3.3 3.4-3.3 6.2A5.2 5.2 0 0 0 17.4 17c0-2.2-.9-3.6-1.7-4.8 1.1.4 2 1.3 2.5 2.5.8-2.7-.3-5.4-2-7.6-1.5-1.9-2.3-3.3-4.2-4.6Z";
const CORE_PATH = "M12 11.4c1.1 1 1.8 2.2 1.8 3.6a1.8 1.8 0 0 1-3.6 0c0-1.3.7-2.6 1.8-3.6Z";

export default function StreakFlame({
  streak,
  size = 24,
  showCount = true,
  showZero = false,
  milestone,
  ignite = false,
  className = "",
}: StreakFlameProps) {
  const reduce = useReducedMotion();
  const lit = streak > 0;
  const isMilestone = milestone ?? MILESTONES.has(streak);

  // Ignite fires on mount when asked, and again whenever the count climbs.
  // The previous count lives in a ref so nothing time-dependent is read during
  // render (the roll is driven by an effect, never by Date.now()).
  const prev = useRef<number | null>(null);
  const [rolled, setRolled] = useState(streak);
  const [drawKey, setDrawKey] = useState(0);
  useEffect(() => {
    const before = prev.current;
    prev.current = streak;
    if (before === null) {
      setRolled(streak);
      if (ignite && lit) setDrawKey((k) => k + 1);
      return;
    }
    if (streak !== before) {
      setRolled(streak);
      if (streak > before) setDrawKey((k) => k + 1);
    }
  }, [streak, ignite, lit]);

  const stroke = lit ? EMBER : "var(--m500)";
  const fill = lit ? CORE : "none";

  const breathe =
    reduce || !lit
      ? undefined
      : { scale: [1, 1.02, 1], transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <span className={`inline-flex items-center gap-1.5 leading-none ${className}`}>
      <m.svg
        key={drawKey}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        style={{ transformOrigin: "50% 92%", overflow: "visible" }}
        initial={reduce ? { opacity: 0 } : undefined}
        animate={reduce ? { opacity: 1 } : breathe}
        transition={reduce ? { duration: 0.12 } : undefined}
      >
        {/* the ember body — flat fill under a single-weight line */}
        <m.path
          d={BODY}
          fill={lit ? EMBER : "none"}
          fillOpacity={lit ? 0.16 : 0}
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={reduce || !ignite ? false : { pathLength: 0 }}
          animate={reduce || !ignite ? { pathLength: 1 } : { pathLength: 1 }}
          transition={reduce ? { duration: 0.12 } : { duration: 0.5, ease: "easeOut" }}
        />
        {/* the gold core — only a lit ember has one */}
        {lit && (
          <m.path
            d={CORE_PATH}
            fill={fill}
            stroke={CORE}
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ transformOrigin: "50% 80%" }}
            transition={
              reduce
                ? { duration: 0.12 }
                : { delay: 0.28, type: "spring", stiffness: 400, damping: 14 }
            }
          />
        )}
        {/* milestone sparks — three struck flecks, never a particle burst */}
        {lit && isMilestone && (
          <m.g
            stroke={SPARK}
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ transformOrigin: "50% 50%" }}
            transition={reduce ? { duration: 0.12 } : { delay: 0.4, type: "spring", stiffness: 300, damping: 16 }}
          >
            <path d="M4 7.5 2.4 6" />
            <path d="M20 7.5 21.6 6" />
            <path d="M12 1.4V0" />
          </m.g>
        )}
      </m.svg>

      {(lit || showZero) && showCount && (
        <StreakNumeral value={rolled} lit={lit} reduce={!!reduce} />
      )}
    </span>
  );
}

/** The slot-roll numeral — 300ms, tabular, one digit column rolling up. */
function StreakNumeral({ value, lit, reduce }: { value: number; lit: boolean; reduce: boolean }) {
  return (
    <span className="relative inline-block overflow-hidden leading-none" style={{ height: "1em" }}>
      <m.span
        key={value}
        className={`block font-display font-bold tabular-nums ${lit ? "text-gold-700" : "text-soft"}`}
        initial={reduce ? { opacity: 0 } : { y: "0.9em", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={reduce ? { duration: 0.12 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {value}
      </m.span>
    </span>
  );
}

/**
 * Today's pip — the last cell of a streak calendar. Springs when it lands so
 * the row has one moment of feedback instead of silently re-rendering.
 */
export function StreakPip({
  filled,
  today = false,
  size = 8,
  className = "",
}: {
  filled: boolean;
  today?: boolean;
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <m.span
      className={`inline-block rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: filled ? EMBER : "var(--off-bg)",
        border: `1px solid ${filled ? EMBER : "var(--sand)"}`,
      }}
      initial={today ? (reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }) : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={reduce ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 14 }}
    />
  );
}
