import type { RecentCallVM } from "@/ui-v3/you-data";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import styles from "./RecentCalls.module.css";

/**
 * The member's last stance changes.
 *
 * The section keeps its eyebrow and its container when there are none. No
 * artboard draws an empty state here — every board is shot on a member with a
 * history — so this reuses the boards' own flat-card container rather than
 * inventing a pattern for absence. Dropping the region entirely, which is what
 * it used to do, ended the profile in a screen of black.
 */
export default function RecentCalls({
  rows,
  seeAllHref,
}: {
  rows: RecentCallVM[];
  seeAllHref: string | null;
}) {
  if (rows.length === 0) {
    return (
      <div className={styles.section}>
        <SectionEyebrow labelTone="accent">Recent calls</SectionEyebrow>
        <EmptyNote>
          No stance changes yet. Post a take, change your mind, and the receipts land here.
        </EmptyNote>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <SectionEyebrow
        labelTone="accent"
        actionLabel={seeAllHref ? "See all" : undefined}
        actionHref={seeAllHref ?? undefined}
        actionTone="dim"
      >
        Recent calls
      </SectionEyebrow>

      <div className={styles.list}>
        {rows.map((row) => (
          <div key={row.id} className={styles.row}>
            <span className={styles.ticker}>{row.ticker}</span>
            <span className={styles.text}>{row.text}</span>
            {row.result ? (
              <span
                className={`${styles.result} ${row.result.win ? styles.win : styles.loss}`}
                data-numeric
              >
                {row.result.win ? "✓" : "✗"} {row.result.move}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
