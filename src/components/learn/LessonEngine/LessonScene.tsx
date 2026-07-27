"use client";

import { m, useReducedMotion } from "@/lib/motion";
import type { LessonSceneSpec } from "@/lib/learn/schema";
import { EASE_OUT } from "./ui";

/* ══════════════════════════════════════════════════════════════════════════
   LESSON SCENE — the micro-lesson figure (canvas App 21).

   The canvas puts a 12-second animated clip above the question, inside a
   gradient-filled rounded panel. We draw the same idea as a FIGURE: two rules,
   a mono caption, and the tape itself sitting on the paper. No panel, because a
   tinted rounded rectangle around content is exactly the card container the
   register bans — and because the drawing is more legible without a second
   background behind it.

   The two legs are real price movement, so they take text-price-up /
   text-price-down (and never a dark: variant). Their direction is COMPUTED from
   the authored points, so a scene can never be drawn green while falling. The
   pivot marker is the accent: it annotates, it does not price.

   `preserveAspectRatio="none"` lets the figure stretch to any column width;
   `vectorEffect="non-scaling-stroke"` is what keeps the stroke honest under
   that stretch. Labels ride an HTML overlay on the same percentage grid rather
   than inside the SVG, so type is never scaled with it.
   ══════════════════════════════════════════════════════════════════════════ */

const TOP = 8;
const BOTTOM = 92;

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
      className="f0-rule-top f0-rule-bottom mb-6 py-4"
    >
      {scene.caption && (
        <figcaption className="mb-3 flex items-center gap-2 text-eyebrow font-display font-bold uppercase text-soft">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          {scene.caption}
        </figcaption>
      )}

      <div className="relative h-[152px] w-full">
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
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
        </svg>

        {/* The pivot — the moment the question is about. */}
        <span
          aria-hidden
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `${pivotX}%`, top: `${pivotY}%` }}
        />

        {scene.eventLabel && (
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap rounded bg-paper/85 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink"
            style={{ left: `${pivotX}%`, top: `calc(${pivotY}% - 22px)` }}
          >
            {scene.eventLabel}
          </span>
        )}

        {scene.endLabel && (
          <span
            className={`absolute right-0 whitespace-nowrap rounded bg-paper/85 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
              tailUp ? "text-price-up" : "text-price-down"
            }`}
            style={{ top: `calc(${endY}% + 8px)` }}
          >
            {scene.endLabel}
          </span>
        )}
      </div>
    </m.figure>
  );
}
