"use client";

import { useEffect, useState } from "react";
import { m, useReducedMotion } from "@/lib/motion";
import type { OrderBookIllustration } from "@/lib/learn/schema";
import { EASE_OUT } from "./ui";

/* ══════════════════════════════════════════════════════════════════════════
   THE ORDER BOOK — the first authored teaching OBJECT (CURRICULUM-OVERVIEW §6).

   Two stacks of resting orders facing each other across a gap, like a ladder
   split down the middle. The best bid and the best ask are the top bar of each
   stack and they are the ONE thing being pointed at, so they alone wear the
   accent. Everything else is ink: structure, not emphasis. The gap is left
   EMPTY and measured with a gold hairline, because gold annotates and never
   prices — the same law LessonScene already follows.

   Drawn, not generated: bar lengths are deliberately uneven off a fixed hand
   table (never Math.random, never Date.now — this must render identically on
   the server and on every repaint). 2px strokes, flat fills, warm palette.

   It is ONE object with THREE states, because the lesson shows the same
   drawing three times and changes one variable each time:
     • `ladder`        — the book at rest (step 2)
     • `walk_up`       — the book being eaten by one big buyer (step 3)
     • `before_after`  — the book rebuilding itself around news (step 4)

   Reuse is the point. This object returns on Day 9 (what a screener filter
   removes) and Day 27 (where the stop goes).
   ══════════════════════════════════════════════════════════════════════════ */

/** Hand-ruled bar lengths, as a fraction of the column. Fixed, never random. */
const HAND: number[] = [0.9, 0.74, 0.84, 0.6, 0.79, 0.67];

const BAR_H = 9;
/** The empty middle. It has to be wide enough that the best bid and the best
 *  ask read as TWO bars with nothing between them — at 46px they merged into
 *  one rule and the whole point of the drawing was lost. */
const GAP = 68;
const GAP_COMPACT = 52;

function handLen(i: number, seed: number): number {
  return HAND[(i + seed) % HAND.length];
}

/* ── one side of the book ─────────────────────────────────────────────── */

function Ladder({
  prices,
  side,
  seed,
  built,
  consumed = -1,
  stagger,
}: {
  prices: string[];
  side: "bid" | "ask";
  seed: number;
  /** Skip the build motion (reduced motion, or an already-settled state). */
  built: boolean;
  /** walk_up only: how many levels have been eaten so far. */
  consumed?: number;
  stagger: number;
}) {
  const isBid = side === "bid";
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[15px]">
      {prices.map((p, i) => {
        const best = i === 0;
        const eaten = consumed >= i;
        const len = handLen(i, seed);
        return (
          <m.div
            key={p}
            className={`flex items-center gap-2 ${
              isBid ? "flex-row-reverse" : "flex-row"
            }`}
            initial={
              built
                ? false
                : { opacity: 0, x: isBid ? 18 : -18 }
            }
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.24,
              // builds OUTWARD from the gap: the spread is the thing that
              // matters, everything else is context arriving after it
              delay: built ? 0 : i * stagger,
              ease: EASE_OUT,
            }}
          >
            <div
              className="min-w-0 flex-1"
              style={{ display: "flex", justifyContent: isBid ? "flex-end" : "flex-start" }}
            >
              <m.span
                aria-hidden
                className="block rounded-[2px]"
                style={{
                  height: BAR_H,
                  border: "2px solid",
                }}
                initial={false}
                animate={{
                  width: `${len * 100}%`,
                  backgroundColor: eaten
                    ? "color-mix(in srgb, var(--soft) 24%, transparent)"
                    : best
                      ? "var(--accent-solid)"
                      : "color-mix(in srgb, var(--ink) 12%, transparent)",
                  borderColor: eaten
                    ? "color-mix(in srgb, var(--soft) 45%, transparent)"
                    : best
                      ? "var(--accent-solid)"
                      : "color-mix(in srgb, var(--ink) 55%, transparent)",
                  opacity: eaten ? 0.55 : 1,
                }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
              />
            </div>
            <span
              className="shrink-0 font-mono text-[10.5px] font-semibold tabular-nums"
              style={{
                color: eaten
                  ? "var(--soft)"
                  : best
                    ? "color-mix(in srgb, var(--accent-solid) 72%, var(--ink))"
                    : "var(--soft)",
                width: 38,
                textAlign: isBid ? "right" : "left",
              }}
            >
              {p}
            </span>
          </m.div>
        );
      })}
    </div>
  );
}

/* ── the whole object ─────────────────────────────────────────────────── */

