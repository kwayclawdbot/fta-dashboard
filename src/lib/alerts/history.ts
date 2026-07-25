/**
 * Trade-alert TRACK RECORD — peak-favorable-move outcome tracking.
 *
 * The house metric is "peak is the win": an alert is graded by the BEST move in
 * its favor after it was issued, not by where the stock sits now. For a long/
 * watch that is the highest close on or after the issue date; for a short it is
 * the lowest close. Computed purely from the already-stored screener_history
 * daily closes (no API load), so it is deterministic and needs no live LLM.
 *
 * Pure module — safe to import from server components. The sample alert is never
 * in the DB, so it is inherently excluded from every stat here.
 */

export interface AlertHistoryInput {
  id: string;
  ticker: string;
  direction: "long" | "short" | "watch";
  setup_label: string | null;
  snapshot_price: number | null;
  issued_at: string;
  source: string;
}

export interface DailyClose {
  ticker: string;
  as_of: string; // YYYY-MM-DD
  close: number;
}

export interface AlertOutcome {
  id: string;
  ticker: string;
  direction: "long" | "short" | "watch";
  setup_label: string | null;
  snapshot_price: number;
  issued_at: string;
  source: string;
  /** Favorable-direction extreme close on or after the issue date. */
  peakPrice: number | null;
  /** Peak favorable move %, signed to the direction (the house metric). */
  peakPct: number | null;
  /** Calendar days from issue to the peak close. */
  daysToPeak: number | null;
  /** Most recent close (context only — never the grade). */
  lastPrice: number | null;
  lastPct: number | null;
}

const dayMs = 86_400_000;

/** Group daily closes by ticker, ascending by date. */
export function indexCloses(rows: DailyClose[]): Map<string, DailyClose[]> {
  const byTicker = new Map<string, DailyClose[]>();
  for (const r of rows) {
    if (r.close == null) continue;
    const arr = byTicker.get(r.ticker) || [];
    arr.push(r);
    byTicker.set(r.ticker, arr);
  }
  for (const arr of byTicker.values()) arr.sort((a, b) => a.as_of.localeCompare(b.as_of));
  return byTicker;
}

/** Compute one alert's peak-favorable outcome from its post-issue closes. */
export function computeOutcome(
  alert: AlertHistoryInput,
  closesForTicker: DailyClose[] | undefined
): AlertOutcome | null {
  const snap = alert.snapshot_price;
  if (snap == null || snap <= 0) return null;
  const issueDay = alert.issued_at.slice(0, 10);
  const isShort = alert.direction === "short";

  const post = (closesForTicker || []).filter((c) => c.as_of >= issueDay);
  let peakPrice: number | null = null;
  let peakDay: string | null = null;
  let lastPrice: number | null = null;

  for (const c of post) {
    lastPrice = c.close;
    if (peakPrice == null) {
      peakPrice = c.close;
      peakDay = c.as_of;
    } else if (isShort ? c.close < peakPrice : c.close > peakPrice) {
      peakPrice = c.close;
      peakDay = c.as_of;
    }
  }

  const favor = (p: number) => (isShort ? (snap - p) / snap : (p - snap) / snap) * 100;
  const peakPct = peakPrice != null ? favor(peakPrice) : null;
  const lastPct = lastPrice != null ? favor(lastPrice) : null;
  const daysToPeak =
    peakDay != null
      ? Math.max(0, Math.round((Date.parse(peakDay) - Date.parse(issueDay)) / dayMs))
      : null;

  return {
    id: alert.id,
    ticker: alert.ticker,
    direction: alert.direction,
    setup_label: alert.setup_label,
    snapshot_price: snap,
    issued_at: alert.issued_at,
    source: alert.source,
    peakPrice,
    peakPct,
    daysToPeak,
    lastPrice,
    lastPct,
  };
}

export interface TrackRecord {
  outcomes: AlertOutcome[]; // chronological (newest first)
  winners: AlertOutcome[]; // top 5 by peak favorable move
  losers: AlertOutcome[]; // bottom 5 by peak favorable move
  total: number;
  graded: number; // outcomes with a computable peak
  avgPeak: number | null; // mean peak favorable %
  hitRate: number | null; // share whose peak favorable move cleared +5%
  bestPeak: number | null;
}

const HIT_THRESHOLD = 5; // "worked" = peak favorable move >= +5%

/** Build the full track record from raw alerts + closes. */
export function buildTrackRecord(
  alerts: AlertHistoryInput[],
  closeRows: DailyClose[]
): TrackRecord {
  const byTicker = indexCloses(closeRows);
  const outcomes: AlertOutcome[] = [];
  for (const a of alerts) {
    const o = computeOutcome(a, byTicker.get(a.ticker));
    if (o) outcomes.push(o);
  }
  outcomes.sort((a, b) => b.issued_at.localeCompare(a.issued_at));

  const graded = outcomes.filter((o) => o.peakPct != null);
  const byPeakDesc = [...graded].sort((a, b) => (b.peakPct ?? 0) - (a.peakPct ?? 0));
  const winners = byPeakDesc.slice(0, 5);
  const losers = byPeakDesc.slice(-5).reverse();

  const avgPeak =
    graded.length > 0
      ? graded.reduce((s, o) => s + (o.peakPct ?? 0), 0) / graded.length
      : null;
  const hitRate =
    graded.length > 0
      ? graded.filter((o) => (o.peakPct ?? 0) >= HIT_THRESHOLD).length / graded.length
      : null;
  const bestPeak = graded.length > 0 ? (byPeakDesc[0].peakPct ?? null) : null;

  return {
    outcomes,
    winners,
    losers,
    total: outcomes.length,
    graded: graded.length,
    avgPeak,
    hitRate,
    bestPeak,
  };
}
