import type { DiscoverViewModel } from "@/ui-v3/discover-data";
import {
  SHOW_BELT_WATCH,
  SHOW_MOST_DIVISIVE,
  SHOW_QUIET_TO_LOUD,
} from "@/ui-v3/launch-flags";
import AppShell from "@/ui-v3/components/AppShell";
import DiscoverHeader from "./DiscoverHeader";
import RisingFast from "./RisingFast";
import MostDivisive from "./MostDivisive";
import BlackBeltsWatching from "./BlackBeltsWatching";
import QuietToLoud from "./QuietToLoud";
import styles from "./DiscoverScreen.module.css";

/**
 * "02 Discover", translated from the artboard.
 *
 * Pure presentation: the same tree renders live ledger data and the anonymous
 * view, because every value arrives on the view model.
 *
 * LAUNCH TRIM. The artboard's four bands are down to one plus the compliance
 * line. Three of them — the split, the black-belt row, the two-week wake-ups —
 * each need a size of network the club does not have on day one, so each sits
 * behind a flag in src/ui-v3/launch-flags.ts that names the condition it returns
 * under. The components and the adapter fields are untouched: this is a
 * rendering decision, and flipping the flag is the whole re-enable.
 *
 * What survives is what a founding club can actually fill: the names climbing
 * the ledger, and the sentence saying attention is not a recommendation.
 */
export default function DiscoverScreen({ model }: { model: DiscoverViewModel }) {
  return (
    <AppShell>
      <DiscoverHeader subtitle="Find what the Club is paying attention to" />
      <RisingFast tiles={model.rising} />
      {SHOW_MOST_DIVISIVE ? <MostDivisive divisive={model.divisive} /> : null}
      {SHOW_BELT_WATCH ? <BlackBeltsWatching tickers={model.beltWatch} /> : null}
      {SHOW_QUIET_TO_LOUD ? <QuietToLoud tiles={model.quietToLoud} /> : null}
      <p className={styles.disclaimer}>{model.disclaimer}</p>
    </AppShell>
  );
}
