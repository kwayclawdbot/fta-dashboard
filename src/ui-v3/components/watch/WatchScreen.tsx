import AppShell from "@/ui-v3/components/AppShell";
import type { WatchOverviewVM } from "@/ui-v3/watch-data";
import WatchHeader from "./WatchHeader";
import WatchDestinations from "./WatchDestinations";
import GettingClosePanel from "./GettingClosePanel";
import SetupTeaserRow from "./SetupTeaserRow";

/**
 * "06 Watch", translated from the artboard.
 *
 * Pure presentation. The "Getting close" panel always draws its frame — it owns
 * both its live and its empty state (see GettingClosePanel) — so the screen has
 * the artboard's shape whether or not a setup is near trigger. The teaser row
 * below it is a SECOND setup, so with nothing armed there is genuinely nothing
 * for it to tease and it stays absent.
 */
export default function WatchScreen({ model }: { model: WatchOverviewVM }) {
  return (
    <AppShell>
      <WatchHeader active="overview" closeHref="/v3" tabGap="16px" />
      <WatchDestinations rows={model.destinations} />
      <GettingClosePanel setup={model.closest} />
      {model.next ? <SetupTeaserRow setup={model.next} /> : null}
    </AppShell>
  );
}
