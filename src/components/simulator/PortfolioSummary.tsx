"use client";

import { useId } from "react";
import { m } from "@/lib/motion";
import { SegmentedRail } from "@/components/canvas2";
import type { PortfolioState, EquityPoint } from "@/lib/simulator/portfolio-manager";
import { getEquity, getWinRate, getReturnPct } from "@/lib/simulator/portfolio-manager";

/**
 * THE PRACTICE PORTFOLIO — canvas v2 adoption of the hero.
 *
 * Canvas reference: "Practice portfolio" (design-project, L1004-1070) and the
 * "1a / 1b Portfolio" directions (New Screens L213-278 / L449-482). The canvas
 * stacks: a PAPER MONEY badge against the title, "Total value" as an eyebrow,
 * the value as the largest number on the screen, the move beneath it, an EQUITY
 * CURVE, and a timeframe rail under the curve. All of that is here — with the
 * curve drawn from real captured history (migration 197) and never invented.
 *
 * `.f0-hero-field` is deliberately obsidian in BOTH themes and sets its own
 * cream foreground, so everything inside inherits that colour: no literal hex,
 * no bg-white, no text-ink (which flips near-white at night and would vanish).
 * Secondary type is the inherited cream at reduced opacity, and the measure
 * hairlines are white at 15% — all of it reads identically on the cream page
 * and on the night page.
 *
 * The CURVE sits on the paper directly beneath the field rather than inside it,
 * which is what lets its stroke use the canonical `text-price-up` /
 * `text-price-down` tokens (they are tuned for the page, not for obsidian) —
 * the one place in this file where price colour is spent.
 *
 * COLOUR LAW: the return is a PRICE number, so it is the only coloured thing
 * inside the field. On an always-obsidian field the canonical tokens can't be
 * used — their LIGHT step (#15803D / #B91C1C) is chosen for the cream page and
 * fails on obsidian — so the field takes the dark steps of the same ramp in
 * both themes, exactly as WatchlistPerformance does inside its hero. Flat is
 * not coloured at all: a $0 move is not a win. The timeframe rail is a control,
 * so its bar is brand orange, never a price colour.
 *
 * HONESTY: win rate shows "—" until a trade has actually closed; the weekly
 * read is computed from the member's own closed trades or is not rendered; and
 * the curve shows a founding state until there is real history behind it. This
 * is a PRACTICE record — never presented as a track record or a reason to
 * trust a call.
 */

export type EquityRange = "1d" | "1w" | "1m" | "all";

export const EQUITY_RANGE_DAYS: Record<EquityRange, number> = {
  "1d": 1,
  "1w": 7,
  "1m": 30,
  all: 0,
};

interface PortfolioSummaryProps {
  state: PortfolioState;
  /** Real captured equity history for the selected window. */
  history: EquityPoint[];
  /** True while the window is being fetched — a skeleton, never the founding state. */
  historyLoading: boolean;
  range: EquityRange;
  onRangeChange: (r: EquityRange) => void;
}

const money = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Deterministic weekly read, derived only from the member's own closed sim
// trades (no fabricated club snapshot). Hidden until there's enough to say
// something honest. Ratio of average win to average loss is the spine — the
// same "you cut winners early / your losers run" read a coach would give.
function weeklyRead(state: PortfolioState): string | null {
  const closed = state.trades;
  if (closed.length < 3) return null;

  const pcts = closed.map((t) => {
    if (t.entryPrice <= 0) return 0;
    const dir = t.side === "long" ? 1 : -1;
    return ((t.exitPrice - t.entryPrice) / t.entryPrice) * 100 * dir;
  });
  const wins = pcts.filter((p) => p > 0);
  const losses = pcts.filter((p) => p < 0).map((p) => Math.abs(p));
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  const winRate = getWinRate(state);

  if (avgLoss > 0 && avgLoss > avgWin * 1.2)
    return "Your losers are running bigger than your winners. Tighten stops — cut losses faster than you let gains go.";
  if (avgWin > 0 && avgWin > avgLoss * 1.5)
    return "You size winners well and keep losses small. Keep running that ratio.";
  if (winRate >= 60)
    return `Strong hit rate this week — ${winRate}% of your closes came back green. Consistency is showing.`;
  return "Risk and reward are running about even. Focus on letting winners breathe before you close them.";
}

/**
 * The equity curve. Canvas draws a line with a soft closed fill beneath it and
 * no gridlines, no axis, no crosshair (App Light L267-275) — a shape, not a
 * terminal read-out. `currentColor` throughout so a single price token on the
 * wrapper drives stroke and fill together.
 */
