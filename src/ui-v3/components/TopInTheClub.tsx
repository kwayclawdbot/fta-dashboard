import Link from "next/link";
import type { TrendingTileVM } from "@/ui-v3/home-data";
import SectionEyebrow, { EyebrowAccent } from "./SectionEyebrow";
import TickerTile from "./TickerTile";
import RankPip from "./RankPip";
import styles from "./TopInTheClub.module.css";

/**
 * The ranked attention strip. Each card is rank pip + ticker tile + symbol +
 * metric + delta, and rank 1 alone carries the accent border and halo.
 *
 * `metric` is a percentage when the trending core supplied a real one (heat or
 * bullPct); otherwise it is the raw attention score and renders WITHOUT a "%",
 * because that number is unbounded and a percent sign would be a lie.
 */
export default function TopInTheClub({ rows }: { rows: TrendingTileVM[] }) {
  if (rows.length === 0) return null;

  return (
    <section className={styles.section}>
      <SectionEyebrow caption="Live ranking by member attention &amp; conviction">
        Top in <EyebrowAccent>the club</EyebrowAccent>
      </SectionEyebrow>

      <div className={styles.strip}>
        {rows.map((row) => (
          <Link
            key={row.ticker}
            href={`/v3/discover`}
            className={`${styles.card} ${row.rank === 1 ? styles.lead : ""}`}
          >
            <RankPip rank={row.rank} lead={row.rank === 1} />
            <div className={styles.tile}>
              <TickerTile ticker={row.ticker} size="lg" />
            </div>
            <div className={styles.ticker}>{row.ticker}</div>
            {row.metric !== null ? (
              <div className={styles.metric} data-numeric>
                {row.metric}
                {row.isPct ? "%" : ""}
              </div>
            ) : null}
            {row.delta !== null ? (
              <div
                className={`${styles.delta} ${row.delta < 0 ? styles.deltaDown : ""}`}
                data-numeric
              >
                {row.delta < 0 ? "▼" : "▲"} {Math.abs(row.delta)}
              </div>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
