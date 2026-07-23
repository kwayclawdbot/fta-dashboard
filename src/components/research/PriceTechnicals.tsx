"use client";

/**
 * Price + Technicals (Lane 9): timeframe-return chips (1W/1M/3M/1Y with the
 * return baked in, WSZ-style), an interactive daily price chart with 1M/3M/1Y/2Y
 * ranges and EMA20/EMA50 overlay toggles, and an RSI(14) dial + key-stats row.
 * Bars come from the existing /api/market/bars proxy (delayed, cached) — no keys
 * client-side, one fetch of the 2Y series, everything derived from it.
 */

import { useEffect, useMemo, useState } from "react";
import { fetchBars, type MarketBar } from "@/lib/market/client";
import { RsiDial } from "@/components/research/ResearchCharts";
import type { MomentumStats } from "@/lib/research/types";

const RANGES: { key: string; label: string; days: number }[] = [
  { key: "1m", label: "1M", days: 21 },
  { key: "3m", label: "3M", days: 63 },
  { key: "1y", label: "1Y", days: 252 },
  { key: "2y", label: "2Y", days: 504 },
];

const RETURN_WINDOWS: { label: string; days: number }[] = [
  { label: "1W", days: 5 },
  { label: "1M", days: 21 },
  { label: "3M", days: 63 },
  { label: "1Y", days: 252 },
];

function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  let prev = values[0];
  const out = [prev];
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function toneClass(v: number | null): string {
  if (v == null || Math.abs(v) < 0.05) return "text-soft";
  return v > 0 ? "text-green-600" : "text-red-600";
}

