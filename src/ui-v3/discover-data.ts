import "server-only";

import { getRequestClient, getRequestUser } from "@/lib/supabase/rsc";
import { buildClubHomeSeedSplit } from "@/lib/club/home-payload";
import { getCachedBeltWatch } from "@/lib/club/club-cache";
import { sectorOf, SECTORS, type Sector } from "@/lib/screener-sectors";
import { TRENDING_DISCLAIMER } from "@/lib/club/score";
import { MIN_POSITIONED_OPINIONS } from "@/ui-v3/club-floors";
import { DISCOVER_EMPTY } from "@/ui-v3/discover-copy";
import {
  DEFAULT_FILTERS,
  type ScreenerCandidateVM,
  type ScreenerFilters,
} from "@/ui-v3/screener-filter";
import type { SparkTone } from "@/ui-v3/components/discover/Sparkline";

/**
 * ui-v3 Discover — the ONLY data access "02 Discover" and "15 Discover Screener"
 * perform. Same split as src/ui-v3/home-data.ts: everything under
 * src/ui-v3/components/discover is pure presentation and takes a view model.
 *
 * HONESTY RULES (identical to home-data.ts):
 *  - A field with no real source is `null` and the component omits the element.
 *  - Fixture content is reachable ONLY through `source: "fixtures"`, which is
 *    only chosen when there is no authenticated user.
 *
 * Where the artboard's number does not exist in the data layer, the CLOSEST
 * REAL field is rendered and the difference is stated at the mapper. The three
 * that matter:
 *
 *  1. "▲ 324%" on a Rising-fast card. There is no percentage-of-attention-change
 *     anywhere in the codebase. The real attention delta is the trending core's
 *     `change` (club_change_14d), a SCORE-POINT delta — so it renders as
 *     "▲ 12" with no percent sign, the same rule Home applies to its tiles.
 *  2. The screener's "club signal" pill. That is `sentiment.bullPct` — which is
 *     also what the artboard's own "Club's most bullish" card repeats for the
 *     same ticker, so one field genuinely backs both regions.
 *  3. Sparklines. No core carries a series. Rather than a per-ticker network
 *     call per tile, the series is reconstructed from `screener_metrics` the way
 *     the existing screener does it: price, and the price implied by each
 *     reported change window. Every point is a real close the feed reported.
 */

// ── view model ───────────────────────────────────────────────────────────────

export interface RisingTileVM {
  ticker: string;
  /**
   * The artboard's "▲ 324%". Real source is the trending core's `change`
   * (club_change_14d), which is a score-point delta — see rule 1 above.
   */
  change: number | null;
  /** False when `change` is that unbounded point delta, which must NOT wear a %. */
  isPct: boolean;
  series: number[] | null;
  /** The stroke tone, from the SERIES' OWN direction — see `toneFor`. */
  tone: SparkTone;
  /** Real: trending core `watchers` (distinct members ever watching). */
  watchersLabel: string | null;
}

export interface DivisiveVM {
  ticker: string;
  bullPct: number;
  bearPct: number;
  /** Real: bull + neutral + bear on the trending row. */
  opinionsLabel: string | null;
}

export interface BeltWatchVM {
  ticker: string;
}

export interface QuietToLoudVM {
  ticker: string;
  series: number[] | null;
  tone: SparkTone;
}

export interface DiscoverViewModel {
  source: "live" | "fixtures";
  rising: RisingTileVM[];
  divisive: DivisiveVM | null;
  beltWatch: BeltWatchVM[];
  quietToLoud: QuietToLoudVM[];
  /** `TRENDING_DISCLAIMER`, verbatim — the contract's MUST-render line. */
  disclaimer: string;
}

export interface StanceRowVM {
  ticker: string;
  /**
   * The stance share. NULL when the ticker has too few positioned members for a
   * percentage to mean anything (MIN_POSITIONED_OPINIONS) — the row still ranks,
   * it just does not print a number it cannot support.
   */
  pct: number | null;
}

