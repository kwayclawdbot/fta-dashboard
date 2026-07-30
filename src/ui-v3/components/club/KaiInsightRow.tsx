import Link from "next/link";
import type { KaiInsightVM } from "@/ui-v3/club-data";
import styles from "./KaiInsightRow.module.css";

/**
 * The "Kai Insight" row.
 *
 * No AI-authored post exists in `feed_posts`. The nearest real source is a club
 * `pulse` signal — whose `pattern` kind IS the Kai one ("Kai spotted a
 * pattern") — so the adapter prefers that kind and the row states its detail.
 */
export default function KaiInsightRow({ kai }: { kai: KaiInsightVM }) {
  return (
    <div className={styles.row}>
      <div className={styles.mark} aria-hidden="true">
        🐋
      </div>
      <div className={styles.copy}>
        <span className={styles.name}>Kai Insight</span>
        <div className={styles.detail}>{kai.headline}</div>
      </div>
      {kai.ticker ? (
        <Link href={`/v3/ticker/${kai.ticker}/kai`} className={styles.ticker}>
          ${kai.ticker} ›
        </Link>
      ) : null}
    </div>
  );
}