export default function PriceTechnicals({
  symbol,
  momentum,
  bars: providedBars,
}: {
  symbol: string;
  momentum: MomentumStats;
  /** Pre-loaded 2Y bars from the page (avoids a duplicate fetch). */
  bars?: MarketBar[];
}) {
  const [fetched, setFetched] = useState<MarketBar[] | null>(null);
  const [range, setRange] = useState("1y");
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(false);

  const hasProvided = providedBars != null && providedBars.length > 0;
  const bars: MarketBar[] | null = hasProvided ? providedBars! : fetched;

  useEffect(() => {
    if (hasProvided) return;
    let live = true;
    fetchBars(symbol, "2y").then((b) => {
      if (live) setFetched(b);
    });
    return () => {
      live = false;
    };
  }, [symbol, hasProvided]);

  const closesFull = useMemo(() => (bars || []).map((b) => b.c), [bars]);

  // Returns from the full 2Y series (falls back to screener chg where thin).
  const returns = useMemo(() => {
    return RETURN_WINDOWS.map((w) => {
      let pct: number | null = null;
      if (closesFull.length > w.days) {
        const now = closesFull[closesFull.length - 1];
        const then = closesFull[closesFull.length - 1 - w.days];
        if (then) pct = ((now - then) / then) * 100;
      }
      if (pct == null) {
        if (w.label === "1W") pct = momentum.chg5d;
        else if (w.label === "1M") pct = momentum.chg1m;
        else if (w.label === "3M") pct = momentum.chg3m;
      }
      return { label: w.label, pct };
    });
  }, [closesFull, momentum]);

  const spec = RANGES.find((r) => r.key === range) ?? RANGES[2];
  const ema20Full = useMemo(() => ema(closesFull, 20), [closesFull]);
  const ema50Full = useMemo(() => ema(closesFull, 50), [closesFull]);

  const view = useMemo(() => {
    if (!bars || bars.length === 0) return null;
    const n = bars.length;
    const start = Math.max(0, n - spec.days);
    const slice = bars.slice(start);
    return {
      bars: slice,
      ema20: ema20Full.slice(start),
      ema50: ema50Full.slice(start),
    };
  }, [bars, spec.days, ema20Full, ema50Full]);

  return (
    <div className="space-y-4">
      {/* timeframe-return chips */}
      <div className="flex flex-wrap gap-2">
        {returns.map((r) => (
          <div
            key={r.label}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sand bg-paper px-2.5 py-1"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-soft">
              {r.label}
            </span>
            <span className={`text-xs font-bold tabular-nums ${toneClass(r.pct)}`}>
              {r.pct == null ? "—" : `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(1)}%`}
            </span>
          </div>
        ))}
      </div>

      {/* range + EMA toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-sand p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                range === r.key ? "bg-gold-500 text-white" : "text-soft hover:text-ink"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowEma20((v) => !v)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
              showEma20 ? "border-sky-400 bg-chip-sky text-sky-800" : "border-sand text-soft hover:bg-paper"
            }`}
          >
            EMA 20
          </button>
          <button
            onClick={() => setShowEma50((v) => !v)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
              showEma50 ? "border-purple-400 bg-purple-500/12 text-purple-600" : "border-sand text-soft hover:bg-paper"
            }`}
          >
            EMA 50
          </button>
        </div>
      </div>

      {/* chart */}
      {view ? (
        <PriceSvg view={view} showEma20={showEma20} showEma50={showEma50} />
      ) : (
        <div className="h-[240px] animate-pulse rounded-xl bg-sand/40" />
      )}

      {/* RSI dial + key stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="mx-auto sm:mx-0">
          <RsiDial rsi={momentum.rsi14} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="vs 20-day avg vol"
            value={momentum.volRatio == null ? "—" : `${momentum.volRatio.toFixed(1)}×`}
          />
          <Stat
            label="Gap today"
            value={momentum.gapPct == null ? "—" : `${momentum.gapPct > 0 ? "+" : ""}${momentum.gapPct.toFixed(1)}%`}
            tone={momentum.gapPct}
          />
          <Stat
            label="From 52w high"
            value={momentum.dist52wHigh == null ? "—" : `${momentum.dist52wHigh.toFixed(0)}%`}
          />
          <Stat
            label="Above 52w low"
            value={momentum.dist52wLow == null ? "—" : `+${momentum.dist52wLow.toFixed(0)}%`}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return (
    <div className="rounded-lg border border-sand bg-paper px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-soft">{label}</div>
      <div className={`font-display text-sm font-bold ${tone !== undefined ? toneClass(tone) : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function PriceSvg({
  view,
  showEma20,
  showEma50,
}: {
  view: { bars: MarketBar[]; ema20: number[]; ema50: number[] };
  showEma20: boolean;
  showEma50: boolean;
}) {
  const { bars } = view;
  const W = 640;
  const H = 240;
  const padL = 8;
  const padR = 52;
  const padT = 14;
  const padB = 20;

  const series = [
    bars.map((b) => b.c),
    ...(showEma20 ? [view.ema20] : []),
    ...(showEma50 ? [view.ema50] : []),
  ].flat();
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const closes = bars.map((b) => b.c);
  const up = closes[closes.length - 1] >= closes[0];

  const x = (i: number) => padL + (i / (bars.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / range) * (H - padT - padB);
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const last = closes[closes.length - 1];
  const strokeCls = up ? "text-green-600" : "text-red-600";

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Price chart" className="block">
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} className="text-sand" stroke="currentColor" strokeWidth={1} />
        <g className={strokeCls}>
          <path d={path(closes)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </g>
        {showEma20 && view.ema20.length === bars.length && (
          <path d={path(view.ema20)} fill="none" stroke="#38bdf8" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.9} />
        )}
        {showEma50 && view.ema50.length === bars.length && (
          <path d={path(view.ema50)} fill="none" stroke="#a78bfa" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.9} />
        )}
        <g className={strokeCls}>
          <circle cx={x(bars.length - 1)} cy={y(last)} r={3.5} fill="currentColor" />
        </g>
        <text x={W - padR + 6} y={y(last) + 4} className="fill-ink" fontSize={12} fontWeight={700}>
          ${last.toFixed(2)}
        </text>
      </svg>
    </div>
  );
}
