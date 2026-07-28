"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { KIND_GLYPH, MonoEyebrow, warmFieldStyle } from "@/components/learn/kit";

/* ══════════════════════════════════════════════════════════════════════════
   LEARN PATH — board 20 (`light-r3-*` / `dark-r3-*`, "20 LEARN · PATH").

   Built to the mockup, node for node:
     · a dotted sand strand (stroke-width 4, dasharray 1 10, round caps) that
       winds centre → left → centre → right;
     · 58px accent bubbles with the toy bevel (`box-shadow: 0 4px 0`) for what
       you finished, carrying the board's own ✓ glyph;
     · a 70px ★ bubble with a pinging ring for where you are standing, its
       label in a white pill;
     · white 2px-hairline bubbles with the sand bevel for what is ahead —
       🔒 for a drip/tier lock, 🏆 for a unit test;
     · off-strand 46px rounded-square tiles for the side objects (the board's
       "XP chest" and "Motion recap"), which we drive off the REAL
       `lessons.node_kind` values game / mission rather than inventing props.

   Every node is a real `lessons` row; its state comes from `lesson_progress`
   and its glyph from `lessons.node_kind` (migration 162). A locked node is
   DRAWN, never hidden — a drip lock is information.

   GEOMETRY: the swing is a fraction of the MEASURED width, so the connector
   and the nodes are computed from one source and cannot drift at 390px. The
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

const NODE = 58;
const CURRENT = 70;
const ASIDE = 46;
const STEP_Y = 116;
const LABEL_ROOM = 52;
/** The winding cycle: centre · left · centre · right. */
const SWING = [0, -1, 0, 1];
/** Horizontal swing as a fraction of the strand's width. */
const AMP = 0.22;
/** Side objects sit off the strand entirely, near the edges. */
const ASIDE_X = [0.82, 0.17];

const STATE_LABEL: Record<PathNodeState, string> = {
  done: "Completed",
  current: "Pick up here",
  open: "Not started",
  locked: "Locked",
};

/** game / mission nodes are the board's off-strand tiles. */
function isAside(kind: PathNodeKind): boolean {
  return kind === "game" || kind === "mission";
}

interface Placed {
  node: PathNode;
  /** Horizontal position as a fraction of the strand width. */
  fx: number;
  /** Vertical centre in px. */
  y: number;
  aside: boolean;
  /** 1-based position among on-strand nodes (drives the numeral). */
  seq: number;
}

function place(nodes: PathNode[]): Placed[] {
  let strandSeq = 0;
  let asideSeq = 0;
  return nodes.map((node, i) => {
    const aside = isAside(node.kind);
    let fx: number;
    let seq = 0;
    if (aside) {
      fx = ASIDE_X[asideSeq % ASIDE_X.length];
      asideSeq += 1;
    } else {
      fx = 0.5 + SWING[strandSeq % SWING.length] * AMP;
      strandSeq += 1;
      seq = strandSeq;
    }
    return { node, fx, y: CURRENT / 2 + i * STEP_Y, aside, seq };
  });
}

