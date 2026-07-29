import type { HomeViewModel } from "@/ui-v3/home-data";
import AppShell from "./AppShell";
import TopBarV3 from "./TopBarV3";
import TopInTheClub from "./TopInTheClub";
import TodayIn30 from "./TodayIn30";
import YourSignals from "./YourSignals";
import YouStrip from "./YouStrip";
import styles from "./HomeScreen.module.css";

/**
 * "01 Home", translated from the artboard.
 *
 * Pure presentation: every value arrives on the view model, so this same tree
 * renders live member data and the anonymous fixtures view unchanged.
 */
export default function HomeScreen({ model }: { model: HomeViewModel }) {
  return (
    <AppShell>
      <TopBarV3 initials={model.initials} notificationCount={model.notificationCount} />

      <h2 className={styles.greeting}>GM, {model.greetingName} 👋</h2>
      <p className={styles.subtitle}>Here&rsquo;s what the Club is seeing</p>

      <TopInTheClub rows={model.trending} />
      <TodayIn30 line={model.briefLine} indices={model.indices} />
      <YourSignals rows={model.signals} />
      {model.you ? <YouStrip you={model.you} /> : null}
    </AppShell>
  );
}
