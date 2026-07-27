"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Flag, Gamepad2, Lock, Play, Target, Trophy } from "lucide-react";

/* ══════════════════════════════════════════════════════════════════════════
   LEARN PATH — the journey visual (canvas App 20).

   A winding strand of nodes: what you finished, where you are, what is still
   ahead. It is NOT decoration — every node is a real `lessons` row, its state
   comes from `lesson_progress`, and its glyph comes from `lessons.node_kind`
   (migration 162: lesson · game · challenge · boss · mission), a column that
   existed in the schema and had never been rendered anywhere.

   WHY A DRAWN PATH AND NOT A LIST: a list answers "what is next"; the strand
   answers "how far in am I", which is the question a 40-lesson program actually
   raises. The ledger index still exists one level up — this replaces the
   accordion, not the index.

   COLOUR LAW: the strand behind you is `--accent-solid` (brand + progress, gold
   in Family, orange in Club) and the strand ahead is a sand hairline. No green
   for "done" — green is price. No purple. Completion is the accent fill plus a
   mark, so it survives colour being stripped.

   ADULT-FIRST: the canvas draws 58px emoji bubbles with a toy bevel
   (`box-shadow: 0 4px 0`). Ours are flat discs with a real icon set and a mono
   numeral — the same information, read as a program rather than a game board.

   GEOMETRY: the swing is a fraction of the MEASURED width, so the connector and
   the nodes are computed from one source and cannot drift apart at 390px. The
   SVG is aria-hidden; the semantics live in the <ol> of links.
   ══════════════════════════════════════════════════════════════════════════ */

export type PathNodeKind = "lesson" | "game" | "challenge" | "boss" | "mission";

/** done = finished · current = pick this up · open = reachable, untouched ·
 *  locked = drip / tier gated (still drawn, never hidden). */
export type PathNodeState = "done" | "current" | "open" | "locked";

export interface PathNode {
  id: string;
  title: string;
  /** null when the node cannot be opened (locked). */
  href: string | null;
  kind: PathNodeKind;
  state: PathNodeState;
  /** Duration, unlock copy, XP — one short line under the label. */
  meta?: string;
}

const NODE = 54;
const STEP_Y = 118;
/** The winding cycle: centre · left · centre · right. */
const SWING = [0, -1, 0, 1];
/** Horizontal swing as a fraction of the strand's width. Nodes place with this
 *  as a PERCENTAGE and the connector with it as pixels, off one measurement, so
 *  the two can never disagree — and the nodes need no measurement to be right. */
const AMP = 0.22;

const KIND_ICON: Record<PathNodeKind, typeof Play> = {
  lesson: Play,
  game: Gamepad2,
  challenge: Flag,
  boss: Trophy,
  mission: Target,
};

const STATE_LABEL: Record<PathNodeState, string> = {
  done: "Completed",
  current: "Pick up here",
  open: "Not started",
  locked: "Locked",
};

/** Left edge of a 136px-wide node cell, centred on the strand at row `i`.
 *  Signed explicitly because `calc(50% + -22%)` is not reliably parsed. */
function swingLeft(i: number): string {
  const swing = SWING[i % SWING.length] * AMP * 100;
  return `calc(50% ${swing < 0 ? "-" : "+"} ${Math.abs(swing)}% - 68px)`;
}

