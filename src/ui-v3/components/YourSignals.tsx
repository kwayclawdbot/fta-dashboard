import Link from "next/link";
import type { SignalRowVM } from "@/ui-v3/home-data";
import SectionEyebrow from "./SectionEyebrow";
import TickerTile from "./TickerTile";
import styles from "./YourSignals.module.css";

/**
 * The personal signal stack. Each row is tile + symbol + what changed + one
 * trailing affordance, chosen from the three the artboard defines.
 */
export default function YourSignals({ rows }: { rows: SignalRowVM[] }) {
  if (rows.length === 0) return null;

  return (
    <section className={styles.section}>
      <SectionEyebrow actionLabel="See all" actionHref="/v3/watch">
        Your signals
      </SectionEyebrow>

      <div className={styles.list}>
        {rows.map((row) => (
          <Link key={row.ticker} href="/v3/watch" className={styles.row}>
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
