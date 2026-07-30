import type { Sector } from "@/lib/screener-sectors";
import type { SparkTone } from "@/ui-v3/components/discover/Sparkline";

/**
 * THE SCREEN ITSELF — pure, shared by the server adapter and the client board.
 *
 * The screener's three chips used to be strings. `discover-data.ts` filtered the
 * ledger with a hardcoded `SCREEN` constant and then printed three labels
 * describing that constant, so the ✕ on each chip was decoration and "+ Filter"
 * opened nothing. This module is the predicate set behind them.
 *
 * WHY IT IS A SEPARATE FILE. `discover-data.ts` is `import "server-only"`, and
 * the chips have to evaluate in the browser for a ✕ to do anything. So the
 * predicates live here — no imports beyond types, no data access — and BOTH
 * sides run the same four functions. The server ships the candidate set; the
 * client re-screens it on every chip change. There is no second definition of
 * what "Mkt cap > $10B" means.
 *
 * WHY CLIENT-SIDE. The candidate set is the club's attention ledger joined to
 * `screener_metrics` — tens of rows, not thousands, because a name only enters
 * the ledger once the Club looks at it. Re-screening that in the browser is
 * instant and costs no round trip. When the ledger outgrows a single payload,
 * `applyScreen` moves to the server unchanged and only the caller moves.
 *
 * EVERY PREDICATE IS BACKED. Sector and market cap are `screener_metrics`
 * columns; day change is `chg_1d` off the same row; club signal is the trending
 * row's bull share, already floor-gated by the adapter (see `signalPct`). There
 * is deliberately no predicate for anything the data cannot answer — no "float",
 * no "short interest", no "analyst rating".
 */

// ── the candidate ────────────────────────────────────────────────────────────

/**
 * One screenable name: everything the row RENDERS plus everything the screen
 * FILTERS ON. The two overlap (price, day change) and that is the point — a row
 * cannot be filtered by a number it does not show, or show one it was not
 * filtered by.
 */
export interface ScreenerCandidateVM {
  ticker: string;
  series: number[] | null;
  tone: SparkTone;
  /** Real: screener_metrics.price. */
  priceLabel: string | null;
  /** Real: screener_metrics.chg_1d. Also the `minChg1d` predicate's input. */
  changePct: number | null;
  /**
   * Real: the trending row's `sentiment.bullPct`, and ONLY when that row clears
   * MIN_POSITIONED_OPINIONS. Null means "the Club has not said enough about this
   * name for a share to mean anything" — which is why the signal predicate
   * rejects a null rather than treating it as zero.
   */
  signalPct: number | null;
  /** Real: screener_metrics.sector, collapsed by `sectorOf`. Null = unclassified. */
  sector: Sector | null;
  /** Real: screener_metrics.mcap, in dollars. */
  mcap: number | null;
}

// ── the filter state ─────────────────────────────────────────────────────────

export type FilterKey = "sector" | "minMcap" | "minSignal" | "minChg1d";

export interface ScreenerFilters {
  /** Exact sector match after `sectorOf`. */
  sector: Sector | null;
  /** Strictly greater than, in dollars. */
  minMcap: number | null;
  /** Strictly greater than, in percent (0-100). */
  minSignal: number | null;
  /** Strictly greater than, in percent. Negative values are legal. */
  minChg1d: number | null;
}

export const EMPTY_FILTERS: ScreenerFilters = {
  sector: null,
  minMcap: null,
  minSignal: null,
  minChg1d: null,
};

/**
 * The screen the artboard draws, now as state rather than as a constant.
 *
 * These are the artboard's own three thresholds, so board 15 still opens on the
 * screen it was designed around — the difference is that each one is now
 * removable and the rows below actually answer to it.
 */
export const DEFAULT_FILTERS: ScreenerFilters = {
  sector: "Technology",
  minMcap: 10_000_000_000,
  minSignal: 70,
  minChg1d: null,
};

// ── the options the sheet offers ─────────────────────────────────────────────

/**
 * Every threshold a member can pick, per predicate. Deliberately a short ladder
 * of round numbers rather than a free-text field: a screener that accepts
 * "$7,431,002,110" invites precision the ledger cannot reward, and a slider
 * needs a distribution to be meaningful.
 */
