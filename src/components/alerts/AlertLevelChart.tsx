"use client";

import { useEffect, useId, useState } from "react";

/* ══════════════════════════════════════════════════════════════════════════
   ALERT LEVEL CHART — rebuilt 2026-08-10 as the POSTER chart: the chart IS
   the card. A full-bleed, edge-to-edge price line drawn as the card's own
   background — neon stroke with a soft blur-glow under it and a gradient
   wash below — so the poster's content (ticker, the giant %, Kai's line,
   the plan rail) floats ON the price action instead of framing a
   chart-in-a-box. Prior art: cheatcode-os ShareCard / KaiWinDetailPage,
   adapted onto club tokens + the per-ticker accent.

   Two variants:
     • "bg"   — the poster card's ground. Absolutely fills its parent,
                pointer-transparent, line squeezed to the lower band so the
                floating content stays clear. No bars → renders NOTHING
                (an absent series is an absent object, never a fake curve).
     • "hero" — the story page's ~40vh hero. Same full-bleed line, plus the
                plan's labelled glowing ENTRY / STOP / TARGET horizontals
                drawn ON the chart. No bars → a stated mono line.

   HONESTY LAW (inherited): the series is the real 1-month daily closes off
   /api/market/bars; every level line is a stored number — a missing leg is
   a missing line. Draw-in animation rides .club-spark-line (globals.css),
   which is already gated on prefers-reduced-motion.
   ══════════════════════════════════════════════════════════════════════════ */

interface CloseBar {
  t: number;
  c: number;
}

/* On-demand closes, deduplicated through a module promise cache so the same
   symbol never refetches across posters or revisits. */
const closeCache = new Map<string, Promise<CloseBar[]>>();

function loadCloses(symbol: string): Promise<CloseBar[]> {
  const key = symbol.toUpperCase();
  let p = closeCache.get(key);
  if (!p) {
    p = fetch(`/api/market/bars?symbol=${encodeURIComponent(symbol)}&range=1m`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const bars = ((d?.bars as { t: number; c: number }[] | undefined) ?? []).filter(
          (b) => typeof b?.c === "number" && Number.isFinite(b.c)
        );
        return bars.map((b) => ({ t: b.t, c: b.c }));
      })
      .catch(() => [] as CloseBar[]);
    closeCache.set(key, p);
  }
  return p;
}

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AlertLevelChart({
  symbol,
  entry = null,
  stop = null,
  target = null,
  accent,
  variant = "bg",
  className = "",
}: {
  symbol: string;
  entry?: number | null;
  stop?: number | null;
  target?: number | null;
  /** CSS colour for the neon line + wash (per-ticker hue). */
  accent: string;
  /** "bg" = poster ground · "hero" = the story page's big chart w/ levels. */
  variant?: "bg" | "hero";
  className?: string;
}) {
  const gid = `alp-${useId().replace(/:/g, "")}`;
  const [bars, setBars] = useState<CloseBar[] | null>(null);

  useEffect(() => {
    let live = true;
    loadCloses(symbol).then((b) => {
      if (live) setBars(b);
    });
    return () => {
      live = false;
    };
  }, [symbol]);

  const hero = variant === "hero";

  if (bars === null) {
    // Loading — the hero shimmers; a poster ground simply hasn't appeared yet.
    return hero ? (
      <div className={`absolute inset-0 bg-sand/40 motion-safe:animate-pulse ${className}`}>
        <span className="sr-only">Loading the price series</span>
      </div>
    ) : null;
  }
  if (bars.length < 2) {
    // The feed had nothing — an absent series is an absent object.
    return hero ? (
      <div className={`absolute inset-0 grid place-items-center ${className}`}>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
          No price series for this window
        </p>
      </div>
    ) : null;
  }

  const W = 320;
  const H = 160;
  // The line lives in the lower band so floating content stays readable.
  const padTop = hero ? H * 0.2 : H * 0.38;
  const padBottom = hero ? H * 0.1 : H * 0.06;

  let lo = Math.min(...bars.map((b) => b.c));
  let hi = Math.max(...bars.map((b) => b.c));
  // The hero draws the stored levels ON the chart, so its domain includes them.
  if (hero) {
    for (const v of [entry, stop, target]) {
      if (v == null) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const span = hi - lo || 1;
  const y = (v: number) => padTop + (H - padTop - padBottom) * (1 - (v - lo) / span);
  const n = bars.length;
  const step = W / (n - 1);

  const linePts = bars.map((b, i) => `${(i * step).toFixed(1)},${y(b.c).toFixed(1)}`).join(" ");
  const area = `0,${H} ${linePts} ${W},${H}`;

  // The stored levels this alert genuinely carries — hero only, nothing else.
  const levels: { v: number; label: string; color: string; cls: string }[] = [];
  if (hero) {
    if (entry != null)
      levels.push({ v: entry, label: "ENTRY", color: "var(--ink)", cls: "text-ink" });
    if (stop != null)
      levels.push({
        v: stop,
        label: "STOP",
        color: "var(--color-price-down)",
        cls: "text-price-down",
      });
    if (target != null)
      levels.push({
        v: target,
        label: "TARGET",
        color: "var(--color-price-up)",
        cls: "text-price-up",
      });
  }

  const levelWords = levels.map((l) => `${l.label.toLowerCase()} ${money(l.v)}`).join(", ");

  return (
    <div aria-hidden={!hero} className={`pointer-events-none absolute inset-0 ${className}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
        role={hero ? "img" : undefined}
        aria-label={
          hero
            ? `${symbol.toUpperCase()} one-month price trend${
                levelWords ? ` with the plan's ${levelWords} marked` : ""
              }`
            : undefined
        }
      >
        <defs>
          <linearGradient id={`${gid}-wash`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={hero ? 0.24 : 0.16} />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
          <filter id={`${gid}-blur`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        {/* level lines — glowing horizontals, drawn ON the chart (hero) */}
        {levels.map((l) => (
          <g key={l.label}>
            <line
              x1="0"
              x2={W}
              y1={y(l.v)}
              y2={y(l.v)}
              stroke={l.color}
              strokeOpacity="0.5"
              strokeWidth="3"
              filter={`url(#${gid}-blur)`}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="0"
              x2={W}
              y1={y(l.v)}
              y2={y(l.v)}
              stroke={l.color}
              strokeOpacity={l.label === "ENTRY" ? 0.55 : 0.8}
              strokeWidth="1.2"
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {/* gradient wash under the closes */}
        <polygon points={area} fill={`url(#${gid}-wash)`} />

        {/* the neon line — soft blur-glow pass under the crisp stroke */}
        <polyline
          points={linePts}
          fill="none"
          stroke={accent}
          strokeOpacity="0.45"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${gid}-blur)`}
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={linePts}
          fill="none"
          stroke={accent}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="club-spark-line"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* level tags — HTML overlays so the text never distorts (hero) */}
      {levels.map((l) => {
        const topPct = (y(l.v) / H) * 100;
        return (
          <span
            key={l.label}
            aria-hidden
            className={`absolute left-3 -translate-y-1/2 rounded-[5px] bg-card/85 px-1.5 py-px font-mono text-[9.5px] font-semibold tabular-nums leading-[1.3] ${l.cls}`}
            style={{ top: `${topPct}%` }}
          >
            {l.label} {money(l.v)}
          </span>
        );
      })}
    </div>
  );
}
