import type { CSSProperties } from "react";
import styles from "./ScoreRing.module.css";

/**
 * The 64px dial on the profile header. The caller supplies the number, the fill
 * percentage and the two caption lines — this component never derives its own.
 */
export default function ScoreRing({
  pct,
  value,
  label,
}: {
  /** 0-100. The conic hard stop. */
  pct: number;
  value: string;
  /** Caption, one entry per line — the artboard stacks "OPINION" / "SCORE". */
  label: string[];
}) {
  return (
    <div className={styles.ring} style={{ "--ring-pct": `${pct}%` } as CSSProperties}>
      <div className={styles.disc}>
        <div>
          <div className={styles.value} data-numeric>
            {value}
          </div>
          <div className={styles.label}>
            {label.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
