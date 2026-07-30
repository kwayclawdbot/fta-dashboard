import type { TechIndicatorVM } from "@/ui-v3/ticker-data";
import styles from "./StateTiles.module.css";

/**
 * The trend-state row at the foot of "12 Ticker Technicals".
 *
 * The artboard draws four: MA20, MA50, MA200 and relative volume.
 * `screener_metrics` carries `ema20_state` and `ema50_state` and no 200-period
 * state at all, so the row is the three tiles that have a source — and the
 * labels say EMA, because that is what the column actually holds.
 *
 * Relative volume is deliberately toneless. Volume is loud or quiet, not
 * bullish or bearish, and painting it green would make a crowded seller look
 * like a buyer.
 */
export default function StateTiles({ tiles }: { tiles: TechIndicatorVM[] }) {
  if (tiles.length === 0) return null;
  return (
    <div className={styles.row}>
      {tiles.map((tile) => (
        <div key={tile.label} className={styles.tile}>
          <div
            className={`${styles.value} ${
              tile.bullish === true
                ? styles.up
                : tile.bullish === false
                  ? styles.down
                  : styles.flat
            }`}
            data-numeric
          >
            {tile.value}
          </div>
          <div className={styles.label}>{tile.label}</div>
        </div>
      ))}
    </div>
  );
}
