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

import { classifySector } from "./screener-sectors";

export type EmaState = "above" | "below" | "unknown";
export type SecurityType = "common" | "etf";

/** One row of the screener table — exactly the shape the UI reads. */
export interface ScreenerRow {
  ticker: string;
  name: string | null;
  sector: string | null;
  exchange: string | null; // 'NYSE' | 'NASDAQ' | 'AMEX' | 'NYSE Arca' | 'Cboe'
  type: SecurityType | null; // 'common' | 'etf'
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
  like_count?: number | null; // community ❤ (net likes, precomputed — Lane 9)
  updated_at?: string;
}

/* ============================================================================
 * Universe classification — a REAL screener: every common stock (+ labeled ETF)
 * that trades on the recognized US venues. No price / liquidity / mcap gate;
 * the ONLY filter is "is this a real, listed common stock or ETF?" (drops
 * warrants, units, preferreds, rights, OTC). Unknown mcap is NOT an exclusion.
 * ==========================================================================*/

/** Polygon primary_exchange MIC → friendly name. Others → null (not in scope). */
export function exchangeName(mic: string | null | undefined): string | null {
  switch (mic) {
    case "XNYS":
      return "NYSE";
    case "XNAS":
      return "NASDAQ";
    case "XASE":
      return "AMEX";
    case "ARCX":
      return "NYSE Arca";
    case "BATS":
      return "Cboe";
    default:
      return null;
  }
}

/** Polygon `type` → our two-class label, or null if out of scope. */
export function securityType(polygonType: string | null | undefined): SecurityType | null {
  switch (polygonType) {
    case "CS": // common stock
    case "ADRC": // American Depositary Receipt (common)
      return "common";
    case "ETF":
    case "ETV":
    case "ETN":
    case "FUND":
      return "etf";
    default:
      return null; // WARRANT / UNIT / PFD / RIGHT / SP / … → out of scope
  }
}

/**
 * Membership rule for the screener universe.
 *   - common stocks: only on NYSE / NASDAQ / AMEX (the three the owner named).
 *   - ETFs: on those three PLUS the ETF venues NYSE Arca / Cboe (where most list).
 * Returns the resolved {exchange, type} to store, or null to skip the ticker.
 */
export function classify(
  polygonType: string | null | undefined,
  mic: string | null | undefined
): { exchange: string; type: SecurityType } | null {
  const type = securityType(polygonType);
  const exchange = exchangeName(mic);
  if (!type || !exchange) return null;
  if (type === "common" && !["NYSE", "NASDAQ", "AMEX"].includes(exchange)) return null;
  return { exchange, type };
}

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
}): Omit<
  ScreenerRow,
  "ticker" | "name" | "sector" | "exchange" | "type" | "mcap" | "updated_at"
