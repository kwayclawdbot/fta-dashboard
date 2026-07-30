import Link from "next/link";
import AppShell from "@/ui-v3/components/AppShell";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import TickerTile from "@/ui-v3/components/TickerTile";
import type { EarningsVM } from "@/ui-v3/watch-data";
import WatchHeader from "./WatchHeader";
import { DayRule } from "./KaiDigestHeader";
import styles from "./EarningsScreen.module.css";

/**
 * /v3/watch/earnings — the Earnings Calendar.
 *
 * NO ARTBOARD, AND — more importantly — NO DATA. There is no earnings source
 * anywhere in this application: no table or column in any migration, no
 * earnings call on the Polygon client, and no ingest route for the
 * `cron-earnings-ingest` service. The full verdict is recorded on
 * `getWatchEarnings()` in watch-data.ts.
 *
 * So this screen renders its real frame — the Watch head, the section that
 * would hold the week, the day rule the alert stream already uses for grouping —
 * and says plainly that the feed is not connected. It does not print a date it
 * cannot source. The artboard's own "This week: 17 companies" caption is
 * likewise absent from the hub row rather than invented.
 *
 * FLAGGED FOR THE OWNER: this screen is a real destination with no source
 * behind it. It stays honest-empty until an earnings feed lands; the day/row
 * shape below is already wired to `model.days` and will fill itself the moment
 * one does.
 */
export default function EarningsScreen({ model }: { model: EarningsVM }) {
  return (
    <AppShell>
      <WatchHeader active="none" closeHref="/v3/watch" tabGap="16px" />

      <div className={styles.section}>
        <SectionEyebrow
          caption={
            model.symbols === null
              ? undefined
              : `Scoped to your ${model.symbols} watchlist symbol${model.symbols === 1 ? "" : "s"}`
          }
        >
          Earnings calendar
        </SectionEyebrow>
      </div>

      {model.days.length === 0 ? (
        <EmptyNote>
          No earnings feed is connected yet, so there are no dates to show. Rather than guess a
          report date — the one number here you&rsquo;d size a position against — this stays
          empty until the calendar is wired up.
        </EmptyNote>
      ) : (
        model.days.map((day) => (
          <section key={day.day} className={styles.day}>
            <DayRule>{day.day.toUpperCase()}</DayRule>
            {day.rows.map((row) => (
              <Link key={row.ticker} href={row.href} className={styles.row}>
                <TickerTile ticker={row.ticker} size="sm" />
                <span className={styles.copy}>
                  <span className={styles.symbol}>{row.ticker}</span>
                  {row.name ? <span className={styles.caption}>{row.name}</span> : null}
                </span>
                {row.session ? <span className={styles.session}>{row.session}</span> : null}
              </Link>
            ))}
          </section>
        ))
      )}
    </AppShell>
  );
}
