"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "@/components/ui/Toast";

/**
 * ClubHome v2 — shared editorial primitives. Deliberately NOT card containers:
 * these compose the D1 language (live datelines, hairline rules, big numerals,
 * inline sparks) that the sections build on.
 */

/* ── Contribution feedback (§11) ─────────────────────────────────────────────
   Small confirmations after meaningful actions. Fires the app's existing global
   toast (mounted once in DashboardShell), so any deep child can confirm a
   contribution with one call. Copy is scale-aware where it matters. */
export const clubFeedback = {
  voted: () => toast("Your view was added to Club Sentiment"),
  watched: (ticker: string) => toast(`You strengthened ${ticker}'s signal in the Club`),
  invited: () => toast("You just made the Club smarter"),
  linkCopied: () => toast("Invite link copied", "info"),
  published: (n: number, floorMet: boolean) =>
    toast(
      floorMet
        ? `${n.toLocaleString()} investors will learn from your research`
        : "Your research is live — the Club just got smarter"
    ),
};

/* ── LivePulse dot — pulsing ring + a saturated glow halo ─────────────────── */
export function LiveDot({ tone = "volt" }: { tone?: "volt" | "teal" | "kai" }) {
  const color =
    tone === "teal" ? "bg-teal-400" : tone === "kai" ? "bg-kai-500" : "bg-volt-500";
  const glow =
    tone === "teal" ? "club-livedot-teal" : tone === "kai" ? "club-livedot-kai" : "club-livedot-volt";
  return (
    <span className="relative flex h-2 w-2" aria-hidden>
      <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-70 motion-safe:animate-ping`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color} ${glow}`} />
    </span>
  );
}

/* ── Count-up numeral — animates 0→value on mount, respects reduced motion ── */
export function CountUp({
  value,
  className = "",
  duration = 1100,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value <= 0) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    setDisplay(0);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {display.toLocaleString()}
    </span>
  );
}

/* ── Section masthead label — an editorial eyebrow + optional "view all" ──── */
export function SectionLabel({
  children,
  tone = "ink",
  live = false,
  liveTone = "volt",
  charged = false,
  action,
}: {
  children: React.ReactNode;
  tone?: "ink" | "volt" | "teal" | "kai";
  live?: boolean;
  liveTone?: "volt" | "teal" | "kai";
  /** hot moving-gradient treatment on the label text (Live Pulse) */
  charged?: boolean;
  action?: React.ReactNode;
}) {
  const color =
    tone === "volt" ? "text-volt-700" :
    tone === "teal" ? "text-teal-700" :
    tone === "kai" ? "text-kai-600" : "text-ink";
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {live && <LiveDot tone={liveTone} />}
        <h2
          className={`font-display text-[11px] font-bold uppercase tracking-[0.18em] ${
            charged ? "club-eyebrow-charged" : color
          }`}
        >
          {children}
        </h2>
      </div>
      {action}
    </div>
  );
}

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

/* ── Change delta chip — mono, arrow, VIVID green up / red down. ──────────── */
export function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-xs font-extrabold tabular-nums ${
        flat ? "text-soft" : up ? "text-green-500" : "text-red-500"
      }`}
    >
      <span aria-hidden>{flat ? "–" : up ? "▲" : "▼"}</span>
      {Math.abs(value)}{suffix}
    </span>
  );
}
