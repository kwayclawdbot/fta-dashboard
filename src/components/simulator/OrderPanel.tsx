"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { SimSection, SimRow, SimValue, SimNumField, SimChip } from "./parts";

/**
 * THE ORDER TICKET — ruled field rows, not a bordered panel.
 *
 * Behaviour is unchanged: the same quantity / stop / target inputs, the same
 * quick-size percentages of buying power, the same "can't spend more than the
 * cash balance" guard, and the same submit payload.
 *
 * COLOUR LAW: the direction toggle does NOT wear green/red. Green and red are
 * the price colours, and spending them on a control is exactly what made the
 * old panel read as a terminal. Direction is the word plus its arrow; the
 * selected state is the brand orange, because selecting is an action.
 */

interface OrderPanelProps {
  currentPrice: number;
  balance: number;
  symbol: string;
  onSubmitOrder: (order: {
    side: "long" | "short";
    quantity: number;
    stopLoss?: number;
    takeProfit?: number;
  }) => void;
}

const QUICK_PCTS = [25, 50, 75, 100];

export default function OrderPanel({
  currentPrice,
  balance,
  symbol,
  onSubmitOrder,
}: OrderPanelProps) {
  const [side, setSide] = useState<"long" | "short">("long");
  const [quantity, setQuantity] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  const maxShares = currentPrice > 0 ? Math.floor(balance / currentPrice) : 0;
  const qty = parseInt(quantity) || 0;
  const orderCost = qty * currentPrice;

  function handleQuickPct(pct: number) {
    const shares = Math.floor((maxShares * pct) / 100);
    setQuantity(shares.toString());
  }

  function handleSubmit() {
    if (qty <= 0 || qty > maxShares) return;
    onSubmitOrder({
      side,
      quantity: qty,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
    });
    setQuantity("");
    setStopLoss("");
    setTakeProfit("");
  }

  return (
    <SimSection id="sim-order" label={`Order · $${symbol}`}>
      <div className="f0-ledger">
        <SimRow label="Direction" wrap>
          <SimChip active={side === "long"} onClick={() => setSide("long")}>
            <TrendingUp className="h-3.5 w-3.5" />
            Buy
          </SimChip>
          <SimChip active={side === "short"} onClick={() => setSide("short")}>
            <TrendingDown className="h-3.5 w-3.5" />
            Sell short
          </SimChip>
        </SimRow>

        <SimRow label="Market price" hint="The last simulated print">
          <SimValue>{currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : "—"}</SimValue>
        </SimRow>

        <SimRow
          label="Shares"
          hint={
            maxShares > 0
              ? `${maxShares.toLocaleString()} affordable with your cash`
              : "Waiting on a price"
          }
          wrap
        >
          <SimNumField
            ariaLabel="Shares"
            value={quantity}
            onChange={setQuantity}
            placeholder="0"
            width="w-24"
            min={0}
            max={maxShares}
          />
          {QUICK_PCTS.map((pct) => (
            <SimChip
              key={pct}
              onClick={() => handleQuickPct(pct)}
              disabled={maxShares <= 0}
              title={`${pct}% of buying power`}
            >
              {pct}%
            </SimChip>
          ))}
        </SimRow>

        <SimRow label="Stop loss" hint="Optional — closes you out if it goes against you">
          <SimNumField
            ariaLabel="Stop loss price"
            prefix="$"
            value={stopLoss}
            onChange={setStopLoss}
            step="0.01"
          />
        </SimRow>

        <SimRow label="Take profit" hint="Optional — closes you out at your target">
          <SimNumField
            ariaLabel="Take profit price"
            prefix="$"
            value={takeProfit}
            onChange={setTakeProfit}
            step="0.01"
          />
        </SimRow>

        <SimRow label="Estimated cost">
          <SimValue tone={qty > 0 ? "text-ink" : "text-soft"}>
            {qty > 0
              ? `$${orderCost.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "—"}
          </SimValue>
        </SimRow>
      </div>

      <button
        onClick={handleSubmit}
        disabled={qty <= 0 || qty > maxShares}
        className="cta-button mt-4 w-full rounded-xl py-3 text-[14px] disabled:cursor-not-allowed disabled:opacity-35"
      >
        {side === "long" ? "Buy" : "Sell short"}
        {qty > 0 ? ` ${qty.toLocaleString()} ${qty === 1 ? "share" : "shares"}` : ""}
      </button>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
        Practice money · nothing here touches a real account
      </p>
    </SimSection>
  );
}
