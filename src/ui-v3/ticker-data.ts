import "server-only";

import { getRequestClient, getRequestUser } from "@/lib/supabase/rsc";
import { buildClubHomeSeedSplit } from "@/lib/club/home-payload";
import { getBars, getOHLCBars, type Bar, type OHLCBar } from "@/lib/market/polygon";
import { getFundamentals } from "@/lib/market/polygon";
import { listCircles } from "@/lib/circles";
import { KAI_REPORT_DISCLAIMER } from "@/lib/kai/report";
import type { KaiReportSections } from "@/lib/kai/persona";
import { MIN_POSITIONED_OPINIONS } from "@/ui-v3/club-floors";
import { TRENDING_DISCLAIMER } from "@/lib/club/score";
import { beltForXp, type BeltKey } from "@/lib/belts";

/**
 * ui-v3 Ticker — the ONLY data access the four ticker boards perform
 * ("03 Ticker NVDA", "12 Ticker Technicals", "13 Ticker Fundamentals",
 * "14 Kai Report"). Everything under `src/ui-v3/components/ticker` is pure
 * presentation and receives a view model, exactly as home/discover/watch do.
 *
 * HONESTY RULES (same contract as home-data.ts / discover-data.ts):
 *  - A field with no real source is `null` and the component omits the element.
 *  - Fixture content is reachable ONLY through `source: "fixtures"`, which is
 *    only chosen when there is no authenticated user — and then only for the
 *    artboard's own symbol (NVDA). Any other symbol 404s for an anonymous
 *    visitor rather than being handed another company's drawn numbers.
 *
 * WHAT THE ARTBOARDS DRAW THAT NOTHING BACKS — every omission, stated once:
 *
 *  1. "03" chart member markers (TR / KD / OG pinned on the price line). There
 *     is no per-member, per-price-point annotation anywhere in the schema.
 *     OMITTED.
 *  2. "03" ring caption "WEIGHTED SIGNAL 78%". No belt-weighted signal is
 *     computed anywhere. The nearest real dial is the trending core's `heat`
 *     (0-100 club score, nulled below the trending floor) — so the ring renders
 *     `heat` and is captioned CLUB SCORE, the same substitution Home's strip
 *     already makes. No heat → no ring.
 *  3. "03" stat card "88% Black Belts". A per-ticker black-belt bull share
 *     needs a belt x stance join that does not exist. OMITTED — the row draws
 *     the three cards that are real.
 *  4. "03" "Shift today +14". `get_ticker_stance_summary.mind_changes` is the
 *     real, comparable number (distinct members who have flipped on this name),
 *     but it is lifetime, not today — so it is LABELLED "Minds changed".
 *  5. "12" "Pattern detected · Ascending Triangle · 72% historical
 *     follow-through". No pattern engine and no follow-through statistics
 *     exist. OMITTED entirely rather than named from nothing.
 *  6. "12" "Above MA200". `screener_metrics` carries ema20_state / ema50_state
 *     and no 200-period state. The tile row renders the states that exist plus
 *     the real relative-volume ratio.
 *  7. "12" verdict word "BUY". The signal mix is real (see `mixOf`) but the
 *     word is not: an execution verb is advice, and every other club surface is
 *     explicitly not that. The gauge prints a DESCRIPTION of the mix
 *     ("Leaning bullish" / "Mixed" / "Leaning bearish").
 *  8. "13" grade hero ("A−", "Elite grower", "Top 3% margins"). No grading
 *     model and no percentile universe exist. OMITTED.
 *  9. "13" "FY26E" projected revenue bar and "Fwd P/E". Polygon serves REPORTED
 *     financials only — there is no consensus feed on this account. The revenue
 *     chart draws reported years only; the peer bars are TRAILING P/E and say
 *     so.
 * 10. "14" verdict "Accumulate" + "82% CONF". `kai_reports.sections` has no
 *     verdict and no confidence field, and a verdict is advice. The panel
 *     renders the report's own `headline`, and there is no confidence ring.
 * 11. "14" "Share report" action. No share implementation exists. OMITTED —
 *     the bar carries the one real destination.
 */

/* ── view model ───────────────────────────────────────────────────────────── */

export type TickerTab = "overview" | "technicals" | "fundamentals" | "kai";

/** The identity + quote block every board repeats. */
export interface TickerHeadVM {
  symbol: string;
  /** `screener_metrics.name`, or null — then the boards show the symbol alone. */
  name: string | null;
  /** `screener_metrics.price`. */
  price: number | null;
  /** `screener_metrics.chg_1d`. */
  changePct: number | null;
  /** `ticker_intel_snapshots.rank` — the "#1 in the Club" pill. Null = unranked. */
  clubRank: number | null;
  /** `ticker_intel_snapshots.watchers` — the "826 watching now" line. */
  watchers: number | null;
  /** True when this name sits on the community watchlist (the ★). Read-only. */
  onWatchlist: boolean;
}

export interface ChartPointVM {
  x: number;
  y: number;
}

export interface TickerChartVM {
  /** SVG path in the artboard's 354x128 user space. */
  path: string;
  /** The same path closed to the floor, for the artboard's soft fill. */
  areaPath: string;
  /** Direction of the drawn line itself — never a neighbouring number. */
  rising: boolean;
  /** The artboard's four axis ticks, derived from the real series' timestamps. */
  axis: string[];
}

export interface RangeChipVM {
  key: string;
  label: string;
  active: boolean;
  href: string;
}

export interface StanceVM {
  bullPct: number;
  bearPct: number;
  neutralPct: number;
  positioned: number;
  /** `get_ticker_stance_summary.mind_changes` — DISTINCT members who flipped. */
  mindChanges: number;
}

export interface StatCardVM {
  value: string;
  label: string;
  tone: "text" | "positive" | "accent";
}

export interface ActiveCircleVM {
  slug: string;
  title: string;
  ticker: string | null;
  /** "7 days left" — from the Circle's own expires_at. Null once it has run out. */
  clock: string | null;
  members: number;
}

