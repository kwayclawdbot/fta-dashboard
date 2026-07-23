"use client";

/**
 * Data-driven SVG charts for Kai Research Reports and Ask Kai chat replies.
 *
 * Pure presentational: they receive already-fetched data (Polygon bars /
 * financials passed down from the stored report block or a chat message block)
 * and draw inline SVG. The model NEVER draws — it writes analysis text; these
 * render the numbers. Theme-aware via `currentColor` (color set by Tailwind
 * token classes on the wrapper), responsive (viewBox + width:100%).
 */

import { useId } from "react";
import type { MarketBar, FinancialPeriod } from "@/lib/market/client";
import { abbreviateMoney } from "@/lib/kai/report";

/* ───────────────────────────── Price chart ───────────────────────────── */

export function PriceChart({
  bars,
  height = 240,
  showKeyLevels = true,
}: {
  bars: MarketBar[];
  height?: number;
  showKeyLevels?: boolean;
}) {
  const gid = useId();
  if (!bars || bars.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-sand px-3 py-8 text-center text-sm text-soft">
        Price history unavailable.
      </div>
    );
  }

  const W = 640;
  const H = height;
  const padL = 8;
  const padR = 54; // room for the current-price label
  const padT = 14;
  const padB = 22;

  const closes = bars.map((b) => b.c);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const first = closes[0];
  const last = closes[closes.length - 1];
  const up = last >= first;

  const x = (i: number) =>
    padL + (i / (bars.length - 1)) * (W - padL - padR);
  const y = (v: number) =>
    padT + (1 - (v - min) / range) * (H - padT - padB);

  const line = bars.map((b, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(b.c).toFixed(1)}`).join(" ");
  const area = `${line} L${x(bars.length - 1).toFixed(1)},${(H - padB).toFixed(1)} L${x(0).toFixed(1)},${(H - padB).toFixed(1)} Z`;

  const hiIdx = closes.indexOf(max);
  const loIdx = closes.indexOf(min);

  const strokeCls = up ? "text-green-600" : "text-red-600";

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label="Price history chart"
        className="block"
      >
        <defs>
          <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line
          x1={padL}
          x2={W - padR}
          y1={H - padB}
          y2={H - padB}
          className="text-sand"
          stroke="currentColor"
          strokeWidth={1}
        />

        {/* area + line */}
        <g className={strokeCls}>
          <path d={area} fill={`url(#${gid}-fill)`} stroke="none" />
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>

        {showKeyLevels && (
          <g>
            {/* 52w high */}
            <circle cx={x(hiIdx)} cy={y(max)} r={3} className="text-green-600" fill="currentColor" />
            <text
              x={Math.min(x(hiIdx) + 4, W - padR - 40)}
              y={Math.max(y(max) - 4, padT + 8)}
              className="fill-soft"
              fontSize={11}
              fontWeight={600}
            >
              High ${max.toFixed(2)}
            </text>
            {/* 52w low */}
            <circle cx={x(loIdx)} cy={y(min)} r={3} className="text-red-600" fill="currentColor" />
            <text
              x={Math.min(x(loIdx) + 4, W - padR - 38)}
              y={Math.min(y(min) + 12, H - padB - 2)}
              className="fill-soft"
              fontSize={11}
              fontWeight={600}
            >
              Low ${min.toFixed(2)}
            </text>
          </g>
        )}

        {/* current price marker + label */}
        <g className={strokeCls}>
          <circle cx={x(bars.length - 1)} cy={y(last)} r={3.5} fill="currentColor" />
        </g>
        <text
          x={W - padR + 6}
          y={y(last) + 4}
          className="fill-ink"
          fontSize={12}
          fontWeight={700}
        >
          ${last.toFixed(2)}
        </text>
      </svg>
    </div>
  );
}

/* ──────────────────────────── Revenue chart ──────────────────────────── */

export function RevenueChart({
  periods,
  height = 220,
}: {
  periods: FinancialPeriod[];
  height?: number;
}) {
  if (!periods || periods.length < 2) return null;

  const W = 640;
  const H = height;
  const padT = 16;
  const padB = 30;
  const padX = 10;

  const rev = periods.map((p) => p.revenue ?? 0);
  const maxRev = Math.max(...rev, 1);
  const n = periods.length;
  const slot = (W - padX * 2) / n;
  const barW = Math.min(slot * 0.5, 44);

  const y = (v: number) => padT + (1 - v / maxRev) * (H - padT - padB);
  const cx = (i: number) => padX + slot * i + slot / 2;

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label="Quarterly revenue chart"
        className="block"
      >
        {/* baseline */}
        <line
          x1={padX}
          x2={W - padX}
          y1={H - padB}
          y2={H - padB}
          className="text-sand"
          stroke="currentColor"
          strokeWidth={1}
        />
        {periods.map((p, i) => {
          const v = p.revenue ?? 0;
          const yy = y(v);
          const h = H - padB - yy;
          const netPos = (p.netIncome ?? 0) >= 0;
          return (
            <g key={i}>
              <rect
                x={cx(i) - barW / 2}
                y={yy}
                width={barW}
                height={Math.max(h, 1)}
                rx={3}
                className="text-gold-500"
                fill="currentColor"
              />
              {p.netIncome != null && (
                <rect
                  x={cx(i) - barW / 2}
                  y={y(Math.max(Math.abs(p.netIncome), 0))}
                  width={barW}
                  height={Math.max(H - padB - y(Math.abs(p.netIncome)), 1)}
                  rx={3}
                  className={netPos ? "text-green-600" : "text-red-600"}
                  fill="currentColor"
                  opacity={0.45}
                />
              )}
              <text
                x={cx(i)}
                y={yy - 5}
                textAnchor="middle"
                className="fill-soft"
                fontSize={10}
                fontWeight={600}
              >
                {abbreviateMoney(v)}
              </text>
              <text
                x={cx(i)}
                y={H - padB + 14}
                textAnchor="middle"
                className="fill-soft"
                fontSize={10}
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center gap-4 px-1 text-[11px] text-soft">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gold-500" /> Revenue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-600/50" /> Net income
        </span>
      </div>
    </div>
  );
}