export interface StanceCardVM {
  rows: StanceRowVM[];
  /**
   * What the card is ordered by, when it is NOT the percentage. Rendered as the
   * card's own caption so a list with no visible numbers still says what ranked
   * it. Null when every row carries a real percentage.
   */
  orderLabel: string | null;
  /** Shown in place of the list when nothing qualifies. */
  emptyCopy: string | null;
}

export interface TrendingChipVM {
  ticker: string;
  /** The trending core's `change` — a score-point delta, so no percent sign. */
  change: number;
  /** False when `change` is that unbounded point delta. */
  isPct: boolean;
  /** The artboard flames its two leaders. */
  hot: boolean;
}

export interface ScreenerViewModel {
  source: "live" | "fixtures";
  /**
   * THE WHOLE SCREENABLE SET, unfiltered. The chips are interactive, so the
   * screen is applied in the browser (see src/ui-v3/screener-filter.ts) and the
   * server's job is to ship the candidates, not one pre-screened page of them.
   */
  candidates: ScreenerCandidateVM[];
  /** The sectors PRESENT in `candidates` — the filter never offers an empty one. */
  sectors: Sector[];
  /** The screen the board opens on: the artboard's own three thresholds. */
  initialFilters: ScreenerFilters;
  /**
   * The three regions below the results are the CLUB's stance, not the screen's:
   * they read the whole ledger and do not answer to the chips. Narrowing them
   * would make "Club's most bullish" mean "most bullish large-cap tech name",
   * which is not what the heading says.
   */
  mostBullish: StanceCardVM;
  mostBearish: StanceCardVM;
  trendingChips: TrendingChipVM[];
  /** `TRENDING_DISCLAIMER`, verbatim — the contract's MUST-render line. */
  disclaimer: string;
}

// ── narrow reads of the seed (sections cross the RSC boundary as `unknown`) ───

interface RawTrendingRow {
  rank?: number | null;
  ticker?: string | null;
  score?: number | null;
  change?: number | null;
  watchers?: number | null;
  heat?: number | null;
  sentiment?: {
    bull?: number | null;
    neutral?: number | null;
    bear?: number | null;
    bullPct?: number | null;
  } | null;
}

interface MetricRow {
  ticker: string;
  sector: string | null;
  mcap: number | null;
  price: number | null;
  chg_1d: number | null;
  chg_5d: number | null;
  chg_1m: number | null;
  chg_3m: number | null;
}

function seedRows(section: unknown): RawTrendingRow[] {
  if (!section || typeof section !== "object") return [];
  const value = (section as Record<string, unknown>).rows;
  return Array.isArray(value) ? (value as RawTrendingRow[]) : [];
}

// ── shared derivations ───────────────────────────────────────────────────────

/** The artboard shows three Rising-fast cards, five Quiet-to-loud columns. */
const RISING_LIMIT = 3;
const QUIET_LIMIT = 5;
const BELT_LIMIT = 5;
/** "15 Discover Screener" draws three names per stance. */
const STANCE_LIMIT = 3;
const TRENDING_CHIP_LIMIT = 5;