export interface VoiceVM {
  id: string;
  authorName: string;
  initials: string;
  beltLabel: string | null;
  beltKey: BeltKey | null;
  snippet: string;
  kind: string;
}

export interface TickerOverviewVM {
  source: "live" | "fixtures";
  head: TickerHeadVM;
  chart: TickerChartVM | null;
  ranges: RangeChipVM[];
  stance: StanceVM | null;
  /** The ring: trending `heat`, 0-100. Null → the ring is not drawn. */
  clubScore: number | null;
  stats: StatCardVM[];
  circle: ActiveCircleVM | null;
  voices: VoiceVM[];
  disclaimer: string;
}

export interface LevelVM {
  label: string;
  value: number;
  kind: "resistance" | "support" | "price";
}

export interface TechIndicatorVM {
  label: string;
  /** The printed value. */
  value: string;
  bullish: boolean | null;
}

export interface TickerTechnicalsVM {
  source: "live" | "fixtures";
  head: TickerHeadVM;
  /** 0-100 share of the real checks below that read bullish. Null = no checks. */
  mixPct: number | null;
  mixWord: string | null;
  mixBullish: number;
  mixTotal: number;
  /** `screener_metrics.rsi14`. */
  rsi: number | null;
  /** MACD histogram computed from real daily closes — see `macdHistogram`. */
  macd: { bars: number[]; crossUp: boolean | null } | null;
  /** Floor-trader pivots off the latest real daily bar. Empty = no bar. */
  levels: LevelVM[];
  /** The state tiles that have a source: ema20/ema50 states + volume ratio. */
  tiles: TechIndicatorVM[];
  footnote: string;
}

export interface RevenueBarVM {
  label: string;
  value: number;
  /** 0-100, relative to the tallest reported year. */
  pct: number;
  valueLabel: string;
  lead: boolean;
}

export interface MarginDialVM {
  label: string;
  pct: number;
  tone: "positive" | "gold" | "info";
}

export interface PeerBarVM {
  ticker: string;
  pe: number;
  pct: number;
  self: boolean;
}

export interface TickerFundamentalsVM {
  source: "live" | "fixtures";
  head: TickerHeadVM;
  revenue: { bars: RevenueBarVM[]; yoyPct: number | null } | null;
  margins: MarginDialVM[];
  peers: { rows: PeerBarVM[]; sector: string | null } | null;
  footnote: string;
}

export interface KaiSectionVM {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  /** A real close series, drawn only on the section the price data belongs to. */
  series: number[] | null;
}

export interface TickerKaiVM {
  source: "live" | "fixtures";
  head: TickerHeadVM;
  report: {
    headline: string;
    sectorTagline: string | null;
    generatedLabel: string;
    sections: KaiSectionVM[];
    risks: string[];
  } | null;
  disclaimer: string;
}

/* ── shared plumbing ──────────────────────────────────────────────────────── */