function Book({
  bids,
  asks,
  spreadLabel,
  seed,
  built,
  consumed,
  label,
  compact = false,
}: {
  bids: string[];
  asks: string[];
  spreadLabel?: string;
  seed: number;
  built: boolean;
  consumed?: number;
  label?: string;
  compact?: boolean;
}) {
  const rows = Math.max(bids.length, asks.length);
  return (
    <div className="min-w-0 flex-1">
      {label && (
        <p className="mb-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
          {label}
        </p>
      )}
      <div className="relative">
        {/* the two facing stacks, with the gap left empty between them */}
        <div className="flex items-start" style={{ gap: compact ? GAP_COMPACT : GAP }}>
          <Ladder
            prices={bids}
            side="bid"
            seed={seed}
            built={built}
            stagger={0.04}
          />
          <Ladder
            prices={asks}
            side="ask"
            seed={seed + 2}
            built={built}
            consumed={consumed ?? -1}
            stagger={0.04}
          />
        </div>

        {/* the spread — a gold hairline measuring the empty middle at the top
            row, drawn LAST because it is the measurement of everything above */}
        <m.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{ top: BAR_H / 2 - 1, width: compact ? GAP_COMPACT : GAP }}
          initial={built ? false : { opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{
            duration: 0.2,
            delay: built ? 0 : rows * 0.04 + 0.18,
            ease: EASE_OUT,
          }}
        >
          <div
            className="relative h-[2px] w-full"
            style={{ background: "color-mix(in srgb, #D99A00 78%, transparent)" }}
          >
            <span
              className="absolute left-0 top-1/2 h-[9px] w-[2px] -translate-y-1/2"
              style={{ background: "color-mix(in srgb, #D99A00 78%, transparent)" }}
            />
            <span
              className="absolute right-0 top-1/2 h-[9px] w-[2px] -translate-y-1/2"
              style={{ background: "color-mix(in srgb, #D99A00 78%, transparent)" }}
            />
          </div>
        </m.div>

        {spreadLabel && (
          <m.span
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-px font-mono text-[8.5px] font-semibold uppercase tracking-[0.12em]"
            style={{
              top: BAR_H + 7,
              background: "var(--paper)",
              color: "color-mix(in srgb, #D99A00 80%, var(--ink))",
            }}
            initial={built ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: built ? 0 : rows * 0.04 + 0.3 }}
          >
            {spreadLabel}
          </m.span>
        )}
      </div>
    </div>
  );
}

export default function OrderBookFigure({
  spec,
  /** walk_up: flip true to play the "one buyer eats the ask side" motion. */
  playWalk = false,
}: {
  spec: OrderBookIllustration;
  playWalk?: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  const [consumed, setConsumed] = useState(-1);
  const [priceStep, setPriceStep] = useState(0);

  const walk = spec.mode === "walk_up";
  const levels = spec.asks.length;

  // The walk-up: each ask level is taken in turn, 180ms to fill, 60ms apart,
  // and the running price above the book climbs with it. The count-up IS the
  // teaching — the learner watches the price rise with no news attached.
  useEffect(() => {
    if (!walk || !playWalk) return;
    if (reduce) {
      setConsumed(levels - 1);
      setPriceStep((spec.walkPrices?.length ?? 1) - 1);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < levels; i++) {
      timers.push(
        setTimeout(() => {
          setConsumed(i);
          // walkPrices[i] is where the price sits once level i has been taken,
          // so the figure and the ladder never disagree.
          setPriceStep(Math.min(i, (spec.walkPrices?.length ?? 1) - 1));
        }, 240 + i * 240)
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [walk, playWalk, reduce, levels, spec.walkPrices?.length]);

  const built = reduce;
  const runningPrice = spec.walkPrices?.[priceStep];

  return (
    <figure className="my-5">
      {walk && spec.walkPrices && spec.walkPrices.length > 0 && (
        <div className="mb-3 flex items-baseline gap-2">
          <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
            Last price
          </span>
          <m.span
            key={runningPrice}
            className="font-display text-[19px] font-extrabold tabular-nums"
            style={{ color: "color-mix(in srgb, var(--accent-solid) 74%, var(--ink))" }}
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            {runningPrice}
          </m.span>
        </div>
      )}

      {spec.mode === "before_after" && spec.after ? (
        <div className="flex flex-col gap-7 sm:flex-row sm:gap-8">
          <Book
            bids={spec.bids}
            asks={spec.asks}
            spreadLabel={spec.spreadLabel}
            seed={0}
            built={built}
            label={spec.beforeLabel ?? "before"}
            compact
          />
          {/* the same drawing, one variable changed — sellers pulled, the
              ladder sits higher, and the gap it leaves behind is wider */}
          <m.div
            className="min-w-0 flex-1"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: reduce ? 0 : 0.2, ease: EASE_OUT }}
          >
            <Book
              bids={spec.after.bids}
              asks={spec.after.asks}
              spreadLabel={spec.spreadLabel}
              seed={1}
              built
              label={spec.after.label ?? "after"}
              compact
            />
          </m.div>
        </div>
      ) : (
        <Book
          bids={spec.bids}
          asks={spec.asks}
          spreadLabel={spec.spreadLabel}
          seed={0}
          built={built}
          consumed={walk ? consumed : -1}
        />
      )}

      {spec.caption && (
        <figcaption className="mt-4 font-mono text-[9.5px] leading-relaxed tracking-[0.06em] text-soft">
          {spec.caption}
        </figcaption>
      )}
    </figure>
  );
}
