"use client";

import { X } from "lucide-react";
import type { Position } from "@/lib/simulator/portfolio-manager";
import CompanyLogo from "@/components/fic/CompanyLogo";

interface PositionsListProps {
  positions: Position[];
  onClosePosition: (positionId: string) => void;
}

export default function PositionsList({
  positions,
  onClosePosition,
}: PositionsListProps) {
  if (positions.length === 0) {
    return (
      <div className="bg-midnight-900 border border-midnight-700/50 rounded-lg p-4">
        <h3 className="text-sm font-display font-semibold text-midnight-100 mb-2">
          Open Positions
        </h3>
        <p className="text-xs text-midnight-500">No open positions</p>
      </div>
    );
  }

  return (
    <div className="bg-midnight-900 border border-midnight-700/50 rounded-lg p-4">
      <h3 className="text-sm font-display font-semibold text-midnight-100 mb-3">
        Open Positions ({positions.length})
      </h3>
      <div className="space-y-2">
        {positions.map((pos) => {
          const pnl = pos.unrealizedPnl ?? 0;
          const pnlPct =
            pos.entryPrice > 0
              ? ((pos.currentPrice ?? pos.entryPrice) - pos.entryPrice) /
                pos.entryPrice *
                100 *
                (pos.side === "long" ? 1 : -1)
              : 0;

          return (
            <div
              key={pos.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-midnight-800/50 border border-midnight-700/30"
            >
              <div className="flex items-center gap-3">
                <CompanyLogo symbol={pos.symbol} name={pos.symbol} size={28} rounded="rounded-md" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-mono font-medium text-midnight-100">
                      {pos.symbol}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        pos.side === "long"
                          ? "bg-green-400/10 text-green-400"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {pos.side.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-midnight-500 font-mono">
                    {pos.quantity} @ ${pos.entryPrice.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p
                    className={`text-sm font-mono font-medium ${
                      pnl >= 0 ? "text-green-400" : "text-red-500"
                    }`}
                  >
                    {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                  </p>
                  <p
                    className={`text-[10px] font-mono ${
                      pnlPct >= 0 ? "text-green-400/70" : "text-red-500/70"
                    }`}
                  >
                    {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                  </p>
                </div>
                <button
                  onClick={() => onClosePosition(pos.id)}
                  className="p-1 rounded hover:bg-red-500/10 text-midnight-500 hover:text-red-500 transition-colors"
                  title="Close position"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
