import type { ReactNode } from "react";
import Link from "next/link";
import TickerTile from "@/ui-v3/components/TickerTile";
import type { ScreenerCandidateVM } from "@/ui-v3/screener-filter";
import Sparkline from "./Sparkline";
import styles from "./ScreenerRow.module.css";

/**
 * ONE ledger row: tile · symbol · sparkline · price · day change · club-signal
 * pill, linking to the ticker.
 *
 * Everything after the symbol is optional on the view model — a name with no
 * quote renders the row without a price rather than with a zero, and a name the
 * Club has not said enough about renders no pill rather than a 100% that is one
 * member's click.
 *
 * This is the composition board 15 draws for a screener match. "The board" on 02
 * Discover previews the SAME ranked ledger, so it renders the same component
 * rather than a second row that looks like this one today and drifts tomorrow.
 */
export default function ScreenerRow({ row }: { row: ScreenerCandidateVM }) {
  return (
    <Link href={`/v3/ticker/${row.ticker}`} className={styles.row}>
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
          tone={row.tone}
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
  );
}

/** The stack those rows sit in — the gap and top offset travel with the row. */
export function ScreenerRowList({ children }: { children: ReactNode }) {
  return <div className={styles.list}>{children}</div>;
}
