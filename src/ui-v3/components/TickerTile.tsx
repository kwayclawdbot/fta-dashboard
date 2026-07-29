import type { CSSProperties } from "react";
import { tickerGlyph, tickerPaint } from "@/ui-v3/ticker-palette";
import styles from "./TickerTile.module.css";

/**
 * A ticker's identity square. `size` matches the two the artboards use:
 * "lg" (34px) in the Top-in-the-Club strip, "sm" (26px) in a signal row.
 *
 * The brand pair comes from the mockup-derived palette; unknown tickers fall
 * back to the artboards' own neutral (surface / text-muted) treatment.
 */
export default function TickerTile({
  ticker,
  size = "sm",
}: {
  ticker: string;
  size?: "lg" | "sm";
}) {
  const paint = tickerPaint(ticker);
  return (
    <div
      className={`${styles.tile} ${size === "lg" ? styles.lg : styles.sm}`}
      style={{ "--tile-bg": paint.bg, "--tile-fg": paint.fg } as CSSProperties}
      aria-hidden="true"
    >
      {tickerGlyph(ticker)}
    </div>
  );
}
