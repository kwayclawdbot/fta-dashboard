/**
 * Stock Screener (LANE 6) — shared types, pure indicator math, universe rules,
 * and the first-class PRESET definitions. No Supabase / no fetch here so both
 * the cron route (server) and the /screener page (client) import the same
 * source of truth.
 *
 * Design note — where the numbers come from:
 *   The nightly cron pulls Polygon grouped-daily (ONE call = every US ticker's
 *   OHLCV for a day) into `screener_history` (compact {close, volume} per
 *   ticker/day). Every metric below is recomputed from that trailing series, so
 *   steady-state cost is one Polygon call per day. Market cap / name / sector
 *   come from cached ticker-details calls (refreshed weekly / when missing).
 */

export type EmaState = "above" | "below" | "unknown";

/** One row of the screener table — exactly the shape the UI reads. */
export interface ScreenerRow {
  ticker: string;
  name: string | null;
  sector: string | null;
  mcap: number | null;
  price: number | null;
  chg_1d: number | null;
  chg_5d: number | null;
  chg_1m: number | null;
  chg_3m: number | null;
  vol: number | null;
  avg_vol_20: number | null;
  vol_ratio: number | null;
  dist_52w_high: number | null;
  dist_52w_low: number | null;
  rsi14: number | null;
  ema20_state: EmaState | null;
  ema50_state: EmaState | null;
  gap_pct: number | null;
  updated_at?: string;
}

/* ============================================================================
 * Universe thresholds — "liquid, real companies a family would recognise".
 * Pre-filter is dollar-volume + price (needs no per-ticker call); the mcap gate
 * is applied after cached ticker-details resolve market cap.
 * ==========================================================================*/
export const UNIVERSE = {
  MIN_PRICE: 3, // no sub-$3 names (penny-stock noise)
  MIN_AVG_DOLLAR_VOL: 10_000_000, // ≥ $10M average daily dollar volume
  MIN_MCAP: 300_000_000, // ≥ $300M market cap
  MAX_CANDIDATES: 1500, // bound bootstrap detail calls (top by $ volume)
} as const;

/* ============================================================================
 * Pure indicator math (operate on close arrays ordered OLD → NEW).
 * ==========================================================================*/

/** Percent change from `from` to `to`; null if either is missing / non-positive. */
export function pctChange(
  to: number | null | undefined,
  from: number | null | undefined
): number | null {
  if (to == null || from == null || from <= 0) return null;
  return ((to - from) / from) * 100;
}

/** Value `n` trading days back from the end (closes ordered old→new). */
export function nBack(closes: number[], n: number): number | null {
  const i = closes.length - 1 - n;
  return i >= 0 ? closes[i] : null;
}

/** Simple mean of the last `n` values. */
export function trailingMean(values: number[], n: number): number | null {
  if (values.length === 0) return null;
  const slice = values.slice(-n);
  if (slice.length === 0) return null;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Wilder's RSI(period) on a close series. Needs > period closes; returns null
 * otherwise. Standard smoothing (first avg = simple, then Wilder recursive).
 */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Exponential moving average of the last value; null if too little data. */
export function ema(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  // Seed with SMA of the first `period` values, then walk forward.
  let e = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    e = closes[i] * k + e * (1 - k);
  }
  return e;
}

export function emaState(price: number | null, e: number | null): EmaState {
  if (price == null || e == null) return "unknown";
  return price >= e ? "above" : "below";
}

/**
 * Compute every metric for one ticker from its trailing history (old→new).
 * `opens`/`prevClose` feed the gap; pass what grouped-daily gives.
 */
export function computeMetrics(input: {
  closes: number[];
  volumes: number[];
  latestOpen?: number | null;
}): Omit<ScreenerRow, "ticker" | "name" | "sector" | "mcap" | "updated_at"> {
  const { closes, volumes, latestOpen } = input;
  const price = closes.length ? closes[closes.length - 1] : null;
  const prev = nBack(closes, 1);
  const hi = closes.length ? Math.max(...closes) : null;
  const lo = closes.length ? Math.min(...closes) : null;
  const vol = volumes.length ? volumes[volumes.length - 1] : null;
  const avgVol20 = trailingMean(volumes, 20);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  return {
    price,
    chg_1d: pctChange(price, prev),
    chg_5d: pctChange(price, nBack(closes, 5)),
    chg_1m: pctChange(price, nBack(closes, 21)),
    chg_3m: pctChange(price, nBack(closes, 63)),
    vol: vol != null ? Math.round(vol) : null,
    avg_vol_20: avgVol20,
    vol_ratio: vol != null && avgVol20 && avgVol20 > 0 ? vol / avgVol20 : null,
    dist_52w_high: price != null && hi ? pctChange(price, hi) : null, // ≤ 0
    dist_52w_low: price != null && lo ? pctChange(price, lo) : null, // ≥ 0
    rsi14: rsi(closes, 14),
    ema20_state: emaState(price, ema20),
    ema50_state: emaState(price, ema50),
    gap_pct: latestOpen != null ? pctChange(latestOpen, prev) : null,
  };
}

/* ============================================================================
 * PRESETS — first-class, education-first. Each preset is a pure predicate over
 * a ScreenerRow plus a plain-English "what it finds & why it matters" line
 * (kids see these — no hype, no "hot picks"). `sort` names the default column.
 * ==========================================================================*/

export type SortDir = "asc" | "desc";
export interface PresetSort {
  key: keyof ScreenerRow;
  dir: SortDir;
}

export interface ScreenerPreset {
  id: string;
  label: string;
  /** One-line, education-first explanation. Kid-safe. */
  blurb: string;
  /** Lucide icon name (resolved in the page). */
  icon: string;
  match: (r: ScreenerRow) => boolean;
  sort: PresetSort;
}