async function soft<T>(work: () => PromiseLike<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** The artboard's own symbol — the only one the anonymous branch will draw. */
export const FIXTURE_SYMBOL = "NVDA";

/**
 * A well-formed US equity symbol. Anything else is a 404 before a single query
 * runs, so a junk path never reaches Polygon or Postgres.
 */
export function normalizeTicker(raw: string): string | null {
  const s = decodeURIComponent(raw || "").trim().toUpperCase();
  return /^[A-Z][A-Z.\-]{0,5}$/.test(s) ? s : null;
}

interface MetricRow {
  ticker: string;
  name: string | null;
  sector: string | null;
  mcap: number | null;
  price: number | null;
  chg_1d: number | null;
  vol: number | null;
  avg_vol_20: number | null;
  vol_ratio: number | null;
  rsi14: number | null;
  ema20_state: string | null;
  ema50_state: string | null;
}

const METRIC_COLS =
  "ticker, name, sector, mcap, price, chg_1d, vol, avg_vol_20, vol_ratio, rsi14, ema20_state, ema50_state";

interface SnapshotRow {
  ticker: string;
  rank: number | null;
  club_score: number | null;
  watchers: number | null;
}

interface StanceSummaryRow {
  bull?: number;
  bear?: number;
  neutral?: number;
  mind_changes?: number;
}

/**
 * The identity + quote block, shared by all four boards.
 *
 * Returns null when the symbol resolves to nothing at all — no screener row and
 * no snapshot — which the route turns into the v3 404. A name the club has
 * never touched but the feed does carry still resolves, because
 * `screener_metrics` is the whole tradable universe.
 */
async function readHead(symbol: string): Promise<TickerHeadVM | null> {
  const supabase = await getRequestClient();

  const [metric, snapshot, watch] = await Promise.all([
    soft(
      async () =>
        ((await supabase.from("screener_metrics").select(METRIC_COLS).eq("ticker", symbol).maybeSingle())
          .data ?? null) as MetricRow | null,
      null as MetricRow | null,
    ),
    soft(
      async () =>
        ((
          await supabase
            .from("ticker_intel_snapshots")
            .select("ticker, rank, club_score, watchers")
            .eq("ticker", symbol)
            .maybeSingle()
        ).data ?? null) as SnapshotRow | null,
      null as SnapshotRow | null,
    ),
    soft(
      async () =>
        Boolean(
          (
            await supabase
              .from("community_watchlist")
              .select("id")
              .eq("ticker", symbol)
              .eq("status", "active")
              .limit(1)
              .maybeSingle()
          ).data,
        ),
      false,
    ),
  ]);

  if (!metric && !snapshot) return null;

  return {
    symbol,
    name: metric?.name?.trim() || null,
    price: num(metric?.price),
    changePct: num(metric?.chg_1d),
    clubRank: num(snapshot?.rank),
    watchers: num(snapshot?.watchers),
    onWatchlist: watch,
  };
}

/** The metric row again, without a second head read (all tabs want both). */
async function readMetric(symbol: string): Promise<MetricRow | null> {
  const supabase = await getRequestClient();
  return soft(
    async () =>
      ((await supabase.from("screener_metrics").select(METRIC_COLS).eq("ticker", symbol).maybeSingle())
        .data ?? null) as MetricRow | null,
    null as MetricRow | null,
  );
}

/* ── 03 Ticker: the chart ─────────────────────────────────────────────────── */

/**
 * The artboard's six range chips, each a real query against a real feed.
 *
 * Intraday ranges come from `getOHLCBars` (Polygon serves 5-minute and hourly
 * aggregates on this plan, delayed ~15 min); the longer ones come from the
 * daily `getBars` the watch board already uses. Nothing is resampled or
 * interpolated — every point is a close the feed reported.
 */
const RANGES = [
  { key: "1D", label: "1D" },
  { key: "1W", label: "1W" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "1Y", label: "1Y" },
  { key: "ALL", label: "ALL" },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

export function normalizeRange(raw: string | undefined): RangeKey {
  const k = (raw ?? "").toUpperCase();
  return (RANGES.find((r) => r.key === k)?.key ?? "1D") as RangeKey;
}

interface Point {
  t: number;
  c: number;
}

async function readSeries(symbol: string, range: RangeKey): Promise<Point[] | null> {
  const daily = async (days: number): Promise<Point[] | null> => {
    const bars = await soft(() => getBars(symbol, days), null as Bar[] | null);
    return bars && bars.length >= 2 ? bars.map((b) => ({ t: b.t, c: b.c })) : null;
  };
  const intraday = async (tf: string, windowMs: number): Promise<Point[] | null> => {
    const bars = await soft(() => getOHLCBars(symbol, tf), null as OHLCBar[] | null);
    if (!bars || bars.length < 2) return null;
    const last = bars[bars.length - 1].t;
    const kept = bars.filter((b) => b.t >= last - windowMs);
    const use = kept.length >= 2 ? kept : bars.slice(-40);
    return use.map((b) => ({ t: b.t, c: b.c }));
  };

  /**
   * 1D is ONE SESSION, not the last 24 hours, and not a half-hour of
   * pre-market.
   *
   * Two things go wrong with the obvious implementations. A rolling window
   * walked back from the final print reaches into the PREVIOUS evening, because
   * Polygon serves extended-hours bars — the axis came back reading "7:20 PM ·
   * 6:05 AM · 8:45 AM · 11:20 AM", a day and a half of trading under a chip
   * labelled 1D. But grouping strictly by the last bar's calendar date is worse
   * before the bell: at 8:55 AM the newest day holds only pre-market, so a
   * member opening a ticker over breakfast gets a thin squiggle instead of
   * yesterday's actual session.
   *
   * So: group by New York calendar day and take the last day that looks like a
   * real session, falling back to the newest day when none does (a freshly
   * listed name, a half day). The chart is then always the last session there
   * was, which is what a member means by "today".
   */
  const SESSION_MIN_BARS = 40;

  const session = async (): Promise<Point[] | null> => {
    const bars = await soft(() => getOHLCBars(symbol, "5m"), null as OHLCBar[] | null);
    if (!bars || bars.length < 2) return null;

    const dayOf = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const byDay = new Map<string, OHLCBar[]>();
    for (const b of bars) {
      const key = dayOf.format(new Date(b.t));
      const list = byDay.get(key);
      if (list) list.push(b);
      else byDay.set(key, [b]);
    }

    const days = [...byDay.keys()].sort();
    const full = [...days].reverse().find((d) => (byDay.get(d)?.length ?? 0) >= SESSION_MIN_BARS);
    const use = byDay.get(full ?? days[days.length - 1]) ?? [];
    return use.length >= 2 ? use.map((b) => ({ t: b.t, c: b.c })) : null;
  };

  const DAY = 24 * 60 * 60 * 1000;
  switch (range) {
    case "1D":
      return session();
    case "1W":
      /*
       * 30-MINUTE, NOT HOURLY, and this is a data fact rather than a taste
       * call: on this Polygon account the 1-hour aggregate is STALE. Probed
       * 2026-07-30 for AAPL, every other timeframe answered through that
       * morning and `1/hour` stopped at 2026-05-11 — so a 1W chart built on
       * hourly bars rendered a week in May under a chip that says 1W, with a
       * correct-looking axis and eleven-week-old prices. 5m / 15m / 30m / 1d
       * are all current; 30m is the coarsest of those that still covers seven
       * days inside the 800-bar cap.
       */
      return intraday("30m", 7 * DAY);
    case "1M":
      return daily(31);
    case "3M":
      return daily(93);
    case "1Y":
      return daily(365);
    case "ALL":
      return daily(365 * 10);
  }
}

/** The artboard's plot box: 354 x 128, y measured downward. */
const CHART_W = 354;
const CHART_H = 128;
/** The artboard's line runs y 12..108 — 12px of headroom at both ends. */
const CHART_PAD = 12;

function buildChart(points: Point[], range: RangeKey): TickerChartVM | null {
  if (points.length < 2) return null;
  const closes = points.map((p) => p.c);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const usable = CHART_H - CHART_PAD * 2;

  const xy = points.map((p, i) => ({
    x: (i / (points.length - 1)) * CHART_W,
    y: CHART_PAD + (1 - (p.c - min) / span) * usable,
  }));

  const path = xy
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return {
    path,
    areaPath: `${path} L${CHART_W} ${CHART_H} L0 ${CHART_H} Z`,
    rising: closes[closes.length - 1] >= closes[0],
    axis: axisFor(points, range),
  };
}

/**
 * The artboard's four axis ticks ("9:30 AM … 4:00 PM"), read off the series' OWN
 * timestamps at four evenly spaced positions.
 *
 * THE UNIT FOLLOWS THE RANGE, and each of these was a real misreading before it
 * was fixed:
 *
 *   1D      clock time. One session, so the day is implied.
 *   1W      date. Bare clock times across a week gave "8:00 AM · 7:00 PM ·
 *           1:00 PM" — three times with no way to tell which day each was on.
 *   1M/3M   date.
 *   1Y/ALL  month and FULL year. A two-digit year rendered as "Aug 16", which
 *           reads as the sixteenth of August, not August 2016.
 */
function axisFor(points: Point[], range: RangeKey): string[] {
  const TZ = "America/New_York";
  const fmt = new Intl.DateTimeFormat(
    "en-US",
    range === "1D"
      ? { hour: "numeric", minute: "2-digit", timeZone: TZ }
      : range === "1Y" || range === "ALL"
        ? { month: "short", year: "numeric", timeZone: TZ }
        : { month: "short", day: "numeric", timeZone: TZ },
  );
  return [0, 1 / 3, 2 / 3, 1].map((f) =>
    fmt.format(
      new Date(points[Math.min(points.length - 1, Math.round(f * (points.length - 1)))].t),
    ),
  );
}

function rangeChips(symbol: string, active: RangeKey): RangeChipVM[] {
  return RANGES.map((r) => ({
    key: r.key,
    label: r.label,
    active: r.key === active,
    href: `/v3/ticker/${symbol}${r.key === "1D" ? "" : `?r=${r.key}`}`,
  }));
}

/* ── 03 Ticker: the club-score dial ───────────────────────────────────────── */

interface LedgerRow {
  ticker?: string | null;
  heat?: number | null;
}

/**
 * The 0-100 dial, read from the SAME field Home's strip reads.
 *
 * `ticker_intel_snapshots.club_score` is an unbounded weighted sum — printing it
 * in a ring captioned with a percent sign would be a category error, and a raw
 * 22 in a dial that looks like a percentage reads as a company nobody likes.
 * The trending core normalizes it against the top of the ledger into `heat`,
 * and gates it behind the trending-score floor so a founding club cannot show a
 * manufactured 100 for whichever name happens to rank first.
 *
 * Below the floor `heat` is null and the ring is simply not drawn.
 */
async function readHeat(symbol: string): Promise<number | null> {
  const supabase = await getRequestClient();
  const rows = await soft(async () => {
    const { rest } = buildClubHomeSeedSplit(supabase);
    const seed = await rest;
    const section = (seed as Record<string, unknown> | null)?.trending;
    const value =
      section && typeof section === "object"
        ? (section as Record<string, unknown>).rows
        : null;
    return Array.isArray(value) ? (value as LedgerRow[]) : [];
  }, [] as LedgerRow[]);

  const row = rows.find((r) => (r.ticker ?? "").toUpperCase() === symbol);
  return num(row?.heat);
}

/* ── 03 Ticker: the club's stance ─────────────────────────────────────────── */

async function readStance(symbol: string): Promise<StanceVM | null> {
  const supabase = await getRequestClient();
  const row = await soft(
    async () =>
      ((await supabase.rpc("get_ticker_stance_summary", { p_ticker: symbol })).data ??
        null) as StanceSummaryRow | null,
    null as StanceSummaryRow | null,
  );
  if (!row) return null;
  const bull = row.bull ?? 0;
  const bear = row.bear ?? 0;
  const neutral = row.neutral ?? 0;
  const positioned = bull + bear + neutral;
  // The one floor shared with Home's strip and the Screener's stance cards: a
  // share below it is one member's click, not the club's position.
  if (positioned < MIN_POSITIONED_OPINIONS) return null;
  return {
    bullPct: Math.round((bull / positioned) * 100),
    bearPct: Math.round((bear / positioned) * 100),
    neutralPct: Math.round((neutral / positioned) * 100),
    positioned,
    mindChanges: row.mind_changes ?? 0,
  };
}

/* ── 03 Ticker: the Circle on this name ───────────────────────────────────── */

function timeLeft(expiresAt: string): string | null {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} left`;
  const hours = Math.max(1, Math.floor(ms / (60 * 60 * 1000)));
  return `${hours}h left`;
}

async function readCircle(symbol: string): Promise<ActiveCircleVM | null> {
  const supabase = await getRequestClient();
  const { rows } = await soft(() => listCircles(supabase), {
    rows: [],
    missingSchema: true,
  });
  const match = rows.find((r) => (r.ticker ?? "").toUpperCase() === symbol);
  if (!match) return null;
  return {
    slug: match.slug,
    title: match.title,
    ticker: match.ticker,
    clock: timeLeft(match.expires_at),
    members: match.members,
  };
}

/* ── 03 Ticker: top voices ────────────────────────────────────────────────── */

interface CommentRow {
  id: string;
  body: string;
  contribution_type: string | null;
  user_id: string | null;
  created_at: string;
}

const VOICE_LIMIT = 3;

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * "TOP VOICES · Highest reputation takes".
 *
 * Reputation is the club's own ladder: a member's lifetime XP resolves their
 * belt, and the takes are ordered by it. Both halves are real reads
 * (`community_ticker_comments` for this ticker, `xp_for_users` for the authors),
 * so the caption is a description of the ordering rather than a claim the data
 * cannot support.
 */
async function readVoices(symbol: string): Promise<VoiceVM[]> {
  const supabase = await getRequestClient();
  const comments = await soft(
    async () =>
      ((
        await supabase
          .from("community_ticker_comments")
          .select("id, body, contribution_type, user_id, created_at")
          .eq("ticker", symbol)
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? []) as CommentRow[],
    [] as CommentRow[],
  );
  const authorIds = [...new Set(comments.map((c) => c.user_id).filter((v): v is string => !!v))];
  if (authorIds.length === 0) return [];

  const [profiles, xp] = await Promise.all([
    soft(
      async () =>
        ((await supabase.from("profiles").select("id, display_name, username").in("id", authorIds))
          .data ?? []) as { id: string; display_name: string | null; username: string | null }[],
      [] as { id: string; display_name: string | null; username: string | null }[],
    ),
    soft(
      async () =>
        ((await supabase.rpc("xp_for_users", { p_user_ids: authorIds })).data ?? []) as {
          user_id: string;
          xp: number;
        }[],
      [] as { user_id: string; xp: number }[],
    ),
  ]);

  const nameById = new Map(profiles.map((p) => [p.id, p.display_name?.trim() || p.username || null]));
  const xpById = new Map(xp.map((r) => [r.user_id, Number(r.xp) || 0]));

  return comments
    .filter((c) => c.user_id && (c.body ?? "").trim().length > 0)
    .sort((a, b) => (xpById.get(b.user_id as string) ?? 0) - (xpById.get(a.user_id as string) ?? 0))
    .slice(0, VOICE_LIMIT)
    .map((c) => {
      const name = nameById.get(c.user_id as string) ?? "A member";
      const belt = beltForXp(xpById.get(c.user_id as string) ?? 0);
      return {
        id: c.id,
        authorName: name,
        initials: initialsFrom(name),
        // The artboard chip carries no degree numeral — the belt NAME, as
        // ClubFeed's own chip does.
        beltLabel: `${belt.belt.name} Belt`,
        beltKey: belt.belt.key,
        snippet: c.body.replace(/\[seed:[^\]]*\]/g, "").trim().slice(0, 180),
        kind: c.contribution_type ?? "note",
      };
    });
}

/* ── 03 Ticker: entry point ───────────────────────────────────────────────── */

export async function getTickerOverview(
  symbol: string,
  range: RangeKey,
): Promise<TickerOverviewVM | null> {
  const user = await getRequestUser();
  if (!user) return symbol === FIXTURE_SYMBOL ? overviewFixture(range) : null;

  const head = await readHead(symbol);
  if (!head) return null;

  const [series, stance, circle, voices, heat] = await Promise.all([
    readSeries(symbol, range),
    readStance(symbol),
    readCircle(symbol),
    readVoices(symbol),
    readHeat(symbol),
  ]);

  return {
    source: "live",
    head,
    chart: series ? buildChart(series, range) : null,
    ranges: rangeChips(symbol, range),
    stance,
    // The artboard's "WEIGHTED SIGNAL" ring, driven by the one real 0-100 club
    // dial that exists. See omission 2 at the top of this file.
    clubScore: heat,
    stats: statCards(stance, head.clubRank),
    circle,
    voices,
    disclaimer: TRENDING_DISCLAIMER,
  };
}

function statCards(stance: StanceVM | null, rank: number | null): StatCardVM[] {
  const out: StatCardVM[] = [];
  if (stance) {
    out.push({ value: stance.positioned.toLocaleString("en-US"), label: "Total opinions", tone: "text" });
    out.push({
      value: String(stance.mindChanges),
      label: "Minds changed",
      tone: stance.mindChanges > 0 ? "positive" : "text",
    });
  }
  if (rank !== null) out.push({ value: `#${rank}`, label: "Club rank", tone: "accent" });
  return out;
}

/* ── 12 Technicals ────────────────────────────────────────────────────────── */

/**
 * MACD histogram (12/26/9) over real daily closes.
 *
 * This is a deterministic transform of a series the feed reported, not an
 * invented number — the same standing as the price line itself. Fewer than 35
 * closes and there is no 26-period EMA to speak of, so nothing is drawn.
 */
function macdHistogram(closes: number[]): { bars: number[]; crossUp: boolean | null } | null {
  if (closes.length < 35) return null;
  const ema = (values: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const out: number[] = [];
    let prev = values[0];
    for (let i = 0; i < values.length; i++) {
      prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
      out.push(prev);
    }
    return out;
  };
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const macdLine = fast.map((v, i) => v - slow[i]);
  const signal = ema(macdLine, 9);
  const hist = macdLine.map((v, i) => v - signal[i]);
  const bars = hist.slice(-8);
  if (bars.length < 2) return null;
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const crossUp = last >= 0 && prev < 0 ? true : last < 0 && prev >= 0 ? false : null;
  return { bars, crossUp };
}

/**
 * Floor-trader pivots off the latest REPORTED daily bar. Classic, closed-form,
 * and every input is a real high/low/close — nothing here is a guess about
 * where price "should" go.
 */
function pivotLevels(bar: OHLCBar, price: number | null): LevelVM[] {
  const p = (bar.h + bar.l + bar.c) / 3;
  const r1 = 2 * p - bar.l;
  const s1 = 2 * p - bar.h;
  const r2 = p + (bar.h - bar.l);
  const s2 = p - (bar.h - bar.l);
  const levels: LevelVM[] = [
    { label: "R2", value: r2, kind: "resistance" },
    { label: "R1", value: r1, kind: "resistance" },
    { label: "S1", value: s1, kind: "support" },
    { label: "S2", value: s2, kind: "support" },
  ];
  if (price !== null) levels.push({ label: "", value: price, kind: "price" });
  return levels.sort((a, b) => b.value - a.value);
}

/**
 * The gauge's "N of M". Every check below is a field that exists; the mix is
 * the share of them reading bullish, and the gauge prints that share and the
 * count behind it — never a target, never an execution verb.
 */
function mixOf(
  metric: MetricRow | null,
  macd: { crossUp: boolean | null } | null,
): { bullish: number; total: number } {
  const checks: boolean[] = [];
  if (metric?.rsi14 != null) checks.push(metric.rsi14 >= 50);
  if (metric?.ema20_state) checks.push(/above/i.test(metric.ema20_state));
  if (metric?.ema50_state) checks.push(/above/i.test(metric.ema50_state));
  if (metric?.chg_1d != null) checks.push(metric.chg_1d >= 0);
  if (macd?.crossUp !== null && macd?.crossUp !== undefined) checks.push(macd.crossUp);
  return { bullish: checks.filter(Boolean).length, total: checks.length };
}

/**
 * The word the gauge prints, and the ONLY place it is decided — the component
 * derives its colour from the same two thresholds, so the word and the tone can
 * never contradict each other the way "Leaning bullish" in caution-gold did.
 */
export const MIX_BULL_AT = 70;
export const MIX_BEAR_AT = 30;

export function mixWordFor(pct: number): string {
  if (pct >= MIX_BULL_AT) return "Leaning bullish";
  if (pct <= MIX_BEAR_AT) return "Leaning bearish";
  return "Mixed";
}

/** The pinned line on board 12. One sentence, one line at 390px. */
const TECHNICALS_FOOTNOTE = "Pivots off the last reported session · Not investment advice";

/**
 * The artboard's tile is a MARK over a SENTENCE — "▲ 20D" above "Above MA20".
 * The mark names the period, the line beneath names the state, and neither
 * repeats the other.
 */
function stateTiles(metric: MetricRow | null): TechIndicatorVM[] {
  const out: TechIndicatorVM[] = [];
  const state = (raw: string | null, period: string, name: string) => {
    if (!raw) return;
    const above = /above/i.test(raw);
    const below = /below/i.test(raw);
    if (!above && !below) return;
    out.push({
      label: `${above ? "Above" : "Below"} ${name}`,
      value: `${above ? "▲" : "▼"} ${period}`,
      bullish: above,
    });
  };
  state(metric?.ema20_state ?? null, "20D", "EMA20");
  state(metric?.ema50_state ?? null, "50D", "EMA50");
  if (metric?.vol_ratio != null) {
    out.push({
      label: "Rel. volume",
      value: `${metric.vol_ratio.toFixed(1)}x`,
      // Volume is not directional. It is loud or it is quiet.
      bullish: null,
    });
  }
  return out;
}

export async function getTickerTechnicals(symbol: string): Promise<TickerTechnicalsVM | null> {
  const user = await getRequestUser();
  if (!user) return symbol === FIXTURE_SYMBOL ? technicalsFixture() : null;

  const head = await readHead(symbol);
  if (!head) return null;

  const [metric, daily] = await Promise.all([
    readMetric(symbol),
    soft(() => getOHLCBars(symbol, "1d"), null as OHLCBar[] | null),
  ]);

  const closes = (daily ?? []).map((b) => b.c);
  const macd = closes.length ? macdHistogram(closes) : null;
  const mix = mixOf(metric, macd);
  const mixPct = mix.total > 0 ? Math.round((mix.bullish / mix.total) * 100) : null;
  const lastBar = daily && daily.length > 0 ? daily[daily.length - 1] : null;

  return {
    source: "live",
    head,
    mixPct,
    mixWord: mixPct === null ? null : mixWordFor(mixPct),
    mixBullish: mix.bullish,
    mixTotal: mix.total,
    rsi: num(metric?.rsi14),
    macd,
    levels: lastBar ? pivotLevels(lastBar, head.price) : [],
    tiles: stateTiles(metric),
    footnote: TECHNICALS_FOOTNOTE,
  };
}

/* ── 13 Fundamentals ──────────────────────────────────────────────────────── */

function money(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `$${(a / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `$${Math.round(a / 1e9)}B`;
  if (a >= 1e6) return `$${Math.round(a / 1e6)}M`;
  return `$${Math.round(a)}`;
}

const REVENUE_YEARS = 4;
/**
 * The tallest bar's share of the plot. Not 100: the amount label is seated on
 * each bar's top edge, so the leader needs its own line of headroom — which is
 * also exactly where the artboard puts its own tallest reported bar (78%).
 */
const REVENUE_PEAK_PCT = 80;

export async function getTickerFundamentals(symbol: string): Promise<TickerFundamentalsVM | null> {
  const user = await getRequestUser();
  if (!user) return symbol === FIXTURE_SYMBOL ? fundamentalsFixture() : null;

  const head = await readHead(symbol);
  if (!head) return null;

  const [metric, funds] = await Promise.all([
    readMetric(symbol),
    soft(() => getFundamentals(symbol), { quarterly: [], annual: [], dividends: [] }),
  ]);

  // ── revenue: REPORTED years only. There is no consensus feed on this account,
  // so the artboard's hatched "FY26E" bar has nothing behind it and is dropped.
  const years = funds.annual.filter((a) => a.revenue != null).slice(-REVENUE_YEARS);
  const maxRevenue = Math.max(...years.map((a) => a.revenue as number), 0);
  const revenue =
    years.length >= 2 && maxRevenue > 0
      ? {
          bars: years.map((a, i) => ({
            label: a.label,
            value: a.revenue as number,
            pct: Math.max(6, Math.round(((a.revenue as number) / maxRevenue) * REVENUE_PEAK_PCT)),
            valueLabel: money(a.revenue as number),
            lead: i === years.length - 1,
          })),
          yoyPct:
            years.length >= 2 && (years[years.length - 2].revenue as number) > 0
              ? Math.round(
                  (((years[years.length - 1].revenue as number) /
                    (years[years.length - 2].revenue as number)) -
                    1) *
                    100,
                )
              : null,
        }
      : null;

  // ── margins: the last four reported quarters, summed. A trailing-twelve-month
  // margin is the standard read and it survives one seasonal quarter; anything
  // shorter would print a number that swings on a calendar.
  const q = funds.quarterly.slice(-4);
  const sum = (pick: (x: (typeof q)[number]) => number | null): number | null => {
    const vals = q.map(pick).filter((v): v is number => v != null);
    return vals.length === q.length && q.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const rev = sum((x) => x.revenue);
  const margins: MarginDialVM[] = [];
  const pushMargin = (value: number | null, label: string, tone: MarginDialVM["tone"]) => {
    if (value === null || rev === null || rev <= 0) return;
    const pct = Math.round((value / rev) * 100);
    if (pct < 0 || pct > 100) return; // a margin outside 0-100 is not a dial
    margins.push({ label, pct, tone });
  };
  pushMargin(sum((x) => x.grossProfit), "Gross margin", "positive");
  pushMargin(sum((x) => x.operatingIncome), "Op. margin", "gold");
  pushMargin(sum((x) => x.opCashFlow), "Op. cash margin", "info");

  const peers = await readPeers(symbol, metric, funds.annual);

  return {
    source: "live",
    head,
    revenue,
    margins,
    peers,
    footnote: "Reported figures from the latest filings · Trailing twelve months where shown",
  };
}

/**
 * "VALUATION VS PEERS". The artboard prints FORWARD P/E; no consensus EPS
 * exists on this account, so these are TRAILING multiples and the card says so.
 *
 * The peer set is the real one the screener already uses: the largest names
 * sharing this ticker's raw SIC sector string. Two Polygon reads at most, both
 * 24h-cached; if either the ticker's own EPS or every peer's is missing, the
 * card is omitted rather than drawn half-empty.
 */
const PEER_LIMIT = 2;

async function readPeers(
  symbol: string,
  metric: MetricRow | null,
  annual: { label: string; revenue: number | null; eps: number | null }[],
): Promise<{ rows: PeerBarVM[]; sector: string | null } | null> {
  const price = num(metric?.price);
  const eps = num(annual[annual.length - 1]?.eps);
  if (price === null || eps === null || eps <= 0 || !metric?.sector) return null;

  const supabase = await getRequestClient();
  const candidates = await soft(
    async () =>
      ((
        await supabase
          .from("screener_metrics")
          .select("ticker, price, mcap")
          .eq("sector", metric.sector)
          .neq("ticker", symbol)
          .order("mcap", { ascending: false })
          .limit(PEER_LIMIT)
      ).data ?? []) as { ticker: string; price: number | null; mcap: number | null }[],
    [] as { ticker: string; price: number | null; mcap: number | null }[],
  );

  const peerRows = await Promise.all(
    candidates.map(async (c) => {
      if (c.price == null) return null;
      const f = await soft(() => getFundamentals(c.ticker), {
        quarterly: [],
        annual: [],
        dividends: [],
      });
      const peerEps = num(f.annual[f.annual.length - 1]?.eps);
      if (peerEps === null || peerEps <= 0) return null;
      return { ticker: c.ticker.toUpperCase(), pe: c.price / peerEps };
    }),
  );

  const rows = [{ ticker: symbol, pe: price / eps }, ...peerRows.filter((r): r is { ticker: string; pe: number } => r !== null)];
  if (rows.length < 2) return null;

  const max = Math.max(...rows.map((r) => r.pe));
  return {
    rows: rows.map((r) => ({
      ticker: r.ticker,
      pe: r.pe,
      pct: Math.max(8, Math.round((r.pe / max) * 100)),
      self: r.ticker === symbol,
    })),
    sector: metric.sector,
  };
}

/* ── 14 Kai Report ────────────────────────────────────────────────────────── */

interface KaiReportRow {
  id: string;
  ticker: string;
  company_name: string | null;
  sections: KaiReportSections;
  data: { bars?: { t: number; c: number }[] } | null;
  generated_at: string;
}

/**
 * The four sections the report actually writes, in the order the artboard
 * stacks its evidence rows. `risks` is handled separately — it is a list, and
 * the artboard already has a list-shaped panel for it.
 */
const KAI_SECTIONS: { key: keyof KaiReportSections; eyebrow: string; title: string }[] = [
  { key: "the_numbers", eyebrow: "The numbers", title: "What the figures say" },
  { key: "business_plain", eyebrow: "The business", title: "What the company does" },
  { key: "moat", eyebrow: "The moat", title: "What protects it" },
  { key: "thesis", eyebrow: "The thesis", title: "Why it is worth studying" },
];

export async function getTickerKai(symbol: string): Promise<TickerKaiVM | null> {
  const user = await getRequestUser();
  if (!user) return symbol === FIXTURE_SYMBOL ? kaiFixture() : null;

  const head = await readHead(symbol);
  if (!head) return null;

  const supabase = await getRequestClient();
  const row = await soft(
    async () =>
      ((
        await supabase
          .from("kai_reports")
          .select("id, ticker, company_name, sections, data, generated_at")
          .eq("ticker", symbol)
          .eq("status", "published")
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data ?? null) as KaiReportRow | null,
    null as KaiReportRow | null,
  );

  if (!row) {
    return { source: "live", head, report: null, disclaimer: KAI_REPORT_DISCLAIMER };
  }

  const bars = Array.isArray(row.data?.bars) ? row.data.bars : [];
  const series = bars.length >= 8 ? bars.map((b) => b.c) : null;

  const sections: KaiSectionVM[] = KAI_SECTIONS.map((s) => {
    const body = String(row.sections?.[s.key] ?? "").trim();
    return body
      ? {
          key: String(s.key),
          eyebrow: s.eyebrow,
          title: s.title,
          body,
          // The series belongs to the price paragraph and nowhere else.
          series: s.key === "the_numbers" ? series : null,
        }
      : null;
  }).filter((s): s is KaiSectionVM => s !== null);

  return {
    source: "live",
    head,
    report: {
      headline: String(row.sections?.headline ?? "").trim() || `Kai's read on ${symbol}`,
      sectorTagline: String(row.sections?.sector_tagline ?? "").trim() || null,
      generatedLabel: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(row.generated_at)),
      sections,
      risks: Array.isArray(row.sections?.risks)
        ? row.sections.risks.map((r) => String(r).trim()).filter(Boolean)
        : [],
    },
    disclaimer: KAI_REPORT_DISCLAIMER,
  };
}

