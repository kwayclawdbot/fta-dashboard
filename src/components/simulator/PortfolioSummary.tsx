"use client";

import { m } from "@/lib/motion";
import { Sparkles } from "lucide-react";
import type { PortfolioState } from "@/lib/simulator/portfolio-manager";
import { getEquity, getWinRate, getReturnPct } from "@/lib/simulator/portfolio-manager";

interface PortfolioSummaryProps {
  state: PortfolioState;
}

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

export default function PortfolioSummary({ state }: PortfolioSummaryProps) {
  const equity = getEquity(state);
  const winRate = getWinRate(state);
  const returnPct = getReturnPct(state);
  const unrealizedPnl = state.positions.reduce(
    (sum, p) => sum + (p.unrealizedPnl ?? 0),
    0
  );
  const up = state.totalPnl >= 0;
  const read = weeklyRead(state);

  const kpis = [
    {
      label: "Cash",
      value: `$${state.balance.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      color: "text-midnight-100",
    },
    {
      label: "Unrealized",
      value: `${unrealizedPnl >= 0 ? "+" : ""}$${unrealizedPnl.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      color: unrealizedPnl >= 0 ? "text-green-400" : "text-red-500",
    },
    {
      label: "Return",
      value: `${returnPct >= 0 ? "+" : ""}${returnPct}%`,
      color: returnPct >= 0 ? "text-green-400" : "text-red-500",
    },
    {
      label: "Win rate",
      value: state.totalTrades > 0 ? `${winRate}%` : "—",
      color: "text-gold-400",
    },
  ];

  return (
    <div className="space-y-3">
      {/* Total-value hero — the board-12 focal point */}
      <m.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-gold-500/25 bg-gradient-to-br from-midnight-900 to-midnight-950 px-5 py-4"
      >
        <p className="text-[11px] uppercase tracking-[0.14em] text-midnight-400">
          Total value
        </p>
        <p className="mt-1 font-mono text-4xl font-bold tracking-tight text-midnight-50 tabular-nums">
          $
          {equity.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </p>
        <p
          className={`mt-1 font-mono text-sm font-medium tabular-nums ${
            up ? "text-green-400" : "text-red-500"
          }`}
        >
          {up ? "▲" : "▼"} {up ? "+" : ""}$
          {state.totalPnl.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          {" "}
          <span className="text-midnight-400">
            ({returnPct >= 0 ? "+" : ""}
            {returnPct}%) all time
          </span>
        </p>

        {/* Compact KPI strip under the hero */}
        <div className="mt-4 grid grid-cols-4 gap-2 border-t border-midnight-700/40 pt-3">
          {kpis.map((kpi) => (
            <div key={kpi.label}>
              <p className="text-[10px] text-midnight-400">{kpi.label}</p>
              <p className={`font-mono text-sm font-medium tabular-nums ${kpi.color}`}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </m.div>

      {/* Kai reviewed your week — deterministic, hidden when not computable */}
      {read && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-2.5 rounded-xl border border-gold-500/20 bg-gold-500/[0.06] px-4 py-3"
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
          <div>
            <p className="text-xs font-semibold text-gold-300">Kai reviewed your week</p>
            <p className="mt-0.5 text-xs leading-relaxed text-midnight-300">{read}</p>
          </div>
        </m.div>
      )}
    </div>
  );
}
