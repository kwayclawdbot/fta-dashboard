"use client";

import { useId, useState } from "react";
import { m, useReducedMotion } from "@/lib/motion";
import type { LessonSceneSpec } from "@/lib/learn/schema";
import { EASE_OUT } from "./ui";

/* ══════════════════════════════════════════════════════════════════════════
   LESSON SCENE — the micro-lesson figure, board 21 (`light-r2-c1` +
   `light-r3-c1`).

   The board draws it as a PANEL, so it is a panel: radius 18, a hairline, and
   a lime → cream → warm diagonal wash, with the mono "animated scene" caption
   riding an accent dot in the top-left, the tape across the middle, the event
   chip at the pivot, the outcome chip at the end, and the accent play badge in
   the centre.

   THE BADGE IS REAL. There is no clip to stream, so it does what the board
   promises in the only honest way available: it plays the tape — the drawing
   wipes in left to right — and it can be played again. Under
   prefers-reduced-motion the tape is simply there.

   The two legs are real price movement, so they take text-price-up /
   text-price-down. Their direction is COMPUTED from the authored points, so a
   scene can never be drawn green while falling. The pivot marker is gold: it
   annotates, it does not price.

   `preserveAspectRatio="none"` lets the figure stretch to any column width;
   `vectorEffect="non-scaling-stroke"` is what keeps the stroke honest under
   that stretch. Labels ride an HTML overlay on the same percentage grid rather
   than inside the SVG, so type is never scaled with it.
   ══════════════════════════════════════════════════════════════════════════ */

const TOP = 12;
const BOTTOM = 88;

function px(i: number, n: number): number {
  return n <= 1 ? 50 : (i / (n - 1)) * 100;
}
function py(v: number): number {
  const clamped = Math.max(0, Math.min(1, v));
  return BOTTOM - clamped * (BOTTOM - TOP);
}

function polyline(points: number[], from: number, to: number, n: number): string {
  const parts: string[] = [];
  for (let i = from; i <= to; i++) {
    parts.push(`${px(i, n).toFixed(2)},${py(points[i]).toFixed(2)}`);
  }
  return parts.join(" ");
}

export default function LessonScene({ scene }: { scene: LessonSceneSpec }) {
  const reduce = useReducedMotion();
  const clipId = useId().replace(/:/g, "");
  const [play, setPlay] = useState(0);

  const pts = scene.points;
  const n = pts.length;
  if (n < 2) return null;

  const pivot = Math.max(0, Math.min(n - 1, scene.eventIndex));
  // Leg direction is read off the drawing, never declared by the author.
  const leadUp = pts[pivot] >= pts[0];
  const tailUp = pts[n - 1] >= pts[pivot];

  const pivotX = px(pivot, n);
  const pivotY = py(pts[pivot]);
  const endY = py(pts[n - 1]);

  return (
    <m.figure
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className="relative mb-4 h-[180px] overflow-hidden rounded-[18px] border border-sand"
      style={{
        background:
          "linear-gradient(140deg, color-mix(in srgb, var(--price-up) 13%, var(--card)) 0%, var(--card) 55%, color-mix(in srgb, var(--accent-solid) 13%, var(--card)) 100%)",
      }}
    >
      {scene.caption && (
        <figcaption className="absolute left-3 top-2.5 z-10 flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-soft">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          {scene.caption}
        </figcaption>
      )}

      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <clipPath id={clipId}>
            {/* The tape wipes in — this IS the play badge's playback. */}
            <m.rect
              key={play}
              x="0"
              y="0"
              height="100"
              initial={reduce ? { width: 100 } : { width: 0 }}
              animate={{ width: 100 }}
              transition={{ duration: 1.1, ease: EASE_OUT }}
            />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <polyline
            points={polyline(pts, 0, pivot, n)}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className={leadUp ? "text-price-up" : "text-price-down"}
          />
          <polyline
            points={polyline(pts, pivot, n - 1, n)}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className={tailUp ? "text-price-up" : "text-price-down"}
          />
        </g>
      </svg>

      {/* The pivot — the moment the question is about. Gold, per the board. */}
      <span
        aria-hidden
        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${pivotX}%`,
          top: `${pivotY}%`,
          background: "color-mix(in srgb, #D99A00 84%, var(--ink))",
        }}
      />

      {scene.eventLabel && (
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap rounded-md bg-[color-mix(in_srgb,var(--card)_85%,transparent)] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em]"
          style={{
            left: `${pivotX}%`,
            top: `calc(${pivotY}% - 26px)`,
            color: "color-mix(in srgb, #D99A00 80%, var(--ink))",
          }}
        >
          {scene.eventLabel}
        </span>
      )}

      {scene.endLabel && (
        <span
          className={`absolute right-2.5 whitespace-nowrap rounded-md bg-[color-mix(in_srgb,var(--card)_85%,transparent)] px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
            tailUp ? "text-price-up" : "text-price-down"
          }`}
          style={{ top: `calc(${endY}% + 10px)` }}
        >
          {scene.endLabel}
        </span>
      )}

      <button
        type="button"
        onClick={() => setPlay((p) => p + 1)}
        aria-label="Play the scene again"
        className="f0-press f0-focus absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
        style={{
          background: "color-mix(in srgb, var(--accent-solid) 90%, transparent)",
          boxShadow: "0 0 18px color-mix(in srgb, var(--accent-solid) 35%, transparent)",
        }}
      >
        <span
          aria-hidden
          className="ml-1 block h-0 w-0"
          style={{
            borderLeft: "13px solid var(--card)",
            borderTop: "8px solid transparent",
            borderBottom: "8px solid transparent",
          }}
        />
      </button>
    </m.figure>
  );
}
