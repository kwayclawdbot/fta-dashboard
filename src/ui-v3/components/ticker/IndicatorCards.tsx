import type { CSSProperties } from "react";
import styles from "./IndicatorCards.module.css";

/**
 * The RSI + MACD pair on "12 Ticker Technicals".
 *
 * RSI is `screener_metrics.rsi14`, straight through — the marker's position IS
 * the value (a 62 sits at 62% of the track), so the drawing cannot drift from
 * the number printed above it.
 *
 * MACD is computed from real daily closes in the adapter. The histogram is
 * signed, so each bar is drawn from the zero line in its own direction and
 * coloured by that sign — the artboard's own red-then-green run is exactly what
 * a real crossover looks like, and a name that has not crossed simply shows one
 * colour.
 *
 * Either card is omitted when its source is absent; a card is never drawn empty.
 */
export default function IndicatorCards({
  rsi,
  macd,
}: {
  rsi: number | null;
  macd: { bars: number[]; crossUp: boolean | null } | null;
}) {
  if (rsi === null && macd === null) return null;

  const peak = macd ? Math.max(...macd.bars.map((b) => Math.abs(b)), 1) : 1;

  return (
    <div className={styles.row}>
      {rsi !== null ? (
        <div className={styles.card}>
          <div className={styles.head}>
            <span className={styles.label}>RSI · 14D</span>
            <span className={styles.value} data-numeric>
              {Math.round(rsi)}
            </span>
          </div>
          <div className={styles.track}>
            <span
              className={styles.marker}
              style={{ "--at": `${Math.max(0, Math.min(100, rsi))}%` } as CSSProperties}
            />
          </div>
          <div className={styles.scale}>
            <span data-numeric>30</span>
            <span data-numeric>70</span>
          </div>
        </div>
      ) : null}

      {macd ? (
        <div className={styles.card}>
          <div className={styles.head}>
            <span className={styles.label}>MACD</span>
            <span
              className={`${styles.state} ${
                macd.crossUp === true
                  ? styles.up
                  : macd.crossUp === false
                    ? styles.down
                    : styles.flat
              }`}
            >
              {macd.crossUp === true
                ? "CROSS ▲"
                : macd.crossUp === false
                  ? "CROSS ▼"
                  : "NO CROSS"}
            </span>
          </div>
          <div className={styles.hist} aria-hidden="true">
            {macd.bars.map((bar, i) => (
              <div key={i} className={styles.slot}>
                <div
                  className={`${styles.bar} ${bar >= 0 ? styles.barUp : styles.barDown}`}
                  style={
                    {
                      // Each bar hangs off the centre line, so the tallest may
                      // only use HALF the box — scaling to 100% put the peak
                      // bar through the top of the card.
                      "--h": `${Math.max(4, Math.round((Math.abs(bar) / peak) * 50))}%`,
                    } as CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
