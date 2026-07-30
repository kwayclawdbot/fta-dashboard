import type { SetupProgressVM } from "@/ui-v3/watch-data";
import GradientPanel from "@/ui-v3/components/GradientPanel";
import ConditionDial from "./ConditionDial";
import ConditionMark from "./ConditionMark";
import styles from "./GettingClosePanel.module.css";

/**
 * The setup closest to firing: its name, the met/total dial, and every
 * condition with its evaluated state.
 *
 * HONESTY NOTE. The artboard closes this panel with "Est. Trigger: Today".
 * Nothing in the setup engine forecasts a trigger time — conditions are
 * evaluated, not predicted — so that slot carries the real fact it sits next
 * to: when the setup was last evaluated. The typography is unchanged; only the
 * claim is. If the setup has never been evaluated the footer is omitted.
 */
export default function GettingClosePanel({ setup }: { setup: SetupProgressVM }) {
  return (
    <GradientPanel tone="close" href={setup.href ?? undefined} className={styles.panel}>
      <div className={styles.eyebrow}>Getting close</div>
      <div className={styles.title}>{setup.title}</div>

      <div className={styles.body}>
        <ConditionDial met={setup.met} total={setup.conditions.length} />
        <div className={styles.conditions}>
          {setup.conditions.map((condition) => (
            <div
              key={condition.label}
              className={`${styles.condition} ${condition.met ? "" : styles.conditionPending}`}
            >
              <ConditionMark met={condition.met} />
              {condition.label}
            </div>
          ))}
        </div>
      </div>

      {setup.evaluatedLabel ? (
        <div className={styles.footer}>
          Last checked: <span className={styles.footerValue}>{setup.evaluatedLabel}</span>
        </div>
      ) : null}
    </GradientPanel>
  );
}
