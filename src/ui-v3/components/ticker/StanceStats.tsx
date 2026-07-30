import type { StatCardVM } from "@/ui-v3/ticker-data";
import styles from "./StanceStats.module.css";

/**
 * The four small stat cards under the stance region.
 *
 * The artboard draws FOUR; three of them have a source and one does not. Its
 * "88% Black Belts" needs a per-ticker belt x stance join that exists nowhere,
 * so the row renders the cards that are real and the remaining three share the
 * width — the artboard's own `flex: 1` does that without any change here.
 *
 * An empty array renders nothing at all rather than a row of empty boxes: with
 * no stance and no club rank there is no measurement to caption.
 */
export default function StanceStats({ stats }: { stats: StatCardVM[] }) {
  if (stats.length === 0) return null;
  return (
    <div className={styles.row}>
      {stats.map((stat) => (
        <div key={stat.label} className={styles.card}>
          <div className={`${styles.value} ${styles[stat.tone]}`} data-numeric>
            {stat.value}
          </div>
          <div className={styles.label}>{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
