import AppShell from "@/ui-v3/components/AppShell";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import { TICKER_EMPTY, type TickerFundamentalsVM } from "@/ui-v3/ticker-data";
import TickerHead from "./TickerHead";
import TickerTabs from "./TickerTabs";
import RevenueBars from "./RevenueBars";
import MarginDials from "./MarginDials";
import PeerValuation from "./PeerValuation";
import styles from "./TickerScreens.module.css";

/**
 * "13 Ticker Fundamentals".
 *
 * The artboard opens on a grade hero — a conic "A−" ring beside "Elite grower ·
 * Top 3% margins · fortress balance sheet". Every part of that is a judgement:
 * a letter grade needs a grading model, and "top 3%" needs a ranked universe.
 * Neither exists. So the board opens on the first thing that is actually
 * reported, and the reader forms the judgement the grade was making for them.
 *
 * A ticker with no standardized financials — many small caps, most ETFs — lands
 * on the honest note rather than three empty rings.
 */
export default function TickerFundamentalsScreen({ model }: { model: TickerFundamentalsVM }) {
  const bare = !model.revenue && model.margins.length === 0 && !model.peers;

  return (
    <AppShell nav={false} bar={<p className={styles.footnote}>{model.footnote}</p>}>
      <TickerHead head={model.head} />
      <TickerTabs symbol={model.head.symbol} active="fundamentals" />

      {bare ? (
        <EmptyNote tall>{TICKER_EMPTY.margins}</EmptyNote>
      ) : (
        <>
          <RevenueBars revenue={model.revenue} />
          <MarginDials margins={model.margins} />
          <PeerValuation peers={model.peers} />
        </>
      )}
    </AppShell>
  );
}
