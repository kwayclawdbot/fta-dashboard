import type { CSSProperties } from "react";
import styles from "./SignalGauge.module.css";

/**
 * "12 Ticker Technicals"'s half-dial.
 *
 * THE WORD IS NOT "BUY". The artboard prints an execution verb over the needle;
 * the mix behind it is real (see `mixOf` in ticker-data.ts — every check is a
 * field that exists), but naming a trade is advice, and no other club surface
 * does it. So the dial prints a DESCRIPTION of the mix and the count behind it,
 * which is the same information without the instruction.
 *
 * The needle angle is the mix share mapped across the dial's 180°: 0% points
 * left (the SELL end), 100% points right (the BUY end). It is derived from the
 * same number printed beside it, so the two can never disagree.
 */
export default function SignalGauge({
  pct,
  word,
  bullish,
  total,
}: {
  pct: number;
  word: string;
  bullish: number;
  total: number;
}) {
  const angle = Math.round((Math.max(0, Math.min(100, pct)) / 100) * 180) - 90;
  const tone = pct >= 70 ? styles.up : pct <= 30 ? styles.down : styles.mid;

  return (
    <div className={styles.card}>
      <div className={styles.dial}>
        <div className={styles.arc} />
        <div className={styles.hole} />
        <div
          className={styles.needle}
          style={{ "--needle": `${angle}deg` } as CSSProperties}
          aria-hidden="true"
        />
        <div className={styles.ends}>
          <span>SELL</span>
          <span>BUY</span>
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.eyebrow}>Signal mix</div>
        <div className={`${styles.word} ${tone}`}>{word}</div>
        <div className={styles.sub}>
          <span className={styles.count} data-numeric>
            {bullish} of {total}
          </span>{" "}
          readings bullish
        </div>
      </div>
    </div>
  );
}
