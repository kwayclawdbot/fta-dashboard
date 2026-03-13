"use client";

import { motion } from "framer-motion";
import type { PortfolioState } from "@/lib/simulator/portfolio-manager";
import { getEquity, getWinRate, getReturnPct } from "@/lib/simulator/portfolio-manager";

interface PortfolioSummaryProps {
  state: PortfolioState;
}

export default function PortfolioSummary({ state }: PortfolioSummaryProps) {
  const equity = getEquity(state);
  const winRate = getWinRate(state);
  const returnPct = getReturnPct(state);
  const unrealizedPnl = state.positions.reduce(
    (sum, p) => sum + (p.unrealizedPnl ?? 0),
    0
  );

  const kpis = [
    {
      label: "Balance",
      value: `$${state.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      color: "text-midnight-100",
    },
    {
      label: "Equity",
      value: `$${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      color: "text-midnight-100",
    },
    {
      label: "Total P&L",
      value: `${state.totalPnl >= 0 ? "+" : ""}$${state.totalPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      color: state.totalPnl >= 0 ? "text-green-400" : "text-red-500",
    },
    {
      label: "Unrealized",
      value: `${unrealizedPnl >= 0 ? "+" : ""}$${unrealizedPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      color: unrealizedPnl >= 0 ? "text-green-400" : "text-red-500",
    },
    {
      label: "Return",
      value: `${returnPct >= 0 ? "+" : ""}${returnPct}%`,
      color: returnPct >= 0 ? "text-green-400" : "text-red-500",
    },
    {
      label: "Win Rate",
      value: state.totalTrades > 0 ? `${winRate}%` : "—",
      color: "text-gold-400",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="bg-midnight-900 border border-midnight-700/50 rounded-lg px-3 py-2"
        >
          <p className="text-[10px] text-midnight-400 mb-0.5">{kpi.label}</p>
          <p className={`text-sm font-mono font-medium ${kpi.color}`}>{kpi.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
