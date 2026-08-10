"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/motion";
import type { SetupState } from "@/lib/alerts/setup-lifecycle";

/* ══════════════════════════════════════════════════════════════════════════
   POSTER PRIMITIVES — the owner-approved Kai alerts visual language
   (prior art: cheatcode-os ShareCard / KaiWinDetailPage, adapted onto club
   tokens). One vocabulary, used by SetupGraphCard, ShareOutcomeCard, the
   alert story page and the History feed:

     • The chart IS the card — full-bleed neon line as the card's ground
       (AlertLevelChart, variant "bg"/"hero"); content floats ON it.
     • Scale contrast — ONE giant glowing mono number per poster (GlowPct),
       direction-coloured by the price ramp, counting up on mount.
     • Heat by glow — no state chips, no lifecycle bars, no distance meters.
       State is one human Kai line (kaiSetupLine); a live card breathes
       (.poster-breathe, motion-gated in globals.css).
     • The plan as a rail — Entry → Target gradient rail with labelled mono
       prices, stop marked beneath (PlanRail).
     • Per-ticker hue — a deterministic, subtle accent derived from the
       ticker string (tickerAccent). DATA-derived colour, not a surface
       token, mixed over the token ground at low opacity only.
     • Kai's voice as typography — the quoted violet line, large (KaiVoice).

   HONESTY LAW carries over verbatim: every number is a stored number, a
   missing leg is a missing object, no bars = no curve.
   ══════════════════════════════════════════════════════════════════════════ */

export function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pctStr(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

/* ── per-ticker hue ──────────────────────────────────────────────────────────
   Deterministic hue off the ticker string. This is a computed, data-derived
   accent (like ClubMark's fixed brand gradients) — never a surface colour;
   callers mix it over token grounds at low opacity so it stays subtle on the
   terminal black. */
export function tickerAccent(ticker: string): string {
  let h = 0;
  const t = ticker.toUpperCase();
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360;
  return `hsl(${h} 72% 62%)`;
}

/* ── the giant glowing % ─────────────────────────────────────────────────────
   Direction-coloured (price ramp only), soft text-glow, counts up on mount.
   Reduced motion renders the final figure immediately (no state write in the
   effect body — the animation branch is rAF-async, the reduced branch is a
   pure derivation). */
export function GlowPct({
  value,
  size = 44,
  className = "",
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);

  const shown = reduced ? value : animated;
  const color = value >= 0 ? "var(--color-price-up)" : "var(--color-price-down)";
  return (
    <span
      className={`font-mono font-bold tabular-nums leading-none ${className}`}
      style={{
        fontSize: size,
        letterSpacing: "-0.03em",
        color,
        textShadow: `0 0 ${Math.max(14, Math.round(size * 0.55))}px color-mix(in srgb, ${color} 55%, transparent)`,
      }}
    >
      {shown >= 0 ? "+" : ""}
      {shown.toFixed(1)}%
    </span>
  );
}

/* ── the plan as a rail (ShareCard pattern) ─────────────────────────────────
   Entry ————— Target with labelled mono prices; the stop marked beneath.
   Callers pass only legs they genuinely store — no leg, no rail. */
export function PlanRail({
  from,
  to,
  stop = null,
  accent,
  className = "",
}: {
  from: { label: string; value: number };
  to: { label: string; value: number; color?: string };
  stop?: number | null;
  /** CSS colour for the gradient line (per-ticker hue or a price token). */
  accent: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-soft/70">
            {from.label}
          </div>
          <div className="mt-0.5 font-mono text-[14px] font-bold tabular-nums leading-none text-ink">
            ${money(from.value)}
          </div>
        </div>
        <div
          aria-hidden
          className="h-[2px] min-w-0 flex-1 rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${accent} 80%, transparent), transparent)`,
          }}
        />
        <div className="shrink-0 text-right">
          <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-soft/70">
            {to.label}
          </div>
          <div
            className="mt-0.5 font-mono text-[14px] font-bold tabular-nums leading-none"
            style={{ color: to.color ?? accent }}
          >
            ${money(to.value)}
          </div>
        </div>
      </div>
      {stop != null && (
        <p className="mt-1.5 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-price-down/90">
          Stop ${money(stop)}
        </p>
      )}
    </div>
  );
}

/* ── Kai's voice as typography — the quoted violet line, first-class ─────── */
const VOICE_SIZE = {
  sm: "text-[12.5px] leading-[1.55]",
  md: "text-[13.5px] leading-[1.55]",
  lg: "text-[15px] leading-[1.6]",
  xl: "text-[17px] leading-[1.6]",
} as const;

export function KaiVoice({
  children,
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  size?: keyof typeof VOICE_SIZE;
  className?: string;
}) {
  return (
    <p className={`${VOICE_SIZE[size]} text-kai-blue ${className}`}>
      &ldquo;{children}&rdquo;
    </p>
  );
}

/* ── the ONE human state line (replaces chips / bars / meters everywhere) ── */
export function kaiSetupLine(s: { state: SetupState; created_at: string }): string {
  const flaggedToday =
    new Date(s.created_at).toDateString() === new Date().toDateString();
  switch (s.state) {
    case "waiting":
      return flaggedToday ? "Kai just flagged this." : "Still setting up.";
    case "confirmed":
      return "Kai just flagged this — it's confirming.";
    case "triggered":
      return "This one hit its target.";
    case "invalidated":
      return "This one didn't work.";
    case "expired":
      return "This one didn't work — it never triggered.";
    default:
      return "Kai is watching this one.";
  }
}

/** The closing line on a graded result poster. */
export function kaiOutcomeLine(won: boolean): string {
  return won ? "This one hit its target." : "This one didn't work.";
}
