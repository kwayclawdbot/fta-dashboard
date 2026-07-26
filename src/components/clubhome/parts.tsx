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

/* ── Card — the mock's white panel: warm off-white, hairline sand border, soft
   shadow, rounded. The owner ratified these contained data objects as the in-app
   nuance of the no-generic-cards rule (mock = full spec). ──────────────────── */
export function Card({
  children,
  className = "",
  as: As = "section",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As
      className={`rounded-2xl border border-sand bg-card p-5 shadow-soft ${className}`}
      {...rest}
    >
      {children}
    </As>
  );
}

/* ── Card header — bold dark title + optional badge + optional right action.
   The mock's per-card masthead (not the uppercase editorial eyebrow). ──────── */
export function CardHead({
  title,
  badge,
  action,
  icon,
  className = "",
}: {
  title: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <h3 className="truncate font-display text-[15px] font-extrabold tracking-tight text-ink">
          {title}
        </h3>
        {badge}
      </div>
      {action}
    </div>
  );
}

/* ── Badge — the mock's status pills (LIVE teal · LIVE POLL red · Editor's pick
   volt · neutral). Small caps, dot for the live variants. ──────────────────── */
export function Badge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: React.ReactNode;
  tone?: "live" | "poll" | "pick" | "kai" | "neutral";
  dot?: boolean;
}) {
  const map = {
    live: "bg-teal-400/12 text-teal-700",
    poll: "bg-red-500/12 text-red-600",
    pick: "bg-volt-500/12 text-volt-700",
    kai: "bg-kai-500/12 text-kai-600",
    neutral: "bg-sand/70 text-soft",
  } as const;
  const dotColor = tone === "live" ? "bg-teal-400" : tone === "poll" ? "bg-red-500" : "bg-volt-500";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${map[tone]}`}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-70 motion-safe:animate-ping`} />
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotColor}`} />
        </span>
      )}
      {children}
    </span>
  );
}

/* ── Donut — the mock's Debate chart. Two-segment ring (yes teal → no volt) with
   a draw-in sweep; reduced-motion safe. Pure SVG, no deps. ──────────────────── */
export function Donut({
  yesPct,
  size = 128,
  stroke = 18,
}: {
  yesPct: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const yes = Math.max(0, Math.min(100, yesPct));
  const yesLen = (yes / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="club-donut -rotate-90">
      {/* No segment = full ring in volt (under) */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-volt-500)"
        strokeWidth={stroke}
      />
      {/* Yes segment = teal arc on top */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-teal-400)"
        strokeWidth={stroke}
        strokeDasharray={`${yesLen} ${c}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── Thumb — self-contained "chart thumbnail" for Best Thinking (no external
   images: a dark island tile + an on-brand mini sparkline). ─────────────────── */
export function Thumb({
  series,
  tone = "volt",
  size = 60,
  className = "",
}: {
  series: number[];
  tone?: "volt" | "teal";
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl ${className}`}
      style={{ width: size, height: size, background: "linear-gradient(150deg,#0B1220 0%,#101A2E 60%,#0A2320 100%)" }}
      aria-hidden
    >
      <div className="absolute inset-0 grid place-items-center px-1.5">
        <Spark series={series} tone={tone} width={size - 12} height={size - 24} />
      </div>
    </div>
  );
}

/* ── Follower-count formatter — compact (24.1K, 1.2M). Fixture/at-scale only. ── */
export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${n}`;
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
