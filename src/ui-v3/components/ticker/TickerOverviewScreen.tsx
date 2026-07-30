import AppShell from "@/ui-v3/components/AppShell";
import type { TickerOverviewVM } from "@/ui-v3/ticker-data";
import TickerHero from "./TickerHero";
import TickerTabs from "./TickerTabs";
import PriceChart from "./PriceChart";
import ClubStance from "./ClubStance";
import StanceStats from "./StanceStats";
import ActiveCircle from "./ActiveCircle";
import TopVoices from "./TopVoices";
import styles from "./TickerScreens.module.css";

/**
 * "03 Ticker NVDA" — the overview tab.
 *
 * This board keeps the five-slot nav (it is where a tap from Home, Discover or
 * the Screener lands, so the member never loses the nav by opening a name); the
 * three drill-down tabs replace it with their own footnote bar, exactly as their
 * artboards draw it.
 *
 * The tab rail sits directly beneath the identity block — the same slot boards
 * 12/13/14 give it — so switching tabs moves nothing above it except the header
 * treatment the artboards themselves change.
 */
export default function TickerOverviewScreen({ model }: { model: TickerOverviewVM }) {
  return (
    <AppShell>
      <TickerHero head={model.head} />
      <TickerTabs symbol={model.head.symbol} active="overview" />
      <PriceChart chart={model.chart} ranges={model.ranges} />
      <ClubStance stance={model.stance} clubScore={model.clubScore} />
      <StanceStats stats={model.stats} />
      <ActiveCircle circle={model.circle} />
      <TopVoices voices={model.voices} />
      <p className={styles.disclaimer}>{model.disclaimer}</p>
    </AppShell>
  );
}