/** Smooth cubic between two points on the strand. */
function segment(x0: number, y0: number, x1: number, y1: number): string {
  const k = (y1 - y0) * 0.5;
  return `C ${x0.toFixed(1)} ${(y0 + k).toFixed(1)}, ${x1.toFixed(1)} ${(y1 - k).toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
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

  const placed = place(nodes);
  const height = CURRENT + (nodes.length - 1) * STEP_Y + LABEL_ROOM;
  const strand = placed.filter((p) => !p.aside);

  let d = "";
  if (width > 0 && strand.length > 1) {
    d = `M ${(strand[0].fx * width).toFixed(1)} ${strand[0].y.toFixed(1)}`;
    for (let i = 0; i < strand.length - 1; i++) {
      d += ` ${segment(
        strand[i].fx * width,
        strand[i].y,
        strand[i + 1].fx * width,
        strand[i + 1].y
      )}`;
    }
  }

  return (
    <div ref={wrapRef} className={`relative mx-auto w-full max-w-[420px] ${className}`}>
      {/* Decoration only — it waits for the measurement rather than drawing at a
          guessed width and snapping. The nodes never wait: they place off
          percentages, so the list is correct on the first paint. */}
      {d && (
        <svg
          aria-hidden
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="pointer-events-none absolute left-0 top-0"
        >
          <path
            d={d}
            fill="none"
            stroke="var(--sand)"
            strokeWidth={4}
            strokeDasharray="1 10"
            strokeLinecap="round"
          />
        </svg>
      )}

      <ol className="relative" style={{ height }} aria-label={ariaLabel}>
        {placed.map((p) => (
          <li
            key={p.node.id}
            className="absolute w-[136px] text-center"
            style={{
              left: `calc(${(p.fx * 100).toFixed(2)}% - 68px)`,
              top: p.y - (p.node.state === "current" ? CURRENT : NODE) / 2,
            }}
          >
            {p.aside ? <AsideTile node={p.node} /> : <StrandNode node={p.node} seq={p.seq} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── The bubble ───────────────────────────────────────────────────────────
   Board: 58px disc, `box-shadow: 0 4px 0` bevel, emoji glyph. The accent fill
   is theme-invariant, so the glyph on it is the board's near-black in BOTH
   themes (which is exactly what the dark twin draws). */

function StrandNode({ node, seq }: { node: PathNode; seq: number }) {
  const { state, kind } = node;
  const filled = state === "done" || state === "current";
  const current = state === "current";
  const size = current ? CURRENT : NODE;

  const glyph =
    state === "done"
      ? "✓"
      : current
        ? "★"
        : kind !== "lesson"
          ? KIND_GLYPH[kind]
          : state === "locked"
            ? "🔒"
            : String(seq).padStart(2, "0");

  const disc = (
    <span
      className="relative mx-auto block"
      style={{ width: size, height: size }}
    >
      {current && (
        <span
          aria-hidden
          className="absolute -inset-[7px] rounded-full border-[2.5px] motion-safe:animate-ping"
          style={{ borderColor: "color-mix(in srgb, var(--accent-solid) 50%, transparent)" }}
        />
      )}
      <span
        className={`relative grid h-full w-full place-items-center rounded-full ${
          filled ? "text-[#1A1614]" : "text-soft"
        } ${state === "locked" ? "opacity-90" : ""}`}
        style={
          filled
            ? {
                background: "var(--accent-solid)",
                boxShadow: "0 4px 0 color-mix(in srgb, var(--accent-solid) 68%, #000)",
              }
            : {
                background: "var(--card)",
                border: "2px solid var(--sand)",
                boxShadow: "0 4px 0 color-mix(in srgb, var(--sand) 88%, #000)",
              }
        }
      >
        <span
          aria-hidden
          className={
            state === "done" || current
              ? "font-display font-extrabold"
              : kind === "lesson" && state !== "locked"
                ? "font-mono font-semibold tabular-nums"
                : ""
          }
          style={{ fontSize: current ? 26 : state === "done" ? 22 : 18 }}
        >
          {glyph}
        </span>
      </span>
    </span>
  );

  const label = current ? (
    <span className="mt-[7px] inline-block max-w-full truncate rounded-[10px] border border-sand bg-card px-2.5 py-[3px] font-display text-[11px] font-bold text-ink">
      {node.title}
    </span>
  ) : (
    <span className="mt-[5px] line-clamp-2 block text-[10.5px] font-semibold leading-tight text-soft">
      {node.title}
    </span>
  );

  const meta = node.meta ? (
    <span className="mt-0.5 block font-mono text-[9.5px] tabular-nums text-soft">
      {node.meta}
    </span>
  ) : null;

  const srState = <span className="sr-only">, {STATE_LABEL[state]}</span>;

  if (!node.href) {
    return (
      <div aria-disabled className="block">
        {disc}
        {label}
        {meta}
        {srState}
      </div>
    );
  }

  return (
    <Link href={node.href} className="f0-press f0-focus block rounded-xl">
      {disc}
      {label}
      {meta}
      {srState}
    </Link>
  );
}

/* ── The side object ──────────────────────────────────────────────────────
   Board 20's "XP chest" / "Motion recap": a 46px rounded square off the
   strand. Drawn only for the node_kinds that really are side quests. */

function AsideTile({ node }: { node: PathNode }) {
  const tile = (
    <span
      className="mx-auto grid place-items-center rounded-xl"
      style={{
        width: ASIDE,
        height: ASIDE,
        background: "var(--card)",
        border: `1.5px solid ${
          node.state === "locked"
            ? "var(--sand)"
            : "color-mix(in srgb, var(--accent-solid) 30%, var(--sand))"
        }`,
      }}
    >
      <span aria-hidden style={{ fontSize: 18 }}>
        {node.state === "locked" ? "🔒" : KIND_GLYPH[node.kind]}
      </span>
    </span>
  );

  const body = (
    <>
      {tile}
      <span className="mt-1 line-clamp-2 block text-[9px] leading-tight text-soft">
        {node.title}
      </span>
      <span className="sr-only">, {STATE_LABEL[node.state]}</span>
    </>
  );

  if (!node.href) return <div aria-disabled className="block">{body}</div>;
  return (
    <Link href={node.href} className="f0-press f0-focus block rounded-xl">
      {body}
    </Link>
  );
}

/* ── Unit band ────────────────────────────────────────────────────────────
   Board 20's warm header band: mono "UNIT 2 · MARKETS 101", the unit title,
   and a pill on the right. Replaces the old hairline unit head. */

export function PathUnitBand({
  index,
  title,
  eyebrow,
  done,
  total,
  href,
  action,
}: {
  index: number;
  title: string;
  eyebrow?: string;
  done: number;
  total: number;
  href?: string;
  action?: React.ReactNode;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <MonoEyebrow>
          Unit {index}
          {eyebrow ? ` · ${eyebrow}` : ""}
        </MonoEyebrow>
        <p className="mt-[3px] truncate font-display text-[16px] font-extrabold text-ink">
          {title}
        </p>
      </div>
      {action ?? (
        <span className="shrink-0 rounded-[14px] border border-[color-mix(in_srgb,var(--ink)_14%,transparent)] bg-[color-mix(in_srgb,var(--card)_55%,transparent)] px-3 py-1.5 font-mono text-[11px] font-semibold tabular-nums text-ink">
          {done}/{total}
        </span>
      )}
    </>
  );

  const className =
    "flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-transform active:scale-[0.995]";

  if (href) {
    return (
      <Link href={href} className={`${className} f0-focus`} style={warmFieldStyle()}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={className} style={warmFieldStyle()}>
      {inner}
    </div>
  );
}

/* ── Path skeleton ────────────────────────────────────────────────────────
   Loading is NOT the founding state: this draws the strand's silhouette while
   the fetch is in flight, so an empty path never flashes. */
export function LearnPathSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mx-auto w-full max-w-[420px] animate-pulse" aria-hidden>
      <ol
        className="relative"
        style={{ height: CURRENT + (count - 1) * STEP_Y + LABEL_ROOM }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <li
            key={i}
            className="absolute w-[136px] text-center"
            style={{
              left: `calc(${((0.5 + SWING[i % SWING.length] * AMP) * 100).toFixed(2)}% - 68px)`,
              top: i * STEP_Y,
            }}
          >
            <span
              className="mx-auto block rounded-full bg-sand/60"
              style={{ width: NODE, height: NODE }}
            />
            <span className="mx-auto mt-[7px] block h-3 w-20 rounded bg-sand/40" />
          </li>
        ))}
      </ol>
    </div>
  );
}
