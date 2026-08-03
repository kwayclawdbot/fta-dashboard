"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  changeTone,
  formatChangePct,
  formatPrice,
  type MarketQuote,
} from "@/lib/market/client";

/**
 * Live-ish price + day-change chip. Pure presentational — the parent fetches
 * the quote (usually a single batched /api/market/quote?symbols= call for a
 * whole board) and passes it in, so a page of cards is one request, not N.
 *
 * Direction uses the locked market-semantic colors (green-team / red-team).
 * Renders nothing if there's no quote (graceful degradation to static content).
 */
export default function LivePrice({
  quote,
  size = "sm",
  showDelayed = false,
}: {
  quote: MarketQuote | null | undefined;
  size?: "sm" | "md" | "lg";
  showDelayed?: boolean;
}) {
  if (!quote || quote.price == null) return null;
  const tone = changeTone(quote.changePercent);
  const priceCls =
    size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-sm";
  const chipCls = size === "lg" ? "text-sm px-2 py-0.5" : "text-xs px-1.5 py-0.5";

  const toneCls =
    tone === "up"
      ? "bg-price-up/10 text-price-up"
      : tone === "down"
        ? "bg-price-down/10 text-price-down"
        : "bg-paper text-soft";
  const Icon =
    tone === "up" ? ArrowUpRight : tone === "down" ? ArrowDownRight : Minus;

  return (
    <div className="flex items-center gap-2">
      <span className={`font-display font-bold tabular-nums text-ink ${priceCls}`}>
        {formatPrice(quote.price)}
      </span>
      {quote.changePercent != null && (
        <span
          className={`inline-flex items-center gap-0.5 rounded-full font-semibold tabular-nums ${chipCls} ${toneCls}`}
        >
          <Icon className="h-3 w-3" />
          {formatChangePct(quote.changePercent)}
        </span>
      )}
      {/* Off-hours the mark IS the previous close (see shapeSnapshot). Say so
          rather than labelling a Friday number "delayed" on a Sunday. */}
      {showDelayed && (quote.stale || quote.delayed) && (
        <span className="text-[10px] text-soft">
          {quote.stale ? "at last close" : "delayed"}
        </span>
      )}
    </div>
  );
}
