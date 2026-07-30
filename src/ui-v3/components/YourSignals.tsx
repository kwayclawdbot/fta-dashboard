import Link from "next/link";
import { SIGNAL_MIN, type SignalRowVM } from "@/ui-v3/home-data";
import SectionEyebrow from "./SectionEyebrow";
import TickerTile from "./TickerTile";
import EmptyNote from "./EmptyNote";
import styles from "./YourSignals.module.css";

/**
 * The personal signal stack. Each row is tile + symbol + what changed + one
 * trailing affordance, chosen from the three the artboard defines.
 *
 * home-data.ts has already dropped the foryou core's "nothing changed" filler,
 * so what arrives here is only rows that say something. Below SIGNAL_MIN the
 * section keeps its eyebrow and shows the honest state instead: one lonely row
 * under a three-row heading looked like a screen with content missing, and
 * padding it back out with filler was the thing that made it read as fake.
 */
export default function YourSignals({ rows }: { rows: SignalRowVM[] }) {
  if (rows.length < SIGNAL_MIN) {
    return (
      <section className={styles.section}>
        <SectionEyebrow actionLabel="See all" actionHref="/v3/watch">
          Your signals
        </SectionEyebrow>
        {/* This region is empty because the member has not named anything to
            watch yet — which makes the fix theirs to make, and the note says
            where. See EmptyNote's own header note on when an action is allowed. */}
        <EmptyNote action={{ label: "Add names you care about", href: "/v3/watch" }}>
          Signals appear as your watchlist heats up — new watchers, opinion swings, and Kai
          Watch moving toward a trigger.
        </EmptyNote>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <SectionEyebrow actionLabel="See all" actionHref="/v3/watch">
        Your signals
      </SectionEyebrow>

      <div className={styles.list}>
        {rows.map((row) => (
          <Link key={row.ticker} href={`/v3/ticker/${row.ticker}`} className={styles.row}>
            <TickerTile ticker={row.ticker} size="sm" />
            <span className={styles.ticker}>{row.ticker}</span>
            <span className={styles.text}>{row.text}</span>
            {row.affordance === "add" ? (
              <span className={styles.add} aria-hidden="true">
                ＋
              </span>
            ) : row.affordance === "count" && row.count !== null ? (
              <span className={styles.count} data-numeric>
                {row.count}
              </span>
            ) : (
              <span className={styles.go} aria-hidden="true">
                →
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