/* ── the honest empty copy each region uses ───────────────────────────────── */

export const TICKER_EMPTY = {
  chart: "No price history came back for this range.",
  stance: `Nobody has taken a side yet — a split takes ${MIN_POSITIONED_OPINIONS}+ positioned members.`,
  circle: "No Circle is open on this name. Any member can open one.",
  voices: "No takes on this name yet. The first note starts the thread.",
  mix: "No indicator readings are in for this name yet.",
  levels: "No session bar came back, so there are no pivots to draw.",
  revenue: "No reported annual revenue came back for this name.",
  margins: "Standardized statements are not available for this ticker.",
  peers: "Not enough peer earnings to compare a multiple against.",
  kai: "No Kai report has been published for this name yet.",
} as const;

/* ── fixtures branch (anonymous, artboard symbol only) ────────────────────── */

/**
 * The anonymous view.
 *
 * As on Discover, the shared club fixtures carry nothing these boards need, so
 * this branch is the ARTBOARD's own content for its own symbol. It exists so
 * the design proof is complete and so an anonymous visitor sees a real screen;
 * it is unreachable the moment a session exists, and unreachable for any symbol
 * other than the one the artboards drew.
 */
const ART_HEAD: TickerHeadVM = {
  symbol: "NVDA",
  name: "NVIDIA",
  price: 173.42,
  changePct: 4.72,
  clubRank: 1,
  watchers: 826,
  onWatchlist: true,
};