function EquityCurve({ points, height = 116 }: { points: EquityPoint[]; height?: number }) {
  const gradientId = useId();
  const W = 1000;
  const H = 100;

  const values = points.map((p) => p.equity);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  // 6% headroom top and bottom so the extremes never graze the edge.
  const y = (v: number) => H - 6 - ((v - lo) / span) * (H - 12);
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.equity).toFixed(2)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  const first = values[0];
  const last = values[values.length - 1];
  const tone = last > first ? "text-price-up" : last < first ? "text-price-down" : "text-soft";

  return (
    <div className={tone}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ height, width: "100%", display: "block" }}
        role="img"
        aria-label={`Practice account equity, ${points.length} captured points, from $${money(first)} to $${money(last)}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

const RANGE_OPTIONS: { id: EquityRange; label: string }[] = [
  { id: "1d", label: "1D" },
  { id: "1w", label: "1W" },
  { id: "1m", label: "1M" },
  { id: "all", label: "All" },
];

export default function PortfolioSummary({
  state,
  history,
  historyLoading,
  range,
  onRangeChange,
}: PortfolioSummaryProps) {
  const equity = getEquity(state);
  const winRate = getWinRate(state);
  const returnPct = getReturnPct(state);
  const unrealizedPnl = state.positions.reduce((sum, p) => sum + (p.unrealizedPnl ?? 0), 0);
  const read = weeklyRead(state);

  const flat = state.totalPnl === 0;
  const up = state.totalPnl > 0;
  const tone = flat ? "opacity-70" : up ? "text-green-400" : "text-red-500";

  const measures: { label: string; value: string; tone?: string }[] = [
    { label: "Cash", value: `$${money(state.balance)}` },
    {
      label: "Open P&L",
      value: `${unrealizedPnl > 0 ? "+" : ""}$${money(unrealizedPnl)}`,
      tone:
        unrealizedPnl === 0
          ? undefined
          : unrealizedPnl > 0
            ? "text-green-400"
            : "text-red-500",
    },
    { label: "Win rate", value: state.totalTrades > 0 ? `${winRate}%` : "—" },
    { label: "Closed", value: state.totalTrades > 0 ? `${state.totalTrades}` : "—" },
  ];

  // Two captured points is the floor for a line — one point is a dot, and a dot
  // drawn as a curve would imply a history that does not exist.
  const hasCurve = history.length >= 2;

  return (
    <div>
      <m.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="f0-hero-field f0-grain px-5 py-7 sm:px-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            {/* The canvas sets PAPER MONEY against the title as the first thing
                you read on the surface. It stays permanent — this account is a
                practice account and is never allowed to read as anything else. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-eyebrow font-display font-bold uppercase opacity-70">
                Total value
              </p>
              <span className="rounded-full border border-white/25 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] opacity-80">
                Paper money
              </span>
            </div>
            <p className="mt-3 font-mono text-[40px] font-bold leading-[0.95] tracking-tight tabular-nums sm:text-[48px]">
              ${money(equity)}
            </p>
            <p className={`mt-2.5 font-mono text-[14px] font-semibold tabular-nums ${tone}`}>
              {flat ? "" : up ? "▲ +" : "▼ "}${money(state.totalPnl)}
              <span className="ml-1.5 opacity-65">
                ({returnPct >= 0 ? "+" : ""}
                {returnPct}%) all time
              </span>
            </p>
          </div>

          {/* Measure strip — hairlines, not tiles. */}
          <div className="flex items-stretch">
            {measures.map((mm, i) => (
              <div
                key={mm.label}
                className={`min-w-0 ${
                  i > 0 ? "border-l border-white/15 pl-4 sm:pl-5" : ""
                } ${i < measures.length - 1 ? "pr-4 sm:pr-5" : ""}`}
              >
                <p
                  className={`font-mono text-[17px] font-semibold tabular-nums ${mm.tone ?? ""}`}
                >
                  {mm.value}
                </p>
                <p className="mt-1.5 text-eyebrow font-display font-bold uppercase opacity-60">
                  {mm.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </m.section>

      {/* ── EQUITY CURVE ──────────────────────────────────────────────────
          Canvas puts the curve immediately under the value with a timeframe
          rail beneath it. Real captured history only. */}
      <section aria-labelledby="sim-equity" className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2
            id="sim-equity"
            className="font-display text-eyebrow font-bold uppercase text-soft"
          >
            Equity curve
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-soft/70">
            {historyLoading
              ? "Reading your history"
              : hasCurve
                ? `${history.length} captures`
                : "Practice account"}
          </p>
        </div>

        <div className="mt-3">
          {historyLoading ? (
            /* LOADING — a pulsing band that claims a curve is coming. */
            <div
              className="h-[116px] w-full animate-pulse rounded-lg bg-sand/60"
              aria-busy="true"
              aria-label="Loading equity history"
            />
          ) : hasCurve ? (
            <EquityCurve points={history} />
          ) : (
            /* FOUNDING — the real state of a new practice account. Designed,
               and deliberately NOT a flat line, which would imply history. */
            <div className="f0-rule-top f0-rule-bottom flex h-[116px] flex-col justify-center py-4">
              <p className="max-w-lg text-[13.5px] leading-relaxed text-soft">
                Your equity line starts drawing as soon as you run the tape. It
                records what this practice account is worth over time — nothing
                is plotted until there is something real to plot.
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 max-w-xs">
          <SegmentedRail<EquityRange>
            options={RANGE_OPTIONS}
            value={range}
            onChange={onRangeChange}
            ariaLabel="Equity curve timeframe"
            barClassName="bg-accent"
            fill
            size="sm"
          />
        </div>
      </section>

      {/* Kai reviewed your week — Kai blue by law (this is the AI voice), a
          ruled note on the page rather than a second boxed card. Kai explains
          the member's own record; it never issues a call. */}
      {read && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-5 border-l-[3px] border-kai-500 py-1 pl-3.5 dark:border-kai-400"
        >
          <p className="flex items-center gap-2 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-kai-600 dark:text-kai-300">
            <span
              aria-hidden
              className="relative flex h-2 w-2 items-center justify-center"
            >
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-kai-400/50 motion-safe:animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-kai-500" />
            </span>
            Kai reviewed your week
          </p>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-soft">{read}</p>
        </m.div>
      )}
    </div>
  );
}