/** "1.2K watching" — the artboard's compact count. */
function compact(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1)}K`;
  }
  return String(n);
}

/**
 * A real price series for a ticker, reconstructed from the changes the feed
 * reported: each window's percentage implies the close it moved from. This is
 * the same derivation the existing screener uses, and it costs no extra call.
 * Fewer than three usable points → no series, and the caller draws none.
 */
function seriesFor(m: MetricRow | undefined): number[] | null {
  if (!m || m.price == null) return null;
  const p = m.price;
  const at = (chg: number | null) => (chg == null ? null : p / (1 + chg / 100));
  const pts = [at(m.chg_3m), at(m.chg_1m), at(m.chg_5d), at(m.chg_1d), p].filter(
    (v): v is number => v != null && Number.isFinite(v) && v > 0,
  );
  return pts.length >= 3 ? pts : null;
}

/**
 * The stroke tone for a sparkline, read off THE LINE ITSELF.
 *
 * This used to be assigned from a neighbouring number — the card's attention
 * delta on "Rising fast", the 1-day change on a screener row — which meant a
 * path that visibly fell could be stroked green because attention was up, or a
 * quarter-long climb stroked red because today was down. The only tone that
 * cannot contradict the drawing is the drawing's own first-to-last direction.
 *
 * A flat series reads positive, matching the artboards, where every drawn path
 * rises and none is flat.
 */
function toneFor(series: number[] | null): SparkTone {
  if (!series || series.length < 2) return "positive";
  return series[series.length - 1] < series[0] ? "negative" : "positive";
}

function bearPctOf(row: RawTrendingRow): number | null {
  const s = row.sentiment;
  if (!s) return null;
  const positioned = (s.bull ?? 0) + (s.neutral ?? 0) + (s.bear ?? 0);
  if (positioned <= 0) return null;
  return Math.round(((s.bear ?? 0) / positioned) * 100);
}

function positionedOf(row: RawTrendingRow): number {
  const s = row.sentiment;
  if (!s) return 0;
  return (s.bull ?? 0) + (s.neutral ?? 0) + (s.bear ?? 0);
}

/**
 * "Most divisive" — the row whose bull share sits closest to an even split, out
 * of those with enough positioned members to mean anything. Mirrors the rule
 * the current Discover surface already applies to the same ledger.
 */
/**
 * ONE floor, shared with Home's trending strip and the Screener's stance cards
 * (src/ui-v3/club-floors.ts) — the point below which a bull/bear share is one
 * person's click rather than a split worth naming.
 */
const DIVISIVE_MIN_POSITIONED = MIN_POSITIONED_OPINIONS;
const DIVISIVE_MAX_GAP = 20;

function pickDivisive(rows: RawTrendingRow[]): DivisiveVM | null {
  let best: { row: RawTrendingRow; gap: number } | null = null;
  for (const row of rows) {
    const bullPct = row.sentiment?.bullPct;
    if (typeof bullPct !== "number" || typeof row.ticker !== "string") continue;
    if (positionedOf(row) < DIVISIVE_MIN_POSITIONED) continue;
    const gap = Math.abs(50 - bullPct);
    if (gap > DIVISIVE_MAX_GAP) continue;
    if (!best || gap < best.gap) best = { row, gap };
  }
  if (!best) return null;

  const bullPct = best.row.sentiment?.bullPct as number;
  const bearPct = bearPctOf(best.row);
  if (bearPct === null) return null;
  const positioned = positionedOf(best.row);

  return {
    ticker: (best.row.ticker as string).toUpperCase(),
    bullPct,
    bearPct,
    opinionsLabel: positioned > 0 ? `${compact(positioned)} opinions` : null,
  };
}

// ── live reads ───────────────────────────────────────────────────────────────

/** The trending ledger, narrowed to rows that actually name a ticker. */
async function readLedger(): Promise<RawTrendingRow[]> {
  const supabase = await getRequestClient();
  const { rest } = buildClubHomeSeedSplit(supabase);
  const seed = await rest;
  return seedRows(seed?.trending).filter(
    (r): r is RawTrendingRow & { ticker: string } =>
      typeof r?.ticker === "string" && r.ticker.length > 0,
  );
}

const METRIC_COLS = "ticker, sector, mcap, price, chg_1d, chg_5d, chg_1m, chg_3m";

/** Screener metrics for exactly the tickers on screen, keyed by symbol. */
async function readMetrics(tickers: string[]): Promise<Map<string, MetricRow>> {
  if (tickers.length === 0) return new Map();
  const supabase = await getRequestClient();
  const { data } = await supabase
    .from("screener_metrics")
    .select(METRIC_COLS)
    .in("ticker", tickers);
  const map = new Map<string, MetricRow>();
  for (const row of (data ?? []) as MetricRow[]) map.set(row.ticker.toUpperCase(), row);
  return map;
}

// ── 02 Discover ──────────────────────────────────────────────────────────────

export async function getDiscoverViewModel(): Promise<DiscoverViewModel> {
  const user = await getRequestUser();
  if (!user) return discoverFixtures();

  const [ledger, belts] = await Promise.all([readLedger(), getCachedBeltWatch()]);

  // Rising fast = the top of the ledger. Quiet to loud = the biggest 14-day
  // attention movers that are NOT already on screen above — literally the names
  // climbing from nowhere rather than the ones already loudest.
  const rising = ledger.slice(0, RISING_LIMIT);
  const risingSet = new Set(rising.map((r) => (r.ticker as string).toUpperCase()));
  const quiet = ledger
    .filter((r) => !risingSet.has((r.ticker as string).toUpperCase()))
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
    .slice(0, QUIET_LIMIT);

  const metrics = await readMetrics(
    [...rising, ...quiet].map((r) => (r.ticker as string).toUpperCase()),
  );

  return {
    source: "live",
    rising: rising.map((r) => {
      const ticker = (r.ticker as string).toUpperCase();
      const series = seriesFor(metrics.get(ticker));
      return {
        ticker,
        change: r.change ?? null,
        isPct: false,
        series,
        tone: toneFor(series),
        watchersLabel:
          typeof r.watchers === "number" && r.watchers > 0
            ? `${compact(r.watchers)} watching`
            : null,
      };
    }),
    divisive: pickDivisive(ledger),
    beltWatch: belts.beltWatch
      .slice(0, BELT_LIMIT)
      .map((b) => ({ ticker: b.ticker.toUpperCase() })),
    quietToLoud: quiet.map((r) => {
      const ticker = (r.ticker as string).toUpperCase();
      const series = seriesFor(metrics.get(ticker));
      return {
        ticker,
        series,
        // The artboard strokes these five in four decorative colours while every
        // path rises. The one honest tone axis is the line's own direction.
        tone: toneFor(series),
      };
    }),
    disclaimer: TRENDING_DISCLAIMER,
  };
}

// ── 15 Discover Screener ─────────────────────────────────────────────────────

export async function getScreenerViewModel(): Promise<ScreenerViewModel> {
  const user = await getRequestUser();
  if (!user) return screenerFixtures();

  const ledger = await readLedger();
  const metrics = await readMetrics(ledger.map((r) => (r.ticker as string).toUpperCase()));

  // THE CANDIDATE SET. The ledger is the base because "club signal" only exists
  // there; sector, market cap, price and day change are joined off
  // screener_metrics. No predicate runs here — the chips own that now, and they
  // run in the browser (src/ui-v3/screener-filter.ts).
  const candidates: ScreenerCandidateVM[] = ledger.map((r) => {
    const ticker = (r.ticker as string).toUpperCase();
    const m = metrics.get(ticker);
    const series = seriesFor(m);
    return {
      ticker,
      series,
      tone: toneFor(series),
      priceLabel: m?.price != null ? `$${m.price.toFixed(2)}` : null,
      changePct: m?.chg_1d ?? null,
      // The club-signal pill is a share, and it obeys the same floor as the
      // stance cards it is repeated on. Below the floor it is null — which the
      // signal predicate then reads as "not screenable", not as a zero. Without
      // this the screen matched names whose 100% was a single member's click.
      signalPct:
        positionedOf(r) >= MIN_POSITIONED_OPINIONS ? (r.sentiment?.bullPct ?? null) : null,
      sector: sectorOf(m?.sector),
      mcap: m?.mcap ?? null,
    };
  });

  // Only sectors with a name behind them are offered — a picker whose options
  // can only ever return zero rows is a worse lie than no picker.
  const present = new Set(candidates.map((c) => c.sector).filter(Boolean));
  const sectors = SECTORS.filter((s) => present.has(s));

  const stance = ledger.filter((r) => typeof r.sentiment?.bullPct === "number");

  // ── MOST BULLISH ──────────────────────────────────────────────────────────
  // Ranked by bull share either way, but the share is only PRINTED once enough
  // members are positioned. Below the floor the card ranks by club score and
  // says so, rather than printing "100%" off one member's click.
  const bullishRanked = [...stance].sort(
    (a, b) => (b.sentiment?.bullPct ?? 0) - (a.sentiment?.bullPct ?? 0),
  );
  const bullishShown = bullishRanked.slice(0, STANCE_LIMIT);
  const bullishHasFloor =
    bullishShown.length > 0 &&
    bullishShown.every((r) => positionedOf(r) >= MIN_POSITIONED_OPINIONS);
  const mostBullish: StanceCardVM = {
    rows: (bullishHasFloor
      ? bullishShown
      : // No printable share → rank by the ledger's own score instead, so the
        // ordering is still something real.
        [...stance].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, STANCE_LIMIT)
    ).map((r) => ({
      ticker: (r.ticker as string).toUpperCase(),
      pct: bullishHasFloor ? (r.sentiment?.bullPct as number) : null,
    })),
    orderLabel: bullishHasFloor ? null : "By club score",
    emptyCopy: stance.length === 0 ? DISCOVER_EMPTY.bullish : null,
  };

  // ── MOST BEARISH ──────────────────────────────────────────────────────────
  // A 0% bear share is not a bearish name. Keeping those rows made this card a
  // verbatim copy of the bullish one — same three tickers, all reading "0%".
  const bearishRanked = stance
    .map((r) => ({ row: r, bear: bearPctOf(r) }))
    .filter((x): x is { row: RawTrendingRow; bear: number } => x.bear !== null && x.bear > 0)
    .sort((a, b) => b.bear - a.bear);
  const bearishShown = bearishRanked.slice(0, STANCE_LIMIT);
  const bearishHasFloor =
    bearishShown.length > 0 &&
    bearishShown.every((x) => positionedOf(x.row) >= MIN_POSITIONED_OPINIONS);
  const mostBearish: StanceCardVM = {
    rows: bearishShown.map((x) => ({
      ticker: (x.row.ticker as string).toUpperCase(),
      pct: bearishHasFloor ? x.bear : null,
    })),
    orderLabel: bearishShown.length > 0 && !bearishHasFloor ? "By bear share" : null,
    emptyCopy: bearishShown.length === 0 ? DISCOVER_EMPTY.bearish : null,
  };

  return {
    source: "live",
    candidates,
    sectors,
    initialFilters: DEFAULT_FILTERS,
    mostBullish,
    mostBearish,
    trendingChips: ledger
      .filter((r) => typeof r.change === "number")
      .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
      .slice(0, TRENDING_CHIP_LIMIT)
      .map((r, i) => ({
        ticker: (r.ticker as string).toUpperCase(),
        change: r.change as number,
        isPct: false,
        // The artboard flames its two leaders; here that is literally the top two.
        hot: i < 2,
      })),
    disclaimer: TRENDING_DISCLAIMER,
  };
}

// ── fixtures branch ──────────────────────────────────────────────────────────

/**
 * The anonymous view.
 *
 * Unlike Home, the shared club fixtures cannot drive these two screens: their
 * trending rows carry only {rank, ticker, company, score, change} — no
 * `watchers`, no `sentiment`, no `heat` — so every region below except the
 * ticker list would resolve to null and the screen would render as a skeleton.
 *
 * So this branch is the ARTBOARD's own content, exactly as home-data.ts does for
 * the three values its fixtures do not cover. It exists so the design proof is
 * complete and so an anonymous visitor sees a real screen. It is unreachable the
 * moment a session exists.
 *
 * The series below are the artboard's own drawn polylines, read back out of the
 * mockup SVG path data (y inverted, since SVG y grows downward).
 */
const ART_SERIES = {
  SMCI: [3, 6, 4, 11, 9, 17, 20],
  PLTR: [4, 3, 9, 7, 14, 12, 19],
  SOFI: [2, 5, 4, 10, 8, 15, 17],
  IONQ: [4, 8, 5, 15, 12, 23, 26],
  APP: [6, 4, 12, 9, 20, 24, 24],
  RIVN: [3, 7, 5, 16, 14, 22, 22],
  LCID: [5, 9, 7, 18, 16, 25, 25],
  OKLO: [4, 6, 11, 10, 21, 24, 24],
  NVDA: [3, 6, 5, 11, 9, 16, 16],
  AMD: [5, 4, 8, 6, 12, 15, 15],
} as const;

function discoverFixtures(): DiscoverViewModel {
  return {
    source: "fixtures",
    rising: [
      { ticker: "SMCI", change: 324, isPct: true, series: [...ART_SERIES.SMCI], tone: toneFor([...ART_SERIES.SMCI]), watchersLabel: "1.2K watching" },
      { ticker: "PLTR", change: 210, isPct: true, series: [...ART_SERIES.PLTR], tone: toneFor([...ART_SERIES.PLTR]), watchersLabel: "2.3K watching" },
      { ticker: "SOFI", change: 167, isPct: true, series: [...ART_SERIES.SOFI], tone: toneFor([...ART_SERIES.SOFI]), watchersLabel: "889 watching" },
    ],
    divisive: {
      ticker: "NFLX",
      bullPct: 32,
      bearPct: 68,
      opinionsLabel: "2.4K opinions",
    },
    beltWatch: ["NVDA", "AAPL", "MSFT", "CRWD", "AMZN"].map((ticker) => ({ ticker })),
    // The artboard's four decorative stroke colours, kept for the design proof.
    // Every fixture path rises, so none of them contradicts its own direction.
    quietToLoud: [
      { ticker: "IONQ", series: [...ART_SERIES.IONQ], tone: "negative" },
      { ticker: "APP", series: [...ART_SERIES.APP], tone: "accent" },
      { ticker: "RIVN", series: [...ART_SERIES.RIVN], tone: "gold" },
      { ticker: "LCID", series: [...ART_SERIES.LCID], tone: "positive" },
      { ticker: "OKLO", series: [...ART_SERIES.OKLO], tone: "positive" },
    ],
    disclaimer: TRENDING_DISCLAIMER,
  };
}

/**
 * The anonymous screener.
 *
 * ONE DELIBERATE DIVERGENCE FROM THE ARTBOARD. Board 15's count line reads "14
 * MATCHES" above three rows, which worked while the count and the list were two
 * unrelated strings — the adapter reported every match and drew only the top
 * three. Now that the chips are live, the count is computed from the list the
 * member is actually looking at, so three artboard rows read "3 matches". The
 * rows themselves are the artboard's, unchanged; only the number that describes
 * them stopped being independent of them.
 */
function screenerFixtures(): ScreenerViewModel {
  return {
    source: "fixtures",
    candidates: [
      {
        ticker: "NVDA",
        series: [...ART_SERIES.NVDA],
        tone: toneFor([...ART_SERIES.NVDA]),
        priceLabel: "$173.42",
        changePct: 4.7,
        signalPct: 78,
        sector: "Technology",
        mcap: 4.2e12,
      },
      {
        ticker: "PLTR",
        series: [...ART_SERIES.PLTR],
        tone: toneFor([...ART_SERIES.PLTR]),
        priceLabel: "$156.90",
        changePct: 2.1,
        signalPct: 74,
        sector: "Technology",
        mcap: 3.7e11,
      },
      {
        ticker: "AMD",
        series: [...ART_SERIES.AMD],
        tone: toneFor([...ART_SERIES.AMD]),
        priceLabel: "$182.10",
        changePct: 1.9,
        signalPct: 71,
        sector: "Technology",
        mcap: 2.9e11,
      },
    ],
    sectors: ["Technology"],
    initialFilters: DEFAULT_FILTERS,
    mostBullish: {
      rows: [
        { ticker: "NVDA", pct: 78 },
        { ticker: "PLTR", pct: 74 },
        { ticker: "AMD", pct: 71 },
      ],
      orderLabel: null,
      emptyCopy: null,
    },
    mostBearish: {
      rows: [
        { ticker: "NFLX", pct: 68 },
        { ticker: "RIVN", pct: 61 },
        { ticker: "LCID", pct: 57 },
      ],
      orderLabel: null,
      emptyCopy: null,
    },
    trendingChips: [
      { ticker: "SMCI", change: 324, isPct: true, hot: true },
      { ticker: "IONQ", change: 188, isPct: true, hot: true },
      { ticker: "SOFI", change: 167, isPct: true, hot: false },
      { ticker: "OKLO", change: 140, isPct: true, hot: false },
      { ticker: "APP", change: -12, isPct: true, hot: false },
    ],
    disclaimer: TRENDING_DISCLAIMER,
  };
}