export const MCAP_OPTIONS = [1e9, 10e9, 100e9, 500e9] as const;
export const SIGNAL_OPTIONS = [50, 60, 70, 80] as const;
export const CHG_OPTIONS = [0, 2, 5] as const;

// ── labels ───────────────────────────────────────────────────────────────────

/**
 * The artboard writes Technology as "Tech". It is the only sector it abbreviates
 * and the only one abbreviated here; the other ten print their own names.
 */
const SECTOR_CHIP_LABEL: Partial<Record<Sector, string>> = { Technology: "Tech" };

export function sectorLabel(sector: Sector): string {
  return SECTOR_CHIP_LABEL[sector] ?? sector;
}

/** "$10B", "$500B", "$1B" — the ladder's own rungs, never a computed odd number. */
export function mcapLabel(usd: number): string {
  if (usd >= 1e12) return `$${trim(usd / 1e12)}T`;
  if (usd >= 1e9) return `$${trim(usd / 1e9)}B`;
  if (usd >= 1e6) return `$${trim(usd / 1e6)}M`;
  return `$${Math.round(usd)}`;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function chgLabel(pct: number): string {
  return pct === 0 ? "Up today" : `Up > ${pct}% today`;
}

export interface ScreenerChipVM {
  key: FilterKey;
  label: string;
}

/**
 * The applied-filter rail. One chip per ACTIVE predicate, in a fixed order so
 * the rail does not reshuffle when a member removes the middle one. An empty
 * array is a legitimate state — it means "everything the Club is watching".
 */
export function chipsFor(f: ScreenerFilters): ScreenerChipVM[] {
  const out: ScreenerChipVM[] = [];
  if (f.sector) out.push({ key: "sector", label: sectorLabel(f.sector) });
  if (f.minMcap != null) out.push({ key: "minMcap", label: `Mkt cap > ${mcapLabel(f.minMcap)}` });
  if (f.minSignal != null) out.push({ key: "minSignal", label: `Signal > ${f.minSignal}%` });
  if (f.minChg1d != null) out.push({ key: "minChg1d", label: chgLabel(f.minChg1d) });
  return out;
}

/**
 * The count line above the results.
 *
 * "0 matches · sorted by club signal" claims an ordering over nothing, so the
 * sort clause is dropped when there is nothing to sort — the same rule the
 * previous adapter applied, kept here where the count is now computed.
 */
export function summaryFor(count: number): string {
  if (count === 0) return "0 matches";
  return `${count} ${count === 1 ? "match" : "matches"} · sorted by club signal`;
}

// ── the screen ───────────────────────────────────────────────────────────────

/**
 * Apply the filters and rank the survivors by club signal.
 *
 * STRICT INEQUALITIES throughout, because the chips say "> $10B" and "> 70%"
 * and a screen has to mean the sentence printed on it.
 *
 * A null field FAILS its predicate rather than passing it. A name with no market
 * cap on file is not a name over $10B, and a name the Club has not positioned on
 * is not a name over 70% — treating either absence as a zero would be silent,
 * and treating it as a pass would put unscreened rows under a screen.
 */
export function applyScreen(
  candidates: ScreenerCandidateVM[],
  f: ScreenerFilters
): ScreenerCandidateVM[] {
  return candidates
    .filter((c) => {
      if (f.sector && c.sector !== f.sector) return false;
      if (f.minMcap != null && (c.mcap == null || c.mcap <= f.minMcap)) return false;
      if (f.minSignal != null && (c.signalPct == null || c.signalPct <= f.minSignal)) return false;
      if (f.minChg1d != null && (c.changePct == null || c.changePct <= f.minChg1d)) return false;
      return true;
    })
    .sort((a, b) => (b.signalPct ?? -1) - (a.signalPct ?? -1));
}

/** Clearing one chip's ✕ — the predicate goes back to "no opinion", not to a default. */
export function withoutFilter(f: ScreenerFilters, key: FilterKey): ScreenerFilters {
  return { ...f, [key]: null };
}