const num = (v: number | null | undefined) => (v == null ? null : v);

export const PRESETS: ScreenerPreset[] = [
  {
    id: "big-brands-new-highs",
    label: "Big brands at new highs",
    blurb:
      "Large, well-known companies trading near the top of their recent range. A stock at new highs means buyers have been steadily willing to pay more — a sign of strength worth understanding before you follow it.",
    icon: "Trophy",
    match: (r) =>
      num(r.mcap) != null &&
      r.mcap! >= 10_000_000_000 &&
      num(r.dist_52w_high) != null &&
      r.dist_52w_high! >= -3,
    sort: { key: "dist_52w_high", dir: "desc" },
  },
  {
    id: "steady-climbers",
    label: "Steady climbers",
    blurb:
      "Companies grinding higher over months, not spiking overnight. Their price sits above both its 20- and 50-day average lines — the calm, durable kind of uptrend that rewards patience over excitement.",
    icon: "TrendingUp",
    match: (r) =>
      r.ema20_state === "above" &&
      r.ema50_state === "above" &&
      num(r.chg_3m) != null &&
      r.chg_3m! >= 5 &&
      num(r.chg_1m) != null &&
      r.chg_1m! >= 0,
    sort: { key: "chg_3m", dir: "desc" },
  },
  {
    id: "momentum-movers",
    label: "Momentum movers",
    blurb:
      "Stocks with strong recent momentum this past month. Fast moves can reverse just as fast, so this list is a starting point for research — never a reason to chase. Notice which names show up and ask why.",
    icon: "Rocket",
    match: (r) =>
      num(r.chg_1m) != null &&
      r.chg_1m! >= 10 &&
      num(r.rsi14) != null &&
      r.rsi14! >= 55 &&
      r.rsi14! <= 80,
    sort: { key: "chg_1m", dir: "desc" },
  },
  {
    id: "oversold-quality",
    label: "Oversold quality",
    blurb:
      "Solid companies that have pulled back and now look 'oversold' (a low RSI reading). Sometimes that is a bargain, sometimes a warning — the point is to study why the price fell, not to assume it will bounce.",
    icon: "Waves",
    match: (r) =>
      num(r.mcap) != null &&
      r.mcap! >= 2_000_000_000 &&
      num(r.rsi14) != null &&
      r.rsi14! <= 35,
    sort: { key: "rsi14", dir: "asc" },
  },
  {
    id: "volume-surges",
    label: "Volume surges",
    blurb:
      "Stocks trading far more shares than usual today. Unusual volume means something got people's attention — news, earnings, a big buyer. It is a clue to go investigate, not a signal on its own.",
    icon: "BarChart3",
    match: (r) => num(r.vol_ratio) != null && r.vol_ratio! >= 2,
    sort: { key: "vol_ratio", dir: "desc" },
  },
];

export function getPreset(id: string | null | undefined): ScreenerPreset | null {
  if (!id) return null;
  return PRESETS.find((p) => p.id === id) ?? null;
}

/* ============================================================================
 * Custom filter builder — the FTA-tier advanced surface. Pure predicate build.
 * ==========================================================================*/

export interface CustomFilters {
  minMcap?: number | null; // USD
  maxMcap?: number | null;
  sector?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minChg1d?: number | null;
  minChg1m?: number | null;
  minVolRatio?: number | null;
  rsiMax?: number | null; // "oversold below…"
  rsiMin?: number | null; // "overbought above…"
  emaTrend?: "above20" | "above50" | "above2050" | null;
  nearHigh?: boolean | null; // within 3% of window high
}

export function matchesCustom(r: ScreenerRow, f: CustomFilters): boolean {
  if (f.minMcap != null && (r.mcap == null || r.mcap < f.minMcap)) return false;
  if (f.maxMcap != null && (r.mcap == null || r.mcap > f.maxMcap)) return false;
  if (f.sector && r.sector !== f.sector) return false;
  if (f.minPrice != null && (r.price == null || r.price < f.minPrice)) return false;
  if (f.maxPrice != null && (r.price == null || r.price > f.maxPrice)) return false;
  if (f.minChg1d != null && (r.chg_1d == null || r.chg_1d < f.minChg1d)) return false;
  if (f.minChg1m != null && (r.chg_1m == null || r.chg_1m < f.minChg1m)) return false;
  if (f.minVolRatio != null && (r.vol_ratio == null || r.vol_ratio < f.minVolRatio))
    return false;
  if (f.rsiMax != null && (r.rsi14 == null || r.rsi14 > f.rsiMax)) return false;
  if (f.rsiMin != null && (r.rsi14 == null || r.rsi14 < f.rsiMin)) return false;
  if (f.emaTrend === "above20" && r.ema20_state !== "above") return false;
  if (f.emaTrend === "above50" && r.ema50_state !== "above") return false;
  if (
    f.emaTrend === "above2050" &&
    (r.ema20_state !== "above" || r.ema50_state !== "above")
  )
    return false;
  if (f.nearHigh && (r.dist_52w_high == null || r.dist_52w_high < -3)) return false;
  return true;
}

/* ============================================================================
 * Formatting (shared with the row renderer).
 * ==========================================================================*/

export function fmtMcap(v: number | null | undefined): string {
  if (v == null || v <= 0) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

export function fmtVol(v: number | null | undefined): string {
  if (v == null || v <= 0) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${v}`;
}

/** Sort a list by a numeric/string column, nulls last. */
export function sortRows(
  rows: ScreenerRow[],
  key: keyof ScreenerRow,
  dir: SortDir
): ScreenerRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulls last regardless of dir
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
    return String(av).localeCompare(String(bv)) * sign;
  });
}
