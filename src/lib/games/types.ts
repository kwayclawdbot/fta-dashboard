// Shared shapes for the animated games. chart_data is stored per game_items
// row (see scripts/seed-chart-data.mjs) and drives every animation.

export interface OHLC {
  o: number;
  h: number;
  l: number;
  c: number;
}

/** candle-battle: one candle forming live from an intraday tick path. */
export interface CandleChart extends OHLC {
  kind: "candle";
  path: number[]; // intraday ticks, path[0]=o, path[last]=c, touches h & l
  decisionAt: number; // 0..1 fraction of the path shown before the call
}

/** A horizontal support/resistance line drawn on a mini chart. */
export interface LevelLine {
  price: number;
  kind: "support" | "resistance";
  label: string; // "Support" | "Resistance" | "Neckline" | …
}

/** A point on a chart, addressed by candle index + price. */
export interface ChartPoint {
  index: number; // candle index (may be fractional / extrapolated past the ends)
  price: number;
}

/**
 * A DIAGONAL annotation line — a swing trendline, a moving-average line, a
 * broken trendline, etc. Drawn dashed (gold or soft-white) with a small label
 * chip, before the candles pop in — same treatment as LevelLine.
 * `points` (optional) draws a multi-segment polyline (e.g. a moving average);
 * when absent the line runs straight from `from` to `to`.
 */
export interface Trendline {
  kind: "trendline";
  from: ChartPoint;
  to: ChartPoint;
  points?: ChartPoint[]; // optional polyline; drawn INSTEAD of from→to when present
  label: string; // "Uptrend" | "Downtrend" | "50 MA" | "Trendline" | …
  tone?: "gold" | "soft"; // gold (default) or soft-white
}

/** trend-or-trap: a mini candlestick chart (battles in a row). */
export interface SeriesChart {
  kind: "series";
  candles: OHLC[];
  decisionIndex: number; // candles[0..decisionIndex) = setup; rest = resolution
  levels?: LevelLine[]; // S/R lines the scenario turns on (drawn before candles)
  trendlines?: Trendline[]; // diagonal swing / MA / broken-trend lines
}

export type ChartData = CandleChart | SeriesChart;

/** Flashcard visual front: a hand-crafted pattern DRAWN with CandleRenderer. */
export interface CardVisual {
  name: string; // pattern name, shown big on the back
  candles: OHLC[]; // the pattern's candles (1-3 for candlesticks, ~10-14 for charts)
  levels?: LevelLine[]; // S/R lines for chart patterns
  trendlines?: Trendline[]; // diagonal lines for trend patterns
}

export interface GameRound {
  id: string;
  prompt: string;
  answer: string;
  why: string | null;
  chart_data: ChartData | null;
}
