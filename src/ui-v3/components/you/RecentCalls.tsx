import type { RecentCallVM } from "@/ui-v3/you-data";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import styles from "./RecentCalls.module.css";

/**
 * The member's last graded calls. Omitted entirely when there are none — an
 * empty state for this region is not drawn on any artboard, and inventing one
 * would be design by improvisation.
 */
export default function RecentCalls({
  rows,
  seeAllHref,
}: {
  rows: RecentCallVM[];
  seeAllHref: string | null;
}) {
  if (rows.length === 0) return null;

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
