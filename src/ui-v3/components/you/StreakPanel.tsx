import type { StreakPanelVM } from "@/ui-v3/you-data";
import GradientPanel from "@/ui-v3/components/GradientPanel";
import styles from "./StreakPanel.module.css";

/**
 * The streak panel. The seven pips are a real oldest→newest 7-day window from
 * src/lib/streak (`window7`), not a bar filled from the streak count.
 */
export default function StreakPanel({ vm }: { vm: StreakPanelVM }) {
  return (
    <GradientPanel tone="streak" className={styles.panel}>
      <div className={styles.flame}>🔥</div>

      <div className={styles.body}>
        <div className={styles.eyebrow}>Your streak</div>
        <div className={styles.count} data-numeric>
          {vm.days} <span className={styles.unit}>{vm.days === 1 ? "day" : "days"} in a row</span>
        </div>
      </div>

      <div className={styles.pips}>
        {vm.window7.map((on, i) => (
          <span key={i} className={`${styles.pip} ${on ? styles.pipOn : ""}`} />
        ))}
      </div>
    </GradientPanel>
  );
}