/** The artboard's own drawn polyline, read back out of the mockup SVG path. */
const ART_CHART_Y = [108, 96, 102, 84, 90, 68, 76, 56, 64, 40, 48, 28, 34, 12];

function overviewFixture(range: RangeKey): TickerOverviewVM {
  const pts = ART_CHART_Y.map((y, i) => ({
    x: (i / (ART_CHART_Y.length - 1)) * CHART_W,
    y,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y}`).join(" ");
  return {
    source: "fixtures",
    head: ART_HEAD,
    chart: {
      path,
      areaPath: `${path} L${CHART_W} ${CHART_H} L0 ${CHART_H} Z`,
      rising: true,
      axis: ["9:30 AM", "12:00 PM", "2:30 PM", "4:00 PM"],
    },
    ranges: rangeChips("NVDA", range),
    stance: { bullPct: 71, bearPct: 21, neutralPct: 8, positioned: 4312, mindChanges: 14 },
    clubScore: 78,
    stats: [
      { value: "4,312", label: "Total opinions", tone: "text" },
      { value: "14", label: "Minds changed", tone: "positive" },
      { value: "#1", label: "Club rank", tone: "accent" },
    ],
    circle: {
      slug: "nvda-earnings",
      title: "NVDA Earnings",
      ticker: "NVDA",
      clock: "7 days left",
      members: 1804,
    },
    voices: [
      {
        id: "v1",
        authorName: "Tanya Reyes",
        initials: "TR",
        beltLabel: "Black Belt",
        beltKey: "black",
        snippet:
          "Data-center revenue is doing the heavy lifting again — the gaming line barely moved this quarter.",
        kind: "thesis",
      },
      {
        id: "v2",
        authorName: "Kwame Diallo",
        initials: "KD",
        // The ladder is white / yellow / blue / purple / black — there is no
        // brown belt in this club, however familiar the word is elsewhere.
        beltLabel: "Purple Belt",
        beltKey: "purple",
        snippet: "Watching supply commentary more than the headline number going into the print.",
        kind: "risk",
      },
    ],
    disclaimer: TRENDING_DISCLAIMER,
  };
}

function technicalsFixture(): TickerTechnicalsVM {
  return {
    source: "fixtures",
    head: ART_HEAD,
    mixPct: 67,
    // The artboard reads "8 of 12" and calls it BUY. 67% is not a lean by the
    // thresholds above, so the fixture prints what the rule prints.
    mixWord: mixWordFor(67),
    mixBullish: 4,
    mixTotal: 6,
    rsi: 62,
    // The artboard's own eight histogram bars, as heights → signed values.
    macd: { bars: [-30, -20, -12, -8, 22, 40, 58, 76], crossUp: true },
    levels: [
      { label: "R2", value: 196, kind: "resistance" },
      { label: "R1", value: 184, kind: "resistance" },
      { label: "", value: 173.42, kind: "price" },
      { label: "S1", value: 166, kind: "support" },
      { label: "S2", value: 158, kind: "support" },
    ],
    tiles: [
      { label: "Above EMA20", value: "▲ 20D", bullish: true },
      { label: "Above EMA50", value: "▲ 50D", bullish: true },
      { label: "Rel. volume", value: "1.4x", bullish: null },
    ],
    footnote: TECHNICALS_FOOTNOTE,
  };
}

function fundamentalsFixture(): TickerFundamentalsVM {
  const years = [
    { label: "FY22", value: 27_000_000_000 },
    { label: "FY23", value: 61_000_000_000 },
    { label: "FY24", value: 130_000_000_000 },
  ];
  const max = Math.max(...years.map((y) => y.value));
  return {
    source: "fixtures",
    head: ART_HEAD,
    revenue: {
      bars: years.map((y, i) => ({
        label: y.label,
        value: y.value,
        pct: Math.max(6, Math.round((y.value / max) * REVENUE_PEAK_PCT)),
        valueLabel: money(y.value),
        lead: i === years.length - 1,
      })),
      yoyPct: 114,
    },
    margins: [
      { label: "Gross margin", pct: 75, tone: "positive" },
      { label: "Op. margin", pct: 62, tone: "gold" },
      { label: "Op. cash margin", pct: 49, tone: "info" },
    ],
    peers: {
      rows: [
        { ticker: "NVDA", pe: 34, pct: 83, self: true },
        { ticker: "AMD", pe: 41, pct: 100, self: false },
        { ticker: "AVGO", pe: 31, pct: 76, self: false },
      ],
      sector: "SEMICONDUCTORS & RELATED DEVICES",
    },
    footnote: "Reported figures from the latest filings · Trailing twelve months where shown",
  };
}

function kaiFixture(): TickerKaiVM {
  return {
    source: "fixtures",
    head: ART_HEAD,
    report: {
      headline: "Demand signals continue outrunning supply.",
      sectorTagline: "Semiconductors · accelerated computing",
      generatedLabel: "Jul 23, 2026",
      sections: [
        {
          key: "the_numbers",
          eyebrow: "The numbers",
          title: "What the figures say",
          body: "Revenue has roughly doubled in each of the last two reported years, and the margin line has widened alongside it rather than being spent on growth. That combination — a top line compounding while the share kept per dollar of sales rises — is rare, and it is the single most important thing on this page.",
          series: [3, 6, 5, 11, 9, 16, 14, 21, 19, 26],
        },
        {
          key: "moat",
          eyebrow: "The moat",
          title: "What protects it",
          body: "The hardware is only half of it. A decade of developer tooling means the switching cost for a customer is not a new chip, it is a rewritten stack.",
          series: null,
        },
      ],
      risks: [
        "Concentration: the largest customers account for a large share of revenue.",
        "Supply: capacity is booked far ahead, so a delay moves a whole quarter.",
        "Competition: every large buyer is funding an in-house alternative.",
      ],
    },
    disclaimer: KAI_REPORT_DISCLAIMER,
  };
}
