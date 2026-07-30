import AppShell from "@/ui-v3/components/AppShell";
import type { AlertsVM } from "@/ui-v3/watch-data";
import WatchHeader from "./WatchHeader";
import KaiDigestHeader, { DayRule } from "./KaiDigestHeader";
import AlertCard from "./AlertCard";
import AlertDigestRow from "./AlertDigestRow";
import styles from "./AlertsScreen.module.css";

/**
 * "18 Kai Alerts", translated from the artboard.
 *
 * The artboard's 18 has no dismiss glyph beside the script mark and spaces its
 * tab rail at 14px rather than 16px; both are honoured here.
 */
export default function AlertsScreen({ model }: { model: AlertsVM }) {
  return (
    <AppShell>
      <WatchHeader active="alerts" tabGap="14px" />
      <KaiDigestHeader caption={model.generatedLabel} newCount={model.newCount} />

      {model.groups.length === 0 ? (
        <p className={styles.empty}>
          No alerts yet. Kai writes here the moment one of your watches has something to say.
        </p>
      ) : (
        model.groups.map((group, i) => (
          <section
            key={group.day}
            className={`${styles.group} ${i > 0 ? styles.groupLater : ""}`}
          >
            <DayRule>{group.day}</DayRule>
            {group.cards.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
            {group.rows.map((alert) => (
              <AlertDigestRow key={alert.id} alert={alert} />
            ))}
          </section>
        ))
      )}
    </AppShell>
  );
}
