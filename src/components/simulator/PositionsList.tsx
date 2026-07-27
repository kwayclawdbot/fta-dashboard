"use client";

import { X } from "lucide-react";
import type { Position } from "@/lib/simulator/portfolio-manager";
import CompanyLogo from "@/components/fic/CompanyLogo";

/**
 * OPEN POSITIONS — a hairline ledger, not a stack of boxes.
 *
 * One ruled line per position: the company mark, the $CASHTAG, the size and
 * entry as a mono sub-line, then the live mark and the move on the right.
 *
 * COLOUR LAW: green/red is the PRICE move and nothing else — the canonical
 * `text-price-up` / `text-price-down` tokens carry the same hue with a per-theme
 * ramp step, so there is never a `dark:` variant on a price. LONG / SHORT is a
 * direction LABEL, not a price, so it stays in the mono soft register.
 */

interface PositionsListProps {
  positions: Position[];
  onClosePosition: (positionId: string) => void;
}

export default function PositionsList({ positions, onClosePosition }: PositionsListProps) {
  return (
    <section aria-labelledby="sim-positions">
      <h2
        id="sim-positions"
        className="f0-section-rule mb-1 font-display text-eyebrow font-bold uppercase text-soft"
      >
        <span className="shrink-0 whitespace-nowrap">
          Open positions{positions.length > 0 ? ` · ${positions.length}` : ""}
        </span>
      </h2>

      {positions.length === 0 ? (
        <p className="py-4 text-[13.5px] leading-relaxed text-soft">
          Nothing open. Place a practice order and the position lands here — with a
          live mark, a size and a move you can watch.
        </p>
      ) : (
        <div className="f0-ledger">
          {positions.map((pos) => {
            const mark = pos.currentPrice ?? pos.entryPrice;
            const pnl = pos.unrealizedPnl ?? 0;
            const pnlPct =
              pos.entryPrice > 0
                ? ((mark - pos.entryPrice) / pos.entryPrice) *
                  100 *
                  (pos.side === "long" ? 1 : -1)
                : 0;
            const flat = pnl === 0;
            const tone = flat ? "text-soft" : pnl > 0 ? "text-price-up" : "text-price-down";

            return (
              <div key={pos.id} className="f0-ledger-row">
                <CompanyLogo
                  symbol={pos.symbol}
                  name={pos.symbol}
                  size={34}
                  rounded="rounded-lg"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[15px] font-extrabold tracking-tight text-ink">
                    ${pos.symbol}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-soft">
                    {pos.side === "long" ? "Long" : "Short"} · {pos.quantity.toLocaleString()}{" "}
                    {pos.quantity === 1 ? "share" : "shares"} · entry $
                    {pos.entryPrice.toFixed(2)}
                    {pos.stopLoss ? ` · stop $${pos.stopLoss.toFixed(2)}` : ""}
                    {pos.takeProfit ? ` · target $${pos.takeProfit.toFixed(2)}` : ""}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-mono text-[15px] font-semibold tabular-nums text-ink">
                    ${mark.toFixed(2)}
                  </p>
                  <p className={`mt-0.5 font-mono text-[12px] font-semibold tabular-nums ${tone}`}>
                    {pnl > 0 ? "+" : ""}${pnl.toFixed(2)} · {pnlPct > 0 ? "+" : ""}
                    {pnlPct.toFixed(2)}%
                  </p>
                </div>

                <button
                  onClick={() => onClosePosition(pos.id)}
                  title={`Close ${pos.symbol}`}
                  aria-label={`Close ${pos.symbol} position`}
                  className="ml-1 shrink-0 rounded-full p-1.5 text-soft transition-colors hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
