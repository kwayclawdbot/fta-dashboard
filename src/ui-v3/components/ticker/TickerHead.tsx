import Link from "next/link";
import TickerTile from "@/ui-v3/components/TickerTile";
import type { TickerHeadVM } from "@/ui-v3/ticker-data";
import styles from "./TickerHead.module.css";

/**
 * The compact identity row that "12 Ticker Technicals", "13 Ticker
 * Fundamentals" and "14 Kai Report" all open with: back arrow, 28px tile,
 * symbol, price, day change — one line, 10px gaps.
 *
 * The Overview board draws a fuller hero instead (see TickerHero); these three
 * drill-downs share this one exactly as the artboards do.
 *
 * Price and change are both optional on the view model. A name the feed has no
 * quote for prints its symbol alone rather than a dash pretending to be a price.
 */
export default function TickerHead({ head }: { head: TickerHeadVM }) {
  return (
    <div className={styles.row}>
      <Link href={`/v3/ticker/${head.symbol}`} className={styles.back} aria-label="Ticker overview">
        ←
      </Link>
      <TickerTile ticker={head.symbol} size="md" />
      <span className={styles.symbol}>{head.symbol}</span>
      {head.price !== null ? (
        <span className={styles.price} data-numeric>
          ${head.price.toFixed(2)}
        </span>
      ) : null}
      {head.changePct !== null ? (
        <span
          className={`${styles.change} ${head.changePct < 0 ? styles.down : ""}`}
          data-numeric
        >
          {head.changePct < 0 ? "▼" : "▲"}
          {Math.abs(head.changePct).toFixed(2)}%
        </span>
      ) : null}
    </div>
  );
}
