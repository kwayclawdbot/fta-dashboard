"use client";

import type { Trade } from "@/lib/simulator/portfolio-manager";

interface TradeHistoryProps {
  trades: Trade[];
}

export default function TradeHistory({ trades }: TradeHistoryProps) {
  if (trades.length === 0) {
    return (
      <div className="bg-midnight-900 border border-midnight-700/50 rounded-lg p-4">
        <h3 className="text-sm font-display font-semibold text-midnight-100 mb-2">
          Trade History
        </h3>
        <p className="text-xs text-midnight-500">No trades yet</p>
      </div>
    );
  }

  return (
    <div className="bg-midnight-900 border border-midnight-700/50 rounded-lg p-4">
      <h3 className="text-sm font-display font-semibold text-midnight-100 mb-3">
        Trade History ({trades.length})
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-midnight-400 border-b border-midnight-700/50">
              <th className="text-left py-2 px-2 font-medium">Symbol</th>
              <th className="text-left py-2 px-2 font-medium">Side</th>
              <th className="text-right py-2 px-2 font-medium">Qty</th>
              <th className="text-right py-2 px-2 font-medium">Entry</th>
              <th className="text-right py-2 px-2 font-medium">Exit</th>
              <th className="text-right py-2 px-2 font-medium">P&L</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr
                key={trade.id}
                className="border-b border-midnight-800/50 hover:bg-midnight-800/30"
              >
                <td className="py-2 px-2 font-mono text-midnight-100">
                  {trade.symbol}
                </td>
                <td className="py-2 px-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      trade.side === "long"
                        ? "bg-green-400/10 text-green-400"
                        : "bg-red-500/10 text-red-500"
                    }`}
                  >
                    {trade.side.toUpperCase()}
                  </span>
                </td>
                <td className="py-2 px-2 text-right font-mono text-midnight-300">
                  {trade.quantity}
                </td>
                <td className="py-2 px-2 text-right font-mono text-midnight-300">
                  ${trade.entryPrice.toFixed(2)}
                </td>
                <td className="py-2 px-2 text-right font-mono text-midnight-300">
                  ${trade.exitPrice.toFixed(2)}
                </td>
                <td
                  className={`py-2 px-2 text-right font-mono font-medium ${
                    trade.pnl >= 0 ? "text-green-400" : "text-red-500"
                  }`}
                >
                  {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
