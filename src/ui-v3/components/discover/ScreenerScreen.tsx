import type { ScreenerViewModel } from "@/ui-v3/discover-data";
import AppShell from "@/ui-v3/components/AppShell";
import DiscoverHeader from "./DiscoverHeader";
import DiscoverTabs from "./DiscoverTabs";
import ScreenerBoard from "./ScreenerBoard";
import StanceCards from "./StanceCards";
import TrendingChips from "./TrendingChips";

/**
 * "15 Discover Screener", translated from the artboard.
 *
 * The chips and the results are one interactive unit and live in
 * <ScreenerBoard> (a client component); everything else on this screen is
 * static server-rendered markup, including the two stance cards and the
 * trending rail, which read the whole ledger and do not answer to the screen.
 */
export default function ScreenerScreen({ model }: { model: ScreenerViewModel }) {
  return (
    <AppShell>
      <DiscoverHeader />
      <DiscoverTabs active="screener" />
      <ScreenerBoard
        candidates={model.candidates}
        sectors={model.sectors}
        initialFilters={model.initialFilters}
      />
      <StanceCards bullish={model.mostBullish} bearish={model.mostBearish} />
      <TrendingChips chips={model.trendingChips} disclaimer={model.disclaimer} />
    </AppShell>
  );
}
