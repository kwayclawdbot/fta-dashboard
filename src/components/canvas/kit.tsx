"use client";

/**
 * Canvas Kit — the shared primitives for the pixel-faithful club-mode rebuilds
 * of the owner's App-UI artboards (.planning/design-project/"Cheat Code Club -
 * App UI.dc.html"). These map 1:1 onto the design tokens that ALREADY ship
 * under [data-mode="club"] in globals.css (--volt, --ink, --paper, --card,
 * --sand, --soft, --faint(≈--g via m600), --green, --red, --kai). The point of
 * this lane is composition fidelity, so the kit deliberately mirrors the
 * artboard's exact type ramp (Sora display, Inter body, IBM Plex Mono numerics),
 * chip system, sparklines and card density — not a re-skin of old layouts.
 */

import Link from "next/link";
import CompanyLogo from "@/components/fic/CompanyLogo";

/* Faithful token aliases. --faint isn't a first-class var, so we read the club
   ramp value directly; everything else is a live club token. */
export const V = {
  ink: "var(--ink)",
  soft: "var(--soft)",
  faint: "var(--m600, #8C8474)",
  paper: "var(--paper)",
  card: "var(--card)",
  card2: "color-mix(in srgb, var(--card) 78%, var(--sand))",
  sand: "var(--sand)",
  volt: "var(--g500, #FF6A00)",
  voltText: "var(--g700, #C24400)",
  voltSoft: "color-mix(in srgb, var(--g500) 12%, transparent)",
  green: "var(--cv-green, #15803D)",
  greenSoft: "var(--cv-green-soft, rgba(21,128,61,.14))",
  red: "var(--cv-red, #B91C1C)",
  redSoft: "var(--cv-red-soft, rgba(185,28,28,.12))",
  kai: "var(--kai-blue, #2563FF)",
  kaiSoft: "color-mix(in srgb, var(--kai-blue) 16%, transparent)",
  gold: "#E6B84D",
  goldSoft: "rgba(230,184,77,.16)",
} as const;

export const sora = "'Sora', sans-serif";
export const mono = "'IBM Plex Mono', monospace";
export const inter = "'Inter', sans-serif";

/** The scrollable phone content region. The shell owns the status/top bar +
 *  MobileTabBar, so a screen renders from its display title down — exactly the
 *  region the artboards frame as the composition. */
export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        fontFamily: inter,
        color: V.ink,
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {children}
    </div>
  );
}

export function Display({
  children,
  color = V.ink,
  size = 30,
}: {
  children: React.ReactNode;
  color?: string;
  size?: number;
}) {
  return (
    <h1
      style={{
        font: `800 ${size}px/1.05 ${sora}`,
        letterSpacing: "-0.01em",
        color,
        margin: 0,
        textTransform: "uppercase",
      }}
    >
      {children}
    </h1>
  );
}

export function Sub({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ font: `400 13px/1.4 ${inter}`, color: V.soft, margin: "4px 0 0" }}>
      {children}
    </p>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{children}</div>
  );
}

export function Chip({
  active,
  tone,
  children,
}: {
  active?: boolean;
  tone?: { text: string; border: string };
  children: React.ReactNode;
}) {
  if (active) {
    return (
      <span
        style={{
          padding: "7px 13px",
          borderRadius: 16,
          background: V.volt,
          color: "#fff",
          font: `700 12px/1 ${inter}`,
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      style={{
        padding: "7px 12px",
        borderRadius: 16,
        border: `1px solid ${tone?.border ?? V.sand}`,
        color: tone?.text ?? V.soft,
        font: `600 12px/1 ${inter}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  style,
  as,
  href,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  as?: "div";
  href?: string;
}) {
  const base: React.CSSProperties = {
    borderRadius: 14,
    background: V.card,
    border: `1px solid ${V.sand}`,
    boxShadow: "var(--sh-soft)",
    ...style,
  };
  if (href) {
    return (
      <Link href={href} style={{ ...base, display: "block", textDecoration: "none", color: "inherit" }}>
        {children}
      </Link>
    );
  }
  return <div style={base}>{children}</div>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: `700 12px/1 ${sora}`, letterSpacing: ".12em", color: V.ink, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

/** Real ticker logo (Polygon branding proxy) with warm-gold monogram fallback —
 *  ticker logos everywhere, per the lane rule. */
export function Logo({ symbol, name, size = 38, radius = 11 }: { symbol: string; name?: string; size?: number; radius?: number }) {
  return <CompanyLogo symbol={symbol} name={name} size={size} rounded="" className="" />;
}

/** Deterministic sparkline from a seed so a founding state is never flat/sad. */
export function Spark({
  points,
  color,
  w = 140,
  h = 34,
  fill,
}: {
  points: number[];
  color: string;
  w?: number;
  h?: number;
  fill?: string;
}) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const pts = points
    .map((p, i) => `${(i * step).toFixed(1)},${(h - 3 - ((p - min) / span) * (h - 6)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" style={{ display: "block" }}>
      {fill && <polygon points={`${pts} ${w},${h} 0,${h}`} fill={fill} />}
      <polyline points={pts} stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Money({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return <span style={{ font: `600 ${size}px/1.2 ${mono}`, color: V.ink }}>{children}</span>;
}

export function Delta({ up, children }: { up: boolean; children: React.ReactNode }) {
  return (
    <span style={{ font: `600 12px/1.4 ${mono}`, color: up ? V.green : V.red }}>
      {up ? "▲" : "▼"} {children}
    </span>
  );
}
