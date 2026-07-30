import Link from "next/link";
import TickerTile from "@/ui-v3/components/TickerTile";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import { DISCOVER_EMPTY } from "@/ui-v3/discover-copy";
import { SHOW_SAVE_SCREEN } from "@/ui-v3/launch-flags";
import type { ScreenerCandidateVM } from "@/ui-v3/screener-filter";
import Sparkline from "./Sparkline";
import styles from "./ScreenerResults.module.css";

/**
 * The screener result list: a count/sort line, then one flat row per match.
 *
 * The row is tile · symbol · sparkline · price · day change · club-signal pill.
 * Everything after the symbol is optional on the view model — a name with no
 * quote renders the row without a price rather than with a zero.
 *
 * LAUNCH TRIM. The artboard's "Save screen" sits behind SHOW_SAVE_SCREEN
 * (src/ui-v3/launch-flags.ts). `screener_saved_screens` exists and the old
 * surface writes to it, but v3 has no saved-screens list to open, so the words
 * would be a button that does nothing — and now that the chips are live, that is
 * the only inert control left on the board.
 */
export default function ScreenerResults({
  rows,
  summary,
}: {
  rows: ScreenerCandidateVM[];
  summary: string;
}) {
  return (
    <>
      <div className={styles.head}>
        <span className={styles.summary} data-numeric>
          {summary}
        </span>
        {SHOW_SAVE_SCREEN ? <span className={styles.save}>Save screen</span> : null}
      </div>

      {rows.length === 0 ? <EmptyNote>{DISCOVER_EMPTY.screenerRows}</EmptyNote> : null}

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
        ))}
      </div>
    </>
  );
}
