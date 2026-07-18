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

/** trend-or-trap: a mini candlestick chart (battles in a row). */
export interface SeriesChart {
  kind: "series";
  candles: OHLC[];
  decisionIndex: number; // candles[0..decisionIndex) = setup; rest = resolution
}

export type ChartData = CandleChart | SeriesChart;

export interface GameRound {
  id: string;
  prompt: string;
  answer: string;
  why: string | null;
  chart_data: ChartData | null;
}
