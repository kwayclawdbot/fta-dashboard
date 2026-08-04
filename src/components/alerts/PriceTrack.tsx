"use client";

import { useMemo } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   PRICE TRACK — the plan, drawn as one integrated horizontal price lane.

   This is the centrepiece of the Kai Watch pick card (owner canvas v5). Instead
   of a stack of "Entry / Level / Invalid" chips, the four numbers that DEFINE a
   setup are placed on a single geometric track, positioned by their REAL price:

        STOP ──[ risk ]── ENTRY ──[ reward ]── ●LIVE ─── TARGET

   • the risk leg (stop→entry) is washed red, the reward leg (entry→target) green
     — colour law: red/green is PRICE here, nothing else on the card borrows it;
   • a pulsing "you are here" LIVE pill floats above the lane at the live price;
   • the markers sit at their TRUE geometric position and never move — only the
     text LABELS below de-collide (see `spread`), which is the mobile fix: when
     STOP and ENTRY sit close, their labels used to overlap into an unreadable
     smear. The nudge keeps every label legible without lying about a price.

   Direction-agnostic: zones are computed from the min/max of each leg, so a
   SHORT (stop above, target below) paints its risk/reward on the correct sides
   with no special-casing.
   ══════════════════════════════════════════════════════════════════════════ */

const PAD = 6; // % inset so the edge markers/labels don't clip the card

