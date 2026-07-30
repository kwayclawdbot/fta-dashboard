import Link from "next/link";
import TickerTile from "@/ui-v3/components/TickerTile";
import type { ScreenerRowVM } from "@/ui-v3/discover-data";
import Sparkline from "./Sparkline";
import styles from "./ScreenerResults.module.css";

/**
 * The screener result list: a count/sort line, then one flat row per match.
 *
 * The row is tile · symbol · sparkline · price · day change · club-signal pill.
 * Everything after the symbol is optional on the view model — a name with no
 * quote renders the row without a price rather than with a zero.
 */
export default function ScreenerResults({
  rows,
  summary,
}: {
  rows: ScreenerRowVM[];
  summary: string;
}) {
  return (
    <>
      <div className={styles.head}>
        <span className={styles.summary} data-numeric>
          {summary}
        </span>
        <span className={styles.save}>Save screen</span>
      </div>

      <div className={styles.list}>
        {rows.map((row) => (
          <Link key={row.ticker} href="/v3/discover/screener" className={styles.row}>
            <TickerTile ticker={row.ticker} size="sm" />
            <div className={styles.symbolCell}>
              <div className={styles.symbol}>{row.ticker}</div>
            </div>
            {row.series ? (
              <Sparkline
                series={row.series}
                viewWidth={52}
                viewHeight={18}
                strokeWidth={1.6}
                tone={row.changePct !== null && row.changePct < 0 ? "negative" : "positive"}
              />
            ) : (
              <span className={styles.sparkGap} aria-hidden="true" />
            )}
            <span className={styles.price} data-numeric>
              {row.priceLabel ?? ""}
            </span>
            {row.changePct !== null ? (
              <span
                className={`${styles.change} ${row.changePct < 0 ? styles.changeDown : ""}`}
                data-numeric
              >
                {row.changePct < 0 ? "▼" : "▲"}
                {Math.abs(row.changePct).toFixed(1)}%
              </span>
            ) : (
              <span className={styles.change} />
            )}
            {row.signalPct !== null ? (
              <span
                className={`${styles.signal} ${row.signalPct < 50 ? styles.signalBear : ""}`}
                data-numeric
              >
                {row.signalPct}%
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </>
  );
}
