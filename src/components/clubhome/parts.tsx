"use client";

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

/* ── LivePulse dot ───────────────────────────────────────────────────────── */
export function LiveDot({ tone = "volt" }: { tone?: "volt" | "teal" | "kai" }) {
  const color =
    tone === "teal" ? "bg-teal-400" : tone === "kai" ? "bg-kai-500" : "bg-volt-500";
  return (
    <span className="relative flex h-2 w-2" aria-hidden>
      <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-60 motion-safe:animate-ping`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

/* ── Section masthead label — an editorial eyebrow + optional "view all" ──── */
export function SectionLabel({
  children,
  tone = "ink",
  live = false,
  liveTone = "volt",
  action,
}: {
  children: React.ReactNode;
  tone?: "ink" | "volt" | "teal" | "kai";
  live?: boolean;
  liveTone?: "volt" | "teal" | "kai";
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
        <h2 className={`font-display text-[11px] font-bold uppercase tracking-[0.18em] ${color}`}>
          {children}
        </h2>
      </div>
      {action}
    </div>
  );
}

/* ── Inline sparkline from a raw number series (fixtures / derived) ────────── */
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
  const stroke =
    tone === "teal" ? "var(--color-teal-500)" :
    tone === "down" ? "var(--color-red-500)" :
    tone === "flat" ? "var(--color-midnight-500)" :
    "var(--color-volt-500)";
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
      <polyline
        points={pts.join(" ")}
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2" fill={stroke} />
    </svg>
  );
}

/* ── Change delta chip — mono, arrow, tone. Volt=up (action), red=down. ───── */
export function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-xs font-bold tabular-nums ${
        flat ? "text-soft" : up ? "text-volt-600" : "text-red-500"
      }`}
    >
      <span aria-hidden>{flat ? "–" : up ? "▲" : "▼"}</span>
      {Math.abs(value)}{suffix}
    </span>
  );
}
