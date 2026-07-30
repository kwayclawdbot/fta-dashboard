import Link from "next/link";
import type { TrendingStripVM } from "@/ui-v3/home-data";
import SectionEyebrow, { EyebrowAccent } from "./SectionEyebrow";
import TickerTile from "./TickerTile";
import RankPip from "./RankPip";
import EmptyNote from "./EmptyNote";
import styles from "./TopInTheClub.module.css";

/**
 * The ranked attention strip. Each card is rank pip + ticker tile + symbol +
 * metric + delta, and rank 1 alone carries the accent border and halo.
 *
 * ONE UNIT FOR THE WHOLE STRIP. `metric` is a percentage on every card or a raw
 * club score on every card — never a mix — and when it is the score the mono
 * `unitLabel` names it, because an unlabelled "9" beside a "100%" is a lie about
 * what was measured. home-data.ts owns that choice; this component only prints.
 *
 * The trailing line is the trending contract's compliance disclaimer, which that
 * contract documents as MUST-render wherever the ledger is shown.
 */
export default function TopInTheClub({ strip }: { strip: TrendingStripVM }) {
  return (
    <section className={styles.section}>
      <SectionEyebrow caption="Live ranking by member attention &amp; conviction">
        Top in <EyebrowAccent>the club</EyebrowAccent>
      </SectionEyebrow>

      {strip.unitLabel ? <div className={styles.unit}>{strip.unitLabel}</div> : null}

      {strip.tiles.length === 0 ? (
        <EmptyNote>
          The attention ledger is still filling. Ranked names appear once the Club starts
          reading and taking sides.
        </EmptyNote>
      ) : (
      <div className={styles.strip}>
        {strip.tiles.map((row) => (
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
      )}

      <p className={styles.disclaimer}>{strip.disclaimer}</p>
    </section>
  );
}
