import type { DiscoverViewModel } from "@/ui-v3/discover-data";
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
 * Every region draws its frame unconditionally — a young club sees the same four
 * bands as a busy one, each either full or honestly empty. The whole screen is
 * the trending ledger, so it closes on that ledger's compliance line.
 */
export default function DiscoverScreen({ model }: { model: DiscoverViewModel }) {
  return (
    <AppShell>
      <DiscoverHeader subtitle="Find what the Club is paying attention to" />
      <RisingFast tiles={model.rising} />
      <MostDivisive divisive={model.divisive} />
      <BlackBeltsWatching tickers={model.beltWatch} />
      <QuietToLoud tiles={model.quietToLoud} />
      <p className={styles.disclaimer}>{model.disclaimer}</p>
    </AppShell>
  );
}
