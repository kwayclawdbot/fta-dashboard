import type { ScreenerViewModel } from "@/ui-v3/discover-data";
import AppShell from "@/ui-v3/components/AppShell";
import DiscoverHeader from "./DiscoverHeader";
import DiscoverTabs from "./DiscoverTabs";
import FilterChips from "./FilterChips";
import ScreenerResults from "./ScreenerResults";
import StanceCards from "./StanceCards";
import TrendingChips from "./TrendingChips";

/** "15 Discover Screener", translated from the artboard. */
export default function ScreenerScreen({ model }: { model: ScreenerViewModel }) {
  return (
    <AppShell>
      <DiscoverHeader />
      <DiscoverTabs active="screener" />
      <FilterChips chips={model.chips} />
      <ScreenerResults rows={model.rows} summary={model.summary} />
      <StanceCards bullish={model.mostBullish} bearish={model.mostBearish} />
      <TrendingChips chips={model.trendingChips} disclaimer={model.disclaimer} />
    </AppShell>
  );
}
