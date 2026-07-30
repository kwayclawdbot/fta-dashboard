import type { CSSProperties } from "react";
import { sectorOf } from "@/lib/screener-sectors";
import type { PeerBarVM } from "@/ui-v3/ticker-data";
import styles from "./PeerValuation.module.css";

/**
 * "VALUATION VS PEERS" on "13 Ticker Fundamentals".
 *
 * The artboard says FORWARD P/E. There is no consensus-estimates feed on this
 * account, so a forward multiple cannot be computed — these are TRAILING
 * multiples off the last reported annual EPS, and the eyebrow says so. That is
 * a real difference in meaning, not a wording preference: a fast-growing name
 * looks more expensive on trailing than on forward, so relabelling it is the
 * whole correction.
 *
 * The peer set is real too: the largest other names sharing this ticker's raw
 * sector, which is the same grouping the screener filters on. The artboard's
 * closing sentence ("Cheaper than AMD despite 2x the growth") is a comparison
 * nothing computes, so the card ends at its bars.
 */
export default function PeerValuation({
  peers,
}: {
  peers: { rows: PeerBarVM[]; sector: string | null } | null;
}) {
  if (!peers) return null;
  const sector = sectorOf(peers.sector) ?? null;

  return (
    <section className={styles.card}>
      <div className={styles.eyebrow}>
        Valuation vs peers · Trailing P/E
        {sector ? <span className={styles.sector}> · {sector}</span> : null}
      </div>
      <div className={styles.rows}>
        {peers.rows.map((row) => (
          <div key={row.ticker} className={styles.row}>
            <span className={`${styles.ticker} ${row.self ? styles.self : ""}`}>{row.ticker}</span>
            <div className={styles.track}>
              <div
                className={`${styles.fill} ${row.self ? styles.fillSelf : ""}`}
                style={{ "--w": `${row.pct}%` } as CSSProperties}
              />
            </div>
            <span className={`${styles.pe} ${row.self ? styles.self : ""}`} data-numeric>
              {Math.round(row.pe)}x
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
