"use client";

/**
 * XpAward — the award moment, as one primitive.
 *
 * XP is the spine of the product and it landed SILENTLY: a number changed
 * somewhere off-screen and the member never saw the reward for the thing they
 * just did. This builds the moment once, to motion spec #1, so every surface
 * that awards XP spends it the same way:
 *
 *   the figure ....... counts up over 800ms on cubic-bezier(0.16, 1, 0.3, 1),
 *                      in tabular figures so the column never jitters
 *   the bar .......... springs (stiffness 180 / damping 26) and is allowed the
 *                      ~3% overshoot-and-settle — the overshoot IS the feeling
 *                      of earning something; a linear fill is a loading bar
 *   the chip ......... "+30 XP" rises and fades over 1400ms
 *   a belt crossing .. the bar fills, HOLDS 200ms at full (the beat that says
 *                      "you finished the level"), then the belt pops to 1.15
 *                      on a 400/12 spring inside a warm bloom
 *
 * `prefers-reduced-motion` collapses all four to a 120ms opacity fade and the
 * count-up becomes an immediate set — the member still gets the information,
 * just none of the theatre.
 *
 * USAGE — the hook is the ergonomic entry point:
 *
 *   const award = useXpAward();
 *   …
 *   await saveThing();
 *   award.fire({ amount: 5, xpBefore, xpAfter });
 *   …
 *   return <div className="relative">{award.overlay}<LevelObject … /></div>;
 *
 * The lesson engine belongs to the curriculum lane and is deliberately NOT
 * wired here — it imports this primitive instead.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m, useReducedMotion } from "@/lib/motion";
import { beltCrossing } from "@/lib/belts";
import { levelProgress } from "@/lib/xp";
import { Belt } from "@/components/art/Belt";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const COUNT_MS = 800;
const CHIP_MS = 1400;
const FILL_HOLD_MS = 200;

export interface XpAwardEvent {
  /** The amount awarded — what the chip reads. */
  amount: number;
  /** Lifetime XP before the award. Enables the bar + belt-crossing beats. */
  xpBefore?: number;
  /** Lifetime XP after. Defaults to xpBefore + amount. */
  xpAfter?: number;
  /** Optional reason, written under the chip ("Post published"). */
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* Count-up                                                            */
/* ------------------------------------------------------------------ */

/**
 * Tabular count-up. Drives off requestAnimationFrame with the start stamp held
 * in a ref — nothing time-dependent is read during render, so the component is
 * server-safe and never re-renders itself into a different number mid-paint.
 */
export function CountUp({
  value,
  from,
  duration = COUNT_MS,
  format = (n: number) => Math.round(n).toLocaleString(),
  className = "",
}: {
  value: number;
  /** Starting figure. Defaults to the previous `value`. */
  from?: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(from ?? value);
  const prev = useRef<number>(from ?? value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = prev.current;
    prev.current = value;
    if (reduce || start === value) {
      setShown(value);
      return;
    }
    let t0: number | null = null;
    const tick = (t: number) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / duration);
      // cubic-bezier(0.16, 1, 0.3, 1), approximated on the value axis
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration, reduce]);

  return <span className={`tabular-nums ${className}`}>{format(shown)}</span>;
}

/* ------------------------------------------------------------------ */
/* The springing bar                                                   */
/* ------------------------------------------------------------------ */

/**
 * The award bar: 180/26 spring with the overshoot left IN. Framer's spring
 * settles past the target and back on its own at this ratio; the width is
 * clamped at the element, not the animation, so the fill can bloom to ~103%
 * behind the track's overflow-hidden and settle without ever painting outside.
 */
