import AppShell from "@/ui-v3/components/AppShell";
import type { WatchOverviewVM } from "@/ui-v3/watch-data";
import WatchHeader from "./WatchHeader";
import WatchDestinations from "./WatchDestinations";
import GettingClosePanel from "./GettingClosePanel";
import SetupTeaserRow from "./SetupTeaserRow";
import styles from "./WatchScreen.module.css";

/**
 * "06 Watch", translated from the artboard.
 *
 * Pure presentation. When no setup is close to firing the panel and the teaser
 * are simply absent — an empty watch list is a real state, and it says so
 * rather than showing a hollow dial.
 */
export default function WatchScreen({ model }: { model: WatchOverviewVM }) {
  return (
    <AppShell>
      <WatchHeader active="overview" closeHref="/v3" tabGap="16px" />
      <WatchDestinations rows={model.destinations} />

      {model.closest ? (
        <GettingClosePanel setup={model.closest} />
      ) : (
        <p className={styles.empty}>
          Nothing is close to triggering right now. Kai is watching — you&rsquo;ll hear the moment
          that changes.
        </p>
      )}

      {model.next ? <SetupTeaserRow setup={model.next} /> : null}
    </AppShell>
  );
}
