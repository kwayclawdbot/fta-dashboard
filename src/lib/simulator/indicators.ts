import { OHLCV } from "./market-engine";

export interface IndicatorPoint {
  time: number;
  value: number;
}

// Simple Moving Average
export function sma(bars: OHLCV[], period: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (bars.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += bars[i].close;

  result.push({ time: bars[period - 1].time, value: round2(sum / period) });

  for (let i = period; i < bars.length; i++) {
    sum += bars[i].close - bars[i - period].close;
    result.push({ time: bars[i].time, value: round2(sum / period) });
  }
  return result;
}

// Exponential Moving Average
export function ema(bars: OHLCV[], period: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  if (bars.length < period) return result;

  const k = 2 / (period + 1);

  // Initialize with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += bars[i].close;
  let prev = sum / period;
  result.push({ time: bars[period - 1].time, value: round2(prev) });

  for (let i = period; i < bars.length; i++) {
    prev = bars[i].close * k + prev * (1 - k);
    result.push({ time: bars[i].time, value: round2(prev) });
  }
  return result;
}

// Volume bar coloring: green if close >= open, red otherwise
export function volumeColors(bars: OHLCV[]): string[] {
  return bars.map((b) =>
    b.close >= b.open
      ? "rgba(74, 222, 128, 0.5)"  // green-400/50
      : "rgba(239, 68, 68, 0.5)"   // red-500/50
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