export function XpAwardBar({
  pct,
  height = 7,
  fillClassName = "bg-gold-600",
  overshoot = true,
  className = "",
}: {
  pct: number;
  height?: number;
  fillClassName?: string;
  overshoot?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const w = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const target = overshoot && !reduce ? Math.min(103, w * 1.03) : w;
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-[var(--off-bg)] ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(w)}
    >
      <m.div
        className={`h-full rounded-full ${fillClassName}`}
        initial={false}
        animate={{ width: `${target}%` }}
        transition={reduce ? { duration: 0.12 } : { type: "spring", stiffness: 180, damping: 26 }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The chip                                                            */
/* ------------------------------------------------------------------ */

/** "+30 XP" — rises and fades over 1400ms, then is gone. */
export function XpAwardChip({ amount, reason }: { amount: number; reason?: string }) {
  const reduce = useReducedMotion();
  return (
    <m.div
      className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 text-center"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.94 }}
      animate={
        reduce
          ? { opacity: [0, 1, 1, 0] }
          : { opacity: [0, 1, 1, 0], y: [6, -6, -14, -22], scale: [0.94, 1, 1, 1] }
      }
      transition={
        reduce
          ? { duration: 0.12 }
          : { duration: CHIP_MS / 1000, times: [0, 0.18, 0.7, 1], ease: EASE_OUT_EXPO }
      }
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-gold-600 px-2.5 py-1 font-mono text-[12px] font-bold tabular-nums text-white shadow-[var(--sh-lift)]">
        <span aria-hidden>⚡</span>+{amount.toLocaleString()} XP
      </span>
      {reason ? (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">{reason}</p>
      ) : null}
    </m.div>
  );
}

/* ------------------------------------------------------------------ */
/* The belt-crossing pop                                               */
/* ------------------------------------------------------------------ */

/** Fill holds 200ms, then the belt pops 1.15 on a 400/12 spring in a warm bloom. */
export function BeltCrossPop({
  beltKey,
  degree,
  label,
}: {
  beltKey: Parameters<typeof Belt>[0]["belt"];
  degree?: number;
  label: string;
}) {
  const reduce = useReducedMotion();
  return (
    <m.div
      className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.12 : 0.2, delay: reduce ? 0 : FILL_HOLD_MS / 1000 }}
    >
      {/* warm bloom */}
      {!reduce && (
        <m.span
          className="absolute h-32 w-32 rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--color-volt-400) 46%, transparent) 0%, transparent 68%)",
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.5, 1.25, 1.5] }}
          transition={{ duration: 0.9, delay: FILL_HOLD_MS / 1000, ease: "easeOut" }}
        />
      )}
      <m.span
        initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
        animate={reduce ? { opacity: 1 } : { scale: [0.6, 1.15, 1], opacity: 1 }}
        transition={
          reduce
            ? { duration: 0.12 }
            : { delay: FILL_HOLD_MS / 1000, type: "spring", stiffness: 400, damping: 12 }
        }
      >
        <Belt belt={beltKey} degree={degree} size={72} title={label} />
      </m.span>
      <p className="relative mt-2 font-display text-[15px] font-extrabold text-ink">{label}</p>
    </m.div>
  );
}

/* ------------------------------------------------------------------ */
/* The hook                                                            */
/* ------------------------------------------------------------------ */

export interface UseXpAward {
  /** Call once XP has actually been awarded server-side. */
  fire: (e: XpAwardEvent) => void;
  /** Drop inside a `position: relative` parent. Null when nothing is playing. */
  overlay: ReactNode;
  /** True while a beat is on screen — useful to hold a nav transition. */
  playing: boolean;
}

export function useXpAward(): UseXpAward {
  const [event, setEvent] = useState<(XpAwardEvent & { id: number }) | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useReducedMotion();

  const fire = useCallback(
    (e: XpAwardEvent) => {
      seq.current += 1;
      setEvent({ ...e, id: seq.current });
    },
    []
  );

  const crossing =
    event?.xpBefore != null
      ? beltCrossing(event.xpBefore, event.xpAfter ?? event.xpBefore + event.amount)
      : null;

  // The beat's total length: the chip alone, or the chip plus the belt ceremony.
  useEffect(() => {
    if (!event) return;
    const ms = reduce ? 400 : crossing ? 2600 : CHIP_MS + 100;
    timer.current = setTimeout(() => setEvent(null), ms);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [event, crossing, reduce]);

  const overlay = (
    <AnimatePresence>
      {event ? (
        <div key={event.id} className="pointer-events-none absolute inset-0 z-30">
          <XpAwardChip amount={event.amount} reason={event.reason} />
          {crossing ? (
            <BeltCrossPop
              beltKey={crossing.rank.belt.key}
              degree={crossing.rank.degree}
              label={crossing.newBelt ? `${crossing.rank.belt.name} Belt` : crossing.rank.label}
            />
          ) : null}
        </div>
      ) : null}
    </AnimatePresence>
  );

  return { fire, overlay, playing: !!event };
}

/**
 * The whole moment as one drop-in: the level object's bar and figures, wired to
 * the award. Surfaces that already own their own layout use `useXpAward` and
 * `XpAwardBar` directly instead.
 */
export function XpAwardMeter({
  xp,
  className = "",
}: {
  xp: number;
  className?: string;
}) {
  const lp = levelProgress(xp);
  return (
    <div className={`relative ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-gold-700">
          Level {lp.current.level} · {lp.current.name}
        </p>
        <span className="font-mono text-[11px] font-bold tabular-nums text-gold-700">
          <CountUp value={xp} /> XP
        </span>
      </div>
      <XpAwardBar pct={lp.pct} className="mt-3" />
    </div>
  );
}

export default useXpAward;
