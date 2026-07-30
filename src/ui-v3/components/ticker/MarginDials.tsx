import type { CSSProperties } from "react";
import type { MarginDialVM } from "@/ui-v3/ticker-data";
import styles from "./MarginDials.module.css";

/**
 * The three margin dials on "13 Ticker Fundamentals".
 *
 * Each is a trailing-twelve-month margin: four reported quarters summed, then
 * divided by the same four quarters' revenue. TTM rather than latest-quarter
 * because a single quarter's margin swings on a calendar, and a dial that moves
 * because of seasonality reads as a business changing when it is not.
 *
 * The artboard's third dial is FCF margin. Polygon's standardized cash-flow
 * block carries operating cash flow but no capital-expenditure line, so free
 * cash flow cannot be derived — the dial shows OPERATING cash margin and is
 * labelled that way.
 *
 * A dial only renders when its numerator and denominator are both present for
 * all four quarters, so the three can legitimately come back as two or none.
 */
export default function MarginDials({ margins }: { margins: MarginDialVM[] }) {
  if (margins.length === 0) return null;
  return (
    <div className={styles.row}>
      {margins.map((m) => (
        <div key={m.label} className={styles.card}>
          <div
            className={`${styles.dial} ${styles[m.tone]}`}
            style={{ "--pct": `${Math.max(0, Math.min(100, m.pct))}%` } as CSSProperties}
          >
            <div className={styles.arc} />
            <div className={styles.disc}>
              <span className={styles.value} data-numeric>
                {m.pct}%
              </span>
            </div>
          </div>
          <div className={styles.label}>{m.label}</div>
        </div>
      ))}
    </div>
  );
}
