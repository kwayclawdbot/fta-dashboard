import type { CSSProperties } from "react";
import { tickerGlyph, tickerPaint } from "@/ui-v3/ticker-palette";
import styles from "./TickerTile.module.css";

/**
 * A ticker's identity square. `size` matches the four the artboards use:
 * "xl" (40px) the ticker board's identity hero, "lg" (34px) a Top-in-the-Club
 * card, "md" (28px) the ticker tab header, "sm" (26px) a signal row.
 *
 * The brand pair comes from the mockup-derived palette; unknown tickers fall
 * back to the artboards' own neutral (surface / text-muted) treatment.
 */
export default function TickerTile({
  ticker,
  size = "sm",
}: {
  ticker: string;
  size?: "xl" | "lg" | "md" | "sm";
}) {
  const paint = tickerPaint(ticker);
  return (
    <div
      className={`${styles.tile} ${styles[size]}`}
      style={{ "--tile-bg": paint.bg, "--tile-fg": paint.fg } as CSSProperties}
      aria-hidden="true"
    >
      {tickerGlyph(ticker)}
    </div>
  );
}
