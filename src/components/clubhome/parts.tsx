"use client";

import { useId } from "react";

/**
 * ClubHome — the last shared part still standing.
 *
 * This file used to carry the v2 section vocabulary: a `Card` generic container,
 * a `CardHead`, status `Badge`s, a two-segment `Donut`, a chart `Thumb`, a
 * `CountUp`, a `SectionLabel`, a `LiveDot`, a `Delta` chip and the `clubFeedback`
 * toasts. Canvas v2 (M1) retired the nine section components that consumed them
 * — Home is now composed from the L0 primitives and the f0 surface vocabulary —
 * and `Card` in particular was the exact "generic card container" the brand
 * register bans, sitting in the lane's own shared layer where any new section
 * would have reached for it first.
 *
 * `Spark` survives because it is not chrome: it is a data mark, and the club
 * carousel on /discover still draws one. Everything else went with its callers.
 */

/* ── Inline sparkline — fully saturated GRADIENT stroke + draw-in on mount ─── */
export function Spark({
  series,
  tone = "volt",
  width = 96,
  height = 34,
  className = "",
}: {
  series: number[];
  tone?: "volt" | "teal" | "up" | "down" | "flat";
  width?: number;
  height?: number;
  className?: string;
}) {
  // SSR-safe stable gradient id (useId agrees between server + client; strip the
  // colons React emits so it's valid inside url(#…)).
  const gid = `spk-${useId().replace(/:/g, "")}`;

  if (!series || series.length < 2) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (series.length - 1);
  const pts = series.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // gradient endpoints per tone — volt→amber is the signature "alive" stroke
  const [c0, c1] =
    tone === "teal" ? ["var(--color-teal-400)", "var(--color-teal-600)"] :
    tone === "down" ? ["var(--color-red-500)", "#F87171"] :
    tone === "flat" ? ["var(--color-midnight-500)", "var(--color-midnight-400)"] :
    ["var(--color-volt-600)", "#FFB020"];
  const solid = tone === "teal" ? "var(--color-teal-500)" : tone === "down" ? "var(--color-red-500)" : tone === "flat" ? "var(--color-midnight-500)" : "var(--color-volt-500)";
  const last = pts[pts.length - 1].split(",");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
      fill="none"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={c0} />
          <stop offset="100%" stopColor={c1} />
        </linearGradient>
      </defs>
      <polyline
        className="club-spark-line"
        points={pts.join(" ")}
        pathLength={1}
        stroke={`url(#${gid})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={solid} />
    </svg>
  );
}
