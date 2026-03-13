"use client";

import { useState } from "react";

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
    <div className="bg-midnight-900 border border-midnight-700/50 rounded-lg p-4">
      <h3 className="text-sm font-display font-semibold text-midnight-100 mb-3">
        Order — {symbol}
      </h3>

      {/* Buy/Sell tabs */}
      <div className="flex gap-1 mb-4 bg-midnight-800 rounded-lg p-0.5">
        <button
          onClick={() => setSide("long")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            side === "long"
              ? "bg-green-400/15 text-green-400"
              : "text-midnight-400 hover:text-midnight-200"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("short")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            side === "short"
              ? "bg-red-500/15 text-red-500"
              : "text-midnight-400 hover:text-midnight-200"
          }`}
        >
          Sell Short
        </button>
      </div>

      {/* Price display */}
      <div className="flex justify-between items-center mb-3 px-1">
        <span className="text-xs text-midnight-400">Market Price</span>
        <span className="text-sm font-mono text-midnight-100">
          ${currentPrice.toFixed(2)}
        </span>
      </div>

      {/* Quantity */}
      <div className="mb-3">
        <label className="text-xs text-midnight-400 mb-1 block">Shares</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0"
          min={0}
          max={maxShares}
          className="w-full bg-midnight-800 border border-midnight-700/50 rounded-lg px-3 py-2 text-sm font-mono text-midnight-100 placeholder:text-midnight-600 focus:outline-none focus:border-gold-400/30"
        />
        {/* Quick buttons */}
        <div className="flex gap-1 mt-1.5">
          {QUICK_PCTS.map((pct) => (
            <button
              key={pct}
              onClick={() => handleQuickPct(pct)}
              className="flex-1 py-1 rounded text-[11px] font-mono bg-midnight-800 border border-midnight-700/50 text-midnight-400 hover:text-gold-400 hover:border-gold-400/30 transition-colors"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Stop Loss */}
      <div className="mb-3">
        <label className="text-xs text-midnight-400 mb-1 block">Stop Loss</label>
        <input
          type="number"
          value={stopLoss}
          onChange={(e) => setStopLoss(e.target.value)}
          placeholder="Optional"
          step="0.01"
          className="w-full bg-midnight-800 border border-midnight-700/50 rounded-lg px-3 py-2 text-sm font-mono text-midnight-100 placeholder:text-midnight-600 focus:outline-none focus:border-gold-400/30"
        />
      </div>

      {/* Take Profit */}
      <div className="mb-4">
        <label className="text-xs text-midnight-400 mb-1 block">Take Profit</label>
        <input
          type="number"
          value={takeProfit}
          onChange={(e) => setTakeProfit(e.target.value)}
          placeholder="Optional"
          step="0.01"
          className="w-full bg-midnight-800 border border-midnight-700/50 rounded-lg px-3 py-2 text-sm font-mono text-midnight-100 placeholder:text-midnight-600 focus:outline-none focus:border-gold-400/30"
        />
      </div>

      {/* Order summary */}
      <div className="flex justify-between text-xs text-midnight-400 mb-3 px-1">
        <span>Est. Cost</span>
        <span className="font-mono">${orderCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
      </div>
      <div className="flex justify-between text-xs text-midnight-400 mb-4 px-1">
        <span>Max Shares</span>
        <span className="font-mono">{maxShares.toLocaleString()}</span>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={qty <= 0 || qty > maxShares}
        className={`w-full py-2.5 rounded-lg text-sm font-display font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
          side === "long"
            ? "bg-green-400/15 text-green-400 hover:bg-green-400/25 border border-green-400/30"
            : "bg-red-500/15 text-red-500 hover:bg-red-500/25 border border-red-500/30"
        }`}
      >
        {side === "long" ? "Buy" : "Sell Short"} {qty > 0 ? `${qty} shares` : ""}
      </button>
    </div>
  );
}