function fmt(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * De-overlap a set of label anchors along a 1-D axis, preserving order.
 * Markers keep their true positions; only the text below is spread so that
 * adjacent labels never sit closer than `minGap` percent, clamped to [lo,hi].
 * This is the "STOP/ENTRY labels collide when levels sit close" fix.
 */
function spread(positions: number[], minGap: number, lo: number, hi: number): number[] {
  const out = positions.slice();
  // Forward pass — push each label right until it clears the previous one.
  for (let i = 1; i < out.length; i++) {
    if (out[i] < out[i - 1] + minGap) out[i] = out[i - 1] + minGap;
  }
  // If the cluster ran past the right edge, slide the whole thing left.
  const over = out[out.length - 1] - hi;
  if (over > 0) for (let i = 0; i < out.length; i++) out[i] -= over;
  // Clamp the left edge, then re-run forward so we never re-collide.
  if (out[0] < lo) {
    out[0] = lo;
    for (let i = 1; i < out.length; i++) {
      if (out[i] < out[i - 1] + minGap) out[i] = out[i - 1] + minGap;
    }
  }
  return out;
}

export interface PriceTrackProps {
  stop: number;
  entry: number;
  live: number;
  target: number;
  /** long/short/watch — only affects the accessible summary wording. */
  direction?: string;
  className?: string;
}

export default function PriceTrack({
  stop,
  entry,
  live,
  target,
  direction = "long",
  className = "",
}: PriceTrackProps) {
  const geo = useMemo(() => {
    const lo = Math.min(stop, target);
    const hi = Math.max(stop, target);
    const span = hi - lo || 1;
    const pos = (p: number) => PAD + ((p - lo) / span) * (100 - 2 * PAD);

    const pStop = pos(stop);
    const pEntry = pos(entry);
    const pLive = Math.max(0, Math.min(100, pos(live)));
    const pTarget = pos(target);

    const riskL = Math.min(pStop, pEntry);
    const riskR = Math.max(pStop, pEntry);
    const rewL = Math.min(pEntry, pTarget);
    const rewR = Math.max(pEntry, pTarget);

    // Labels: stop / entry / target ordered by their on-track position, spread
    // so close levels stay readable, then mapped back to each named level.
    const anchors = [
      { key: "stop", pos: pStop },
      { key: "entry", pos: pEntry },
      { key: "target", pos: pTarget },
    ].sort((a, b) => a.pos - b.pos);
    const spreadPos = spread(anchors.map((a) => a.pos), 21, 11, 89);
    const labelPos: Record<string, number> = {};
    anchors.forEach((a, i) => (labelPos[a.key] = spreadPos[i]));

    return {
      pStop,
      pEntry,
      pLive,
      pTarget,
      riskL,
      riskR,
      rewL,
      rewR,
      pPill: Math.max(13, Math.min(87, pLive)),
      labelPos,
    };
  }, [stop, entry, live, target]);

  const summary = `Plan for a ${direction} setup: stop ${fmt(stop)}, entry ${fmt(
    entry
  )}, live ${fmt(live)}, target ${fmt(target)}.`;

  return (
    <div className={`relative ${className}`} role="img" aria-label={summary}>
      {/* floating LIVE "you are here" pill */}
      <div className="relative mb-3 h-8">
        <div
          className="absolute top-0 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-white"
          style={{
            left: `${geo.pPill}%`,
            background: "var(--color-volt-500)",
            boxShadow: "0 6px 18px -6px color-mix(in srgb, var(--color-volt-500) 75%, transparent)",
          }}
        >
          <span className="relative flex h-1.5 w-1.5 items-center justify-center" aria-hidden>
            <span className="absolute inline-flex h-1.5 w-1.5 rounded-full bg-white/70 motion-safe:animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <span className="text-[8.5px] font-extrabold uppercase tracking-[0.08em] opacity-90">
            Live
          </span>
          <span className="font-mono text-[12px] font-extrabold tabular-nums tracking-[-0.02em]">
            {fmt(live)}
          </span>
          <span
            aria-hidden
            className="absolute left-1/2 top-full -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "6px solid var(--color-volt-500)",
            }}
          />
        </div>
      </div>

      {/* the lane */}
      <div className="relative h-3 rounded-full bg-sand">
        <span
          className="absolute inset-y-0 rounded-full"
          style={{
            left: `${geo.riskL}%`,
            width: `${geo.riskR - geo.riskL}%`,
            background:
              "linear-gradient(90deg, var(--color-price-down) 0%, color-mix(in srgb, var(--color-price-down) 45%, transparent) 100%)",
          }}
        />
        <span
          className="absolute inset-y-0 rounded-full"
          style={{
            left: `${geo.rewL}%`,
            width: `${geo.rewR - geo.rewL}%`,
            background:
              "linear-gradient(90deg, color-mix(in srgb, var(--color-price-up) 45%, transparent) 0%, var(--color-price-up) 100%)",
          }}
        />

        {/* stop — a short vertical bar */}
        <span
          className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-[2px]"
          style={{ left: `${geo.pStop}%`, background: "var(--color-price-down)" }}
        />
        {/* target — a triangle */}
        <span
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${geo.pTarget}%`,
            width: 0,
            height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderBottom: "12px solid var(--color-price-up)",
          }}
        />
        {/* entry — a diamond outlined in ink */}
        <span
          className="absolute top-1/2 h-[15px] w-[15px] bg-card"
          style={{
            left: `${geo.pEntry}%`,
            transform: "translate(-50%,-50%) rotate(45deg)",
            border: "3px solid var(--color-ink)",
            borderRadius: "2px",
          }}
        />
        {/* live — the pulsing volt dot */}
        <span
          className="absolute top-1/2 z-10 grid h-4 w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-card"
          style={{
            left: `${geo.pLive}%`,
            border: "3px solid var(--color-volt-500)",
            boxShadow: "0 2px 10px -2px color-mix(in srgb, var(--color-volt-500) 80%, transparent)",
          }}
        >
          <span
            aria-hidden
            className="absolute inset-[-6px] rounded-full opacity-50 motion-safe:animate-ping"
            style={{ border: "2px solid var(--color-volt-500)" }}
          />
        </span>
      </div>

      {/* risk / reward braces */}
      <div className="relative mt-1.5 h-4">
        <span
          className="absolute top-0 h-[7px] rounded-b-[6px] border-x border-b"
          style={{
            left: `${geo.riskL}%`,
            width: `${geo.riskR - geo.riskL}%`,
            borderColor: "var(--color-price-down)",
          }}
        />
        <span
          className="absolute top-0 h-[7px] rounded-b-[6px] border-x border-b"
          style={{
            left: `${geo.rewL}%`,
            width: `${geo.rewR - geo.rewL}%`,
            borderColor: "var(--color-price-up)",
          }}
        />
        <span
          className="absolute top-[9px] -translate-x-1/2 font-mono text-[8.5px] font-bold uppercase tracking-[0.09em] text-price-down"
          style={{ left: `${(geo.riskL + geo.riskR) / 2}%` }}
        >
          Risk
        </span>
        <span
          className="absolute top-[9px] -translate-x-1/2 font-mono text-[8.5px] font-bold uppercase tracking-[0.09em] text-price-up"
          style={{ left: `${(geo.rewL + geo.rewR) / 2}%` }}
        >
          Reward
        </span>
      </div>

      {/* de-collided value labels */}
      <div className="relative mt-4 h-9">
        <TrackLabel left={geo.labelPos.stop} k="Stop" v={fmt(stop)} tone="down" />
        <TrackLabel left={geo.labelPos.entry} k="Entry" v={fmt(entry)} tone="entry" />
        <TrackLabel left={geo.labelPos.target} k="Target" v={fmt(target)} tone="up" />
      </div>
    </div>
  );
}

function TrackLabel({
  left,
  k,
  v,
  tone,
}: {
  left: number;
  k: string;
  v: string;
  tone: "up" | "down" | "entry";
}) {
  const kCls = tone === "entry" ? "text-ink" : "text-soft/80";
  const vCls =
    tone === "up" ? "text-price-up" : tone === "down" ? "text-price-down" : "text-ink";
  return (
    <div
      className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-0.5 whitespace-nowrap text-center leading-none"
      style={{ left: `${left}%` }}
    >
      <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.08em] ${kCls}`}>
        {k}
      </span>
      <span className={`font-mono text-[14px] font-extrabold tabular-nums tracking-[-0.02em] ${vCls}`}>
        {v}
      </span>
    </div>
  );
}
