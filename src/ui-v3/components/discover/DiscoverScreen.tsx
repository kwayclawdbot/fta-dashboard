import type { DiscoverViewModel } from "@/ui-v3/discover-data";
import AppShell from "@/ui-v3/components/AppShell";
import DiscoverHeader from "./DiscoverHeader";
import RisingFast from "./RisingFast";
import MostDivisive from "./MostDivisive";
import BlackBeltsWatching from "./BlackBeltsWatching";
import QuietToLoud from "./QuietToLoud";

/**
 * "02 Discover", translated from the artboard.
 *
 * Pure presentation: the same tree renders live ledger data and the anonymous
 * view, because every value arrives on the view model.
 */
export default function DiscoverScreen({ model }: { model: DiscoverViewModel }) {
  return (
    <AppShell>
      <DiscoverHeader subtitle="Find what the Club is paying attention to" />
      <RisingFast tiles={model.rising} />
      <MostDivisive divisive={model.divisive} />
      <BlackBeltsWatching tickers={model.beltWatch} />
      <QuietToLoud tiles={model.quietToLoud} />
    </AppShell>
  );
}
