import AppShell from "@/ui-v3/components/AppShell";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import { TICKER_EMPTY, type TickerTechnicalsVM } from "@/ui-v3/ticker-data";
import TickerHead from "./TickerHead";
import TickerTabs from "./TickerTabs";
import SignalGauge from "./SignalGauge";
import IndicatorCards from "./IndicatorCards";
import KeyLevels from "./KeyLevels";
import StateTiles from "./StateTiles";
import styles from "./TickerScreens.module.css";

/**
 * "12 Ticker Technicals".
 *
 * No nav: the artboard replaces it with a pinned footnote, which is what
 * AppShell's `bar` slot is for.
 *
 * The artboard's "PATTERN DETECTED · Ascending Triangle · 72% historical
 * follow-through" panel is absent. There is no pattern-detection engine and no
 * follow-through statistics anywhere in the codebase, and a named chart pattern
 * with a hit rate beside it is the single most confident-sounding thing on the
 * board — inventing it would be the worst lie available here.
 */
export default function TickerTechnicalsScreen({ model }: { model: TickerTechnicalsVM }) {
  return (
    <AppShell nav={false} bar={<p className={styles.footnote}>{model.footnote}</p>}>
      <TickerHead head={model.head} />
      <TickerTabs symbol={model.head.symbol} active="technicals" />

      {model.mixPct === null || model.mixWord === null ? (
        <EmptyNote tall>{TICKER_EMPTY.mix}</EmptyNote>
      ) : (
        <SignalGauge
          pct={model.mixPct}
          word={model.mixWord}
          bullish={model.mixBullish}
          total={model.mixTotal}
        />
      )}

      <IndicatorCards rsi={model.rsi} macd={model.macd} />
      <KeyLevels levels={model.levels} />
      <StateTiles tiles={model.tiles} />
    </AppShell>
  );
}
