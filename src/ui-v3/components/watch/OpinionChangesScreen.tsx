import Link from "next/link";
import AppShell from "@/ui-v3/components/AppShell";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import TickerTile from "@/ui-v3/components/TickerTile";
import type { OpinionChangesVM } from "@/ui-v3/watch-data";
import WatchHeader from "./WatchHeader";
import styles from "./OpinionChangesScreen.module.css";

/**
 * /v3/watch/changes — Opinion Changes.
 *
 * NO ARTBOARD. Composed from the grammar (§9): the Watch head, one
 * SectionEyebrow, and the flat list row with a mono trailing figure — the same
 * shape the alert digest uses for its follow-through readout.
 *
 * WHAT THE ROW CAN AND CANNOT SAY. `get_stance_shifts` is aggregate-only by
 * construction: it counts stance rows that were updated after they were created
 * and sums the current votes. So a row can say how many members moved and which
 * way the club leans NOW; it can never say who moved, or what any one member
 * moved from. The direction is therefore worded as the club's present stance,
 * not as a flip — the per-member flip is a different object entirely (the
 * "Changed my mind" card on 04 Club Feed, which is a `stance_events` row with a
 * real author).
 */
export default function OpinionChangesScreen({ model }: { model: OpinionChangesVM }) {
  return (
    <AppShell>
      <WatchHeader active="none" closeHref="/v3/watch" tabGap="16px" />

      <SectionEyebrow
        caption={`Members who changed their stance in the last ${model.hours} hours`}
      >
        Opinion changes
      </SectionEyebrow>

      {model.rows.length === 0 ? (
        <EmptyNote>
          Nobody has changed their mind in the last {model.hours} hours. When the Club turns on a
          ticker, it shows up here first.
        </EmptyNote>
      ) : (
        <div className={styles.list}>
          {model.rows.map((row) => (
            <Link key={row.ticker} href={row.href} className={styles.row}>
              <TickerTile ticker={row.ticker} size="sm" />
              <span className={styles.copy}>
                <span className={styles.symbol}>{row.ticker}</span>
                <span className={styles.caption}>
                  {row.shifts} member{row.shifts === 1 ? "" : "s"} changed their mind
                </span>
              </span>
              <span
                className={`${styles.net} ${
                  row.net > 0 ? styles.bull : row.net < 0 ? styles.bear : styles.even
                }`}
                data-numeric
              >
                {row.net === 0 ? "Split" : `${row.net > 0 ? "Bullish" : "Bearish"} ${Math.abs(row.net)}`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