/** Smooth cubic between two points on the strand. */
function segment(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): string {
  const k = (y1 - y0) * 0.5;
  return `C ${x0.toFixed(1)} ${(y0 + k).toFixed(1)}, ${x1.toFixed(1)} ${(y1 - k).toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

function strand(
  points: { x: number; y: number }[],
  from: number,
  to: number
): string {
  if (to <= from) return "";
  let d = `M ${points[from].x.toFixed(1)} ${points[from].y.toFixed(1)}`;
  for (let i = from; i < to; i++) {
    d += ` ${segment(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y)}`;
  }
  return d;
}

export default function LearnPath({
  nodes,
  ariaLabel,
  className = "",
}: {
  nodes: PathNode[];
  ariaLabel: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = (w: number) => setWidth(w > 0 ? w : 0);
    apply(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => apply(entries[0]?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (nodes.length === 0) return null;

  const height = NODE + (nodes.length - 1) * STEP_Y + 46;
  const points = nodes.map((_, i) => ({
    x: width / 2 + SWING[i % SWING.length] * AMP * width,
    y: NODE / 2 + i * STEP_Y,
  }));

  // The strand behind you is accent; ahead of you it is a hairline. "Behind"
  // ends at the current node, or covers everything when the path is finished.
  const currentIdx = nodes.findIndex((n) => n.state === "current");
  const walked =
    currentIdx >= 0 ? currentIdx : nodes.every((n) => n.state === "done") ? nodes.length - 1 : 0;

  return (
    <div ref={wrapRef} className={`relative mx-auto w-full max-w-[420px] ${className}`}>
      {/* Decoration only — it waits for the measurement rather than drawing at a
          guessed width and snapping. The nodes never wait: they place off
          percentages, so the list is correct on the first paint. */}
      {width > 0 && (
        <svg
          aria-hidden
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="pointer-events-none absolute left-0 top-0"
        >
          <path
            d={strand(points, 0, nodes.length - 1)}
            fill="none"
            stroke="var(--sand)"
            strokeWidth={4}
            strokeDasharray="1 10"
            strokeLinecap="round"
          />
          {walked > 0 && (
            <path
              d={strand(points, 0, walked)}
              fill="none"
              stroke="var(--accent-solid)"
              strokeWidth={4}
              strokeDasharray="1 10"
              strokeLinecap="round"
            />
          )}
        </svg>
      )}

      <ol className="relative" style={{ height }} aria-label={ariaLabel}>
        {nodes.map((node, i) => (
          <li
            key={node.id}
            className="absolute w-[136px] text-center"
            style={{
              left: swingLeft(i),
              top: points[i].y - NODE / 2,
            }}
          >
            <PathNodeMark node={node} index={i} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function PathNodeMark({ node, index }: { node: PathNode; index: number }) {
  const { state, kind } = node;
  const filled = state === "done" || state === "current";
  const Icon = KIND_ICON[kind];

  const disc = (
    <span className="relative mx-auto block h-[54px] w-[54px]">
      {state === "current" && (
        <span
          aria-hidden
          className="absolute -inset-[6px] rounded-full border-2 border-accent/35"
        />
      )}
      <span
        className={`grid h-full w-full place-items-center rounded-full ${
          filled
            ? "bg-accent text-night-950"
            : state === "locked"
              ? "f0-frame text-soft opacity-70"
              : "f0-frame text-soft"
        }`}
      >
        {state === "done" ? (
          <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        ) : state === "locked" ? (
          <Lock className="h-4 w-4" aria-hidden />
        ) : kind === "lesson" && state === "open" ? (
          <span className="font-mono text-[13px] font-semibold tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
        ) : (
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        )}
      </span>
    </span>
  );

  const label = (
    <>
      <span
        className={`mt-2.5 line-clamp-2 block text-[12px] leading-tight ${
          state === "current"
            ? "font-display font-extrabold text-ink"
            : state === "done"
              ? "text-ink"
              : "text-soft"
        }`}
      >
        {node.title}
      </span>
      {node.meta && (
        <span className="mt-0.5 block font-mono text-[10.5px] tabular-nums text-soft">
          {node.meta}
        </span>
      )}
    </>
  );

  const srState = <span className="sr-only">, {STATE_LABEL[state]}</span>;

  if (!node.href) {
    return (
      <div aria-disabled className="block">
        {disc}
        {label}
        {srState}
      </div>
    );
  }

  return (
    <Link href={node.href} className="f0-press f0-focus block rounded-xl">
      {disc}
      {label}
      {srState}
    </Link>
  );
}

/* ── Unit head ────────────────────────────────────────────────────────────
   The strand is grouped by unit (a module). A hairline, a mono index, the
   title, and the honest count — never a card header. */
export function PathUnitHead({
  index,
  title,
  done,
  total,
  eyebrow,
}: {
  index: number;
  title: string;
  done: number;
  total: number;
  eyebrow?: string;
}) {
  return (
    <div className="f0-rule-top flex items-baseline gap-4 pt-4">
      <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-soft">
        {String(index).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1">
        {eyebrow && (
          <span className="block text-eyebrow font-display font-bold uppercase text-gold-700">
            {eyebrow}
          </span>
        )}
        <span className="block font-display text-[16px] font-bold leading-snug text-ink">
          {title}
        </span>
      </span>
      <span className="shrink-0 font-mono text-[12px] tabular-nums text-soft">
        {done}/{total}
      </span>
    </div>
  );
}

/* ── Path skeleton ────────────────────────────────────────────────────────
   Loading is NOT the founding state (plan §0.4): this draws the strand's
   silhouette while the fetch is in flight, so an empty path never flashes. */
export function LearnPathSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mx-auto w-full max-w-[420px] animate-pulse" aria-hidden>
      <ol className="relative" style={{ height: NODE + (count - 1) * STEP_Y + 46 }}>
        {Array.from({ length: count }).map((_, i) => (
          <li
            key={i}
            className="absolute w-[136px] text-center"
            style={{ left: swingLeft(i), top: i * STEP_Y }}
          >
            <span className="mx-auto block h-[54px] w-[54px] rounded-full bg-sand/60" />
            <span className="mx-auto mt-2.5 block h-3 w-20 rounded bg-sand/40" />
          </li>
        ))}
      </ol>
    </div>
  );
}
