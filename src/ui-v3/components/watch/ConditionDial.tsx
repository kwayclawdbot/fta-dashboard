import type { CSSProperties } from "react";
import styles from "./ConditionDial.module.css";

/**
 * met / total, drawn as the artboard's 88px arc.
 *
 * The arc is the fraction itself — nothing is smoothed, projected, or padded.
 * A setup with zero conditions evaluated yields an empty arc rather than a
 * flattering default.
 */
export default function ConditionDial({ met, total }: { met: number; total: number }) {
  const pct = total > 0 ? Math.round((met / total) * 100) : 0;
  return (
    <div className={styles.dial} style={{ "--dial-pct": `${pct}%` } as CSSProperties}>
      <div className={styles.arc} />
      <div className={styles.face}>
        <span className={styles.value} data-numeric>
          {met}/{total}
        </span>
      </div>
    </div>
  );
}
