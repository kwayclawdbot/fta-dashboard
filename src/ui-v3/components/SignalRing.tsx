import type { CSSProperties } from "react";
import styles from "./SignalRing.module.css";

/**
 * A conic progress dial with a value in the middle.
 *
 * `pct` fills the ring; `value` and `label` are what the inner disc reads.
 * Caller decides what the number means — this primitive never derives it.
 */
export default function SignalRing({
  pct,
  value,
  label,
}: {
  pct: number;
  value: string;
  label: string;
}) {
  return (
    <div
      className={styles.ring}
      style={{ "--ring-pct": `${Math.max(0, Math.min(100, pct))}%` } as CSSProperties}
    >
      <div className={styles.disc}>
        <div>
          <div className={styles.value} data-numeric>
            {value}
          </div>
          <div className={styles.label}>{label}</div>
        </div>
      </div>
    </div>
  );
}