> {
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
 * Composable filters — the CORE of the real screener. Every field is optional
 * and ANDs with the rest. `basic` fields are available to every member (FIC+);
 * `advanced` (RSI / EMA trend / gap / 52w-near) are the FTA technical layer.
 * A preset is just a curated Partial<CustomFilters> (+ default sort) applied as
 * a quick-start — fully transparent and editable afterward, never a black box.
 * ==========================================================================*/

export type EmaTrend = "above20" | "below20" | "above50" | "below50" | "above2050";

export interface CustomFilters {
  // ── basic (all tiers) ──
  q?: string | null; // ticker / name search
  exchange?: string | null; // 'NYSE' | 'NASDAQ' | 'AMEX' | 'NYSE Arca' | 'Cboe'
  type?: SecurityType | null; // 'common' | 'etf'
  sector?: string | null; // one of the 11 major sectors (see screener-sectors)
  subsector?: string | null; // curated subsector within the selected sector
  minMcap?: number | null; // USD
  maxMcap?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minChg1d?: number | null;
  minChg5d?: number | null;
  minChg1m?: number | null;
  minChg3m?: number | null;
  minVolRatio?: number | null;
  // ── advanced (FTA technical) ──
  rsiMax?: number | null; // "oversold below…"
  rsiMin?: number | null; // "strong/overbought above…"
  emaTrend?: EmaTrend | null;
  nearHigh?: boolean | null; // within 3% of trailing-window high
  nearLow?: boolean | null; // within 3% of trailing-window low
  minGap?: number | null; // gap up ≥
  maxGap?: number | null; // gap down ≤ (negative)
}

/** Keys that belong to the FTA-only advanced technical panel. */
export const ADVANCED_FILTER_KEYS: (keyof CustomFilters)[] = [
  "rsiMax",
  "rsiMin",
  "emaTrend",
  "nearHigh",
  "nearLow",
  "minGap",
  "maxGap",
];

export function hasAdvancedFilter(f: CustomFilters): boolean {
  return ADVANCED_FILTER_KEYS.some((k) => f[k] != null && f[k] !== false);
}

/** True when NO filter is active (search excluded — search is orthogonal). */
export function filtersEmpty(f: CustomFilters): boolean {
  return (Object.keys(f) as (keyof CustomFilters)[]).every(
    (k) => k === "q" || f[k] == null || f[k] === false || f[k] === ""
  );
}

export function matchesCustom(r: ScreenerRow, f: CustomFilters): boolean {
  // Search (ticker or name, case-insensitive substring).
  if (f.q && f.q.trim()) {
    const q = f.q.trim().toLowerCase();
    const hay = `${r.ticker} ${r.name ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.exchange && r.exchange !== f.exchange) return false;
  if (f.type && r.type !== f.type) return false;
  // Sector / subsector match against the mapped taxonomy (raw SIC → 11 majors).
  if (f.sector || f.subsector) {
    const cls = classifySector(r.sector);
    if (f.sector && cls?.sector !== f.sector) return false;
    if (f.subsector && cls?.subsector !== f.subsector) return false;
  }
  if (f.minMcap != null && (r.mcap == null || r.mcap < f.minMcap)) return false;
  if (f.maxMcap != null && (r.mcap == null || r.mcap > f.maxMcap)) return false;
  if (f.minPrice != null && (r.price == null || r.price < f.minPrice)) return false;
  if (f.maxPrice != null && (r.price == null || r.price > f.maxPrice)) return false;
  if (f.minChg1d != null && (r.chg_1d == null || r.chg_1d < f.minChg1d)) return false;
  if (f.minChg5d != null && (r.chg_5d == null || r.chg_5d < f.minChg5d)) return false;
  if (f.minChg1m != null && (r.chg_1m == null || r.chg_1m < f.minChg1m)) return false;
  if (f.minChg3m != null && (r.chg_3m == null || r.chg_3m < f.minChg3m)) return false;
  if (f.minVolRatio != null && (r.vol_ratio == null || r.vol_ratio < f.minVolRatio))
    return false;
  // advanced
  if (f.rsiMax != null && (r.rsi14 == null || r.rsi14 > f.rsiMax)) return false;
  if (f.rsiMin != null && (r.rsi14 == null || r.rsi14 < f.rsiMin)) return false;
  if (f.emaTrend === "above20" && r.ema20_state !== "above") return false;
  if (f.emaTrend === "below20" && r.ema20_state !== "below") return false;
  if (f.emaTrend === "above50" && r.ema50_state !== "above") return false;
  if (f.emaTrend === "below50" && r.ema50_state !== "below") return false;
  if (
    f.emaTrend === "above2050" &&
    (r.ema20_state !== "above" || r.ema50_state !== "above")
  )
    return false;
  if (f.nearHigh && (r.dist_52w_high == null || r.dist_52w_high < -3)) return false;
  if (f.nearLow && (r.dist_52w_low == null || r.dist_52w_low > 3)) return false;
  if (f.minGap != null && (r.gap_pct == null || r.gap_pct < f.minGap)) return false;
  if (f.maxGap != null && (r.gap_pct == null || r.gap_pct > f.maxGap)) return false;
  return true;
}

/* ============================================================================
 * PRESETS — quick-start chips. Each is a curated filter combo + default sort +
 * an education-first, kid-safe "what it finds & why it matters" blurb. Clicking
 * a chip just APPLIES its filters (visible + editable) — presets are a starting
 * point, never the product.
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
  filters: CustomFilters;
  sort: PresetSort;
  /** Convenience predicate = matchesCustom(row, filters). */
  match: (r: ScreenerRow) => boolean;
}

const PRESET_DEFS: Omit<ScreenerPreset, "match">[] = [
  {
    id: "big-brands-new-highs",
    label: "Big brands at new highs",
    blurb:
      "Large, well-known companies trading near the top of their recent range. A stock at new highs means buyers have been steadily willing to pay more — a sign of strength worth understanding before you follow it.",
    icon: "Trophy",
    filters: { minMcap: 10_000_000_000, nearHigh: true },
    sort: { key: "dist_52w_high", dir: "desc" },
  },
  {
    id: "steady-climbers",
    label: "Steady climbers",
    blurb:
      "Companies grinding higher over months, not spiking overnight. Their price sits above both its 20- and 50-day average lines — the calm, durable kind of uptrend that rewards patience over excitement.",
    icon: "TrendingUp",
    filters: { emaTrend: "above2050", minChg3m: 5 },
    sort: { key: "chg_3m", dir: "desc" },
  },
  {
    id: "momentum-movers",
    label: "Momentum movers",
    blurb:
      "Stocks with strong recent momentum this past month. Fast moves can reverse just as fast, so this list is a starting point for research — never a reason to chase. Notice which names show up and ask why.",
    icon: "Rocket",
    filters: { minChg1m: 10, rsiMin: 55, rsiMax: 80 },
    sort: { key: "chg_1m", dir: "desc" },
  },
  {
    id: "oversold-quality",
    label: "Oversold quality",
    blurb:
      "Solid companies that have pulled back and now look 'oversold' (a low RSI reading). Sometimes that is a bargain, sometimes a warning — the point is to study why the price fell, not to assume it will bounce.",
    icon: "Waves",
    filters: { minMcap: 2_000_000_000, rsiMax: 35 },
    sort: { key: "rsi14", dir: "asc" },
  },
  {
    id: "volume-surges",
    label: "Volume surges",
    blurb:
      "Stocks trading far more shares than usual today. Unusual volume means something got people's attention — news, earnings, a big buyer. It is a clue to go investigate, not a signal on its own.",
    icon: "BarChart3",
    filters: { minVolRatio: 2 },
    sort: { key: "vol_ratio", dir: "desc" },
  },
];

export const PRESETS: ScreenerPreset[] = PRESET_DEFS.map((p) => ({
  ...p,
  match: (r: ScreenerRow) => matchesCustom(r, p.filters),
}));

export function getPreset(id: string | null | undefined): ScreenerPreset | null {
  if (!id) return null;
  return PRESETS.find((p) => p.id === id) ?? null;
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
