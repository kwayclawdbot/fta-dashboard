/**
 * Trade Alerts (LANE C6) — shared types + pure helpers.
 *
 * Split from any server-only code so both the evaluation crons (Node) and the
 * client hub / contextual "Set alert" buttons import the SAME rule shapes and
 * label/condition logic. Everything here is education-first: rules describe
 * conditions to WATCH, never instructions to trade.
 */

export type AlertKind =
  | "price_cross"
  | "pct_move"
  | "vol_surge"
  | "rsi_cross"
  | "ema_cross"
  | "w52_break"
  | "preset_match"
  // R4 — Kai Watch NL-layer kinds (see migration 131). Both are honest proxies,
  // never thesis-omniscience (owner decision 7).
  | "sentiment_velocity"
  | "news_event";

export type AlertSurface = "screener" | "watchlist" | "research" | "strategy" | "manual";

export type AlertDirection = "long" | "short" | "watch";
export type AlertSource = "kai_morning" | "kai_intraday";
export type DeliveryMode = "push" | "digest" | "none";

/** Per-kind params (stored as jsonb; typed here for the builder + engine). */
export interface AlertParams {
  // price_cross
  op?: "above" | "below";
  price?: number;
  // pct_move
  pct?: number;
  window?: "1d" | "5d";
  // vol_surge
  ratio?: number;
  // rsi_cross
  level?: number; // e.g. 30 / 70
  // ema_cross
  ema?: 20 | 50;
  side?: "above" | "below";
  // w52_break
  edge?: "high" | "low";
  // preset_match
  presetId?: string;
  presetLabel?: string;
  // sentiment_velocity — the club's net community sentiment swings this many net
  // votes (delta) in the given direction over a rolling window of days.
  sentiment?: "bullish" | "bearish";
  delta?: number; // net-vote swing that trips it (default 5)
  days?: number; // rolling window (default 7)
  // news_event — a fresh ticker-tagged newsroom event, optionally paired with a
  // notable daily move (move omitted = any material event for the ticker).
  move?: number; // |daily %| that must accompany the event (optional)
}

export interface AlertRule {
  id: string;
  user_id: string;
  kind: AlertKind;
  ticker: string | null;
  params: AlertParams;
  label: string;
  active: boolean;
  digest: boolean;
  surface: AlertSurface;
  state: Record<string, unknown>;
  last_fired_at: string | null;
  created_at: string;
}

export interface TradeAlert {
  id: string;
  ticker: string;
  direction: AlertDirection;
  setup_label: string | null;
  entry: number | null;
  levels: Record<string, number | null>;
  targets: { price: number; label?: string }[];
  narrative: string | null;
  chart_url: string | null;
  source: AlertSource;
  snapshot_price: number | null;
  issued_at: string;
  created_at: string;
}

export interface AlertEvent {
  id: string;
  user_id: string;
  rule_id: string | null;
  alert_id: string | null;
  kind: "rule" | "broadcast";
  ticker: string;
  payload: {
    message?: string;
    direction?: AlertDirection | string;
    setup_label?: string | null;
    snapshot_price?: number | null;
    condition?: string;
    delayed?: boolean;
    source?: string;
  };
  delivered: DeliveryMode;
  digest_sent_at: string | null;
  fired_at: string;
}

export interface StrategyProfile {
  timeframe: "day" | "swing" | "position" | "longterm";
  setup_prefs: string[];
  risk_posture: "conservative" | "balanced" | "aggressive";
}

export interface AlertPrefs {
  briefing_enabled: boolean | null;
  digest: boolean;
  daily_cap: number;
  quiet_hours: boolean;
}

export const MAX_ACTIVE_RULES = 20;

/** Kinds evaluated by the NIGHTLY post-close cron (screener_metrics/history). */
export const NIGHTLY_KINDS: AlertKind[] = [
  "rsi_cross",
  "ema_cross",
  "w52_break",
  "preset_match",
  "pct_move",
];

/** Kinds evaluated by the INTRADAY cron (one full-market snapshot, delayed). */
export const INTRADAY_KINDS: AlertKind[] = ["price_cross", "pct_move", "vol_surge"];

/** R4 Kai-Watch kinds evaluated NIGHTLY off community/newsroom data (not price). */
export const KAI_WATCH_KINDS: AlertKind[] = ["sentiment_velocity", "news_event"];

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Plain-English label for a rule (shown in the hub + push body). */
export function ruleLabel(
  kind: AlertKind,
  ticker: string | null,
  p: AlertParams
): string {
  const t = ticker ? ticker.toUpperCase() : "";
  switch (kind) {
    case "price_cross":
      return `${t} crosses ${p.op === "below" ? "below" : "above"} $${num(p.price)?.toLocaleString() ?? "—"}`;
    case "pct_move":
      return `${t} moves ${p.pct ?? 5}%+ in a ${p.window === "5d" ? "week" : "day"}`;
    case "vol_surge":
      return `${t} volume ${p.ratio ?? 3}×+ its average`;
    case "rsi_cross":
      return `${t} RSI crosses ${p.op === "above" ? "above" : "below"} ${p.level ?? 30}`;
    case "ema_cross":
      return `${t} closes ${p.side === "below" ? "below" : "above"} its ${p.ema ?? 20}-day average`;
    case "w52_break":
      return `${t} reaches a new 52-week ${p.edge === "low" ? "low" : "high"}`;
    case "preset_match":
      return `New names in "${p.presetLabel ?? "screen"}"`;
    case "sentiment_velocity":
      return `The club turns ${p.sentiment === "bearish" ? "more bearish" : "more bullish"} on ${t}`;
    case "news_event":
      return p.move
        ? `Major news on ${t} with a ${p.move}%+ move`
        : `Major news breaks on ${t}`;
    default:
      return t || "Alert";
  }
}

/** Metrics row shape the engine reads from screener_metrics. */
export interface MetricsRow {
  ticker: string;
  price: number | null;
  chg_1d: number | null;
  chg_5d: number | null;
  vol_ratio: number | null;
  rsi14: number | null;
  ema20_state: string | null;
  ema50_state: string | null;
  dist_52w_high: number | null;
  dist_52w_low: number | null;
}

/** Live snapshot row shape (intraday) — price + intraday % + volume ratio. */
export interface SnapRow {
  price: number | null;
  changePercent: number | null;
  volRatio: number | null;
}

/**
 * Evaluate a rule against the latest metrics (nightly). Returns a fired message
 * or null. `prevState` carries the rule's bookkeeping (e.g. preset last set) and
 * `newState` is written back by the caller.
 */
export function evalNightly(
  rule: Pick<AlertRule, "kind" | "ticker" | "params" | "state">,
  m: MetricsRow | undefined
): { message: string; condition: string } | null {
  const p = rule.params || {};
  switch (rule.kind) {
    case "rsi_cross": {
      const rsi = m?.rsi14;
      if (rsi == null) return null;
      const level = p.level ?? 30;
      const above = p.op === "above";
      if (above ? rsi >= level : rsi <= level) {
        return {
          message: `${rule.ticker} RSI is ${rsi.toFixed(0)} (${above ? "above" : "below"} ${level})`,
          condition: `rsi ${above ? "≥" : "≤"} ${level}`,
        };
      }
      return null;
    }
    case "ema_cross": {
      const state = p.ema === 50 ? m?.ema50_state : m?.ema20_state;
      if (!state || state === "unknown") return null;
      const wantAbove = p.side !== "below";
      if ((wantAbove && state === "above") || (!wantAbove && state === "below")) {
        return {
          message: `${rule.ticker} closed ${state} its ${p.ema ?? 20}-day average`,
          condition: `ema${p.ema ?? 20} ${state}`,
        };
      }
      return null;
    }
    case "w52_break": {
      const edge = p.edge === "low" ? m?.dist_52w_low : m?.dist_52w_high;
      if (edge == null) return null;
      // within 0.5% of the 52w extreme counts as a break/new-high touch
      if (Math.abs(edge) <= 0.5) {
        return {
          message: `${rule.ticker} is at a new 52-week ${p.edge === "low" ? "low" : "high"}`,
          condition: `52w ${p.edge ?? "high"}`,
        };
      }
      return null;
    }
    case "pct_move": {
      const chg = p.window === "5d" ? m?.chg_5d : m?.chg_1d;
      if (chg == null) return null;
      const th = p.pct ?? 5;
      if (Math.abs(chg) >= th) {
        return {
          message: `${rule.ticker} moved ${chg > 0 ? "+" : ""}${chg.toFixed(1)}% (${p.window === "5d" ? "5-day" : "today"})`,
          condition: `|chg| ≥ ${th}%`,
        };
      }
      return null;
    }
    default:
      return null;
  }
}

/** Evaluate an intraday rule against a live (delayed ~15m) snapshot row. */
export function evalIntraday(
  rule: Pick<AlertRule, "kind" | "ticker" | "params">,
  s: SnapRow | undefined
): { message: string; condition: string } | null {
  const p = rule.params || {};
  switch (rule.kind) {
    case "price_cross": {
      const px = s?.price;
      const target = num(p.price);
      if (px == null || target == null) return null;
      const above = p.op !== "below";
      if (above ? px >= target : px <= target) {
        return {
          message: `${rule.ticker} is $${px.toFixed(2)} — ${above ? "above" : "below"} $${target}`,
          condition: `price ${above ? "≥" : "≤"} ${target}`,
        };
      }
      return null;
    }
    case "pct_move": {
      const chg = s?.changePercent;
      if (chg == null) return null;
      const th = p.pct ?? 5;
      if (Math.abs(chg) >= th) {
        return {
          message: `${rule.ticker} is ${chg > 0 ? "+" : ""}${chg.toFixed(1)}% on the day`,
          condition: `|chg| ≥ ${th}%`,
        };
      }
      return null;
    }
    case "vol_surge": {
      const vr = s?.volRatio;
      if (vr == null) return null;
      const th = p.ratio ?? 3;
      if (vr >= th) {
        return {
          message: `${rule.ticker} volume is ${vr.toFixed(1)}× its average`,
          condition: `vol ≥ ${th}×`,
        };
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Evaluate a sentiment_velocity rule. `curNet` is the ticker's current
 * ticker_like_counts.net; `baseNet` is the rule's stored baseline (state.base_net).
 * Fires when the net community stance has swung by the rule's delta in the wanted
 * direction. Returns the fire payload + the new baseline the caller should store.
 */
export function evalSentimentVelocity(
  rule: Pick<AlertRule, "ticker" | "params" | "state">,
  curNet: number | null,
  baseNet: number | null
): { message: string; condition: string; newBase: number } | null {
  if (curNet == null) return null;
  const p = rule.params || {};
  const delta = Math.max(1, p.delta ?? 5);
  const wantBull = p.sentiment !== "bearish";
  // First sighting: just seed the baseline (no fire).
  if (baseNet == null) return null;
  const swing = curNet - baseNet;
  const tripped = wantBull ? swing >= delta : swing <= -delta;
  if (!tripped) return null;
  return {
    message: `The club has turned ${wantBull ? "more bullish" : "more bearish"} on ${rule.ticker} — net community sentiment moved ${swing > 0 ? "+" : ""}${swing}`,
    condition: `net sentiment ${wantBull ? "+" : "−"}${delta} in ${p.days ?? 7}d`,
    newBase: curNet,
  };
}

/**
 * Evaluate a news_event rule. `hasFreshEvent` = a ticker_event published since the
 * rule last fired (or in the lookback window); `chg1d` = today's % move. Fires when
 * a fresh material event lands (and, if the rule sets `move`, the day's move clears
 * it). Honest proxy for "thesis-changing news" — a heads-up, never a verdict.
 */
export function evalNewsEvent(
  rule: Pick<AlertRule, "ticker" | "params">,
  hasFreshEvent: boolean,
  chg1d: number | null
): { message: string; condition: string } | null {
  if (!hasFreshEvent) return null;
  const p = rule.params || {};
  if (p.move != null) {
    if (chg1d == null || Math.abs(chg1d) < p.move) return null;
    return {
      message: `${rule.ticker} has fresh news and moved ${chg1d > 0 ? "+" : ""}${chg1d.toFixed(1)}% today — worth a look`,
      condition: `news + |chg| ≥ ${p.move}%`,
    };
  }
  return {
    message: `${rule.ticker} has fresh news worth a look`,
    condition: `news event`,
  };
}

/**
 * Suggested rules seeded from a strategy profile. Every suggestion is a
 * universe-wide preset_match (a nightly diff of an existing screener preset), so
 * a member with no watchlist yet still gets working alerts the moment they build
 * a profile — no ticker required. Education-first framing throughout.
 */
export interface SuggestedRule {
  key: string;
  presetId: string;
  presetLabel: string;
  label: string;
  reason: string;
}

const SETUP_TO_PRESET: Record<string, { id: string; label: string; reason: string }> = {
  breakout: {
    id: "big-brands-new-highs",
    label: "Big brands at new highs",
    reason: "Breakout traders watch large names clearing prior highs.",
  },
  pullback: {
    id: "steady-climbers",
    label: "Steady climbers",
    reason: "Pullback setups look for durable uptrends to buy dips in.",
  },
  oversold: {
    id: "oversold-quality",
    label: "Oversold quality",
    reason: "An oversold reading can mark a stretched, mean-reverting move.",
  },
  momentum: {
    id: "momentum-movers",
    label: "Momentum movers",
    reason: "Momentum shows up first as strength and unusual volume.",
  },
  value: {
    id: "oversold-quality",
    label: "Oversold quality",
    reason: "Value-leaning members watch quality names that get cheap.",
  },
};

export function suggestedRulesFor(sp: StrategyProfile): SuggestedRule[] {
  const out: SuggestedRule[] = [];
  const seen = new Set<string>();
  for (const setup of sp.setup_prefs || []) {
    const p = SETUP_TO_PRESET[setup];
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({
      key: setup,
      presetId: p.id,
      presetLabel: p.label,
      label: `New names in "${p.label}"`,
      reason: p.reason,
    });
  }
  return out;
}

export const SETUP_OPTIONS: { id: string; label: string; blurb: string }[] = [
  { id: "breakout", label: "Breakouts", blurb: "Names clearing new highs" },
  { id: "pullback", label: "Pullbacks", blurb: "Dips toward a rising trend" },
  { id: "oversold", label: "Oversold bounces", blurb: "Stretched names snapping back" },
  { id: "momentum", label: "Momentum", blurb: "Volume + strength moves" },
  { id: "value", label: "Value", blurb: "Quality names getting cheap" },
];

export const TIMEFRAME_OPTIONS: { id: StrategyProfile["timeframe"]; label: string }[] = [
  { id: "day", label: "Day trading" },
  { id: "swing", label: "Swing (days–weeks)" },
  { id: "position", label: "Position (weeks–months)" },
  { id: "longterm", label: "Long-term investing" },
];

export const RISK_OPTIONS: { id: StrategyProfile["risk_posture"]; label: string }[] = [
  { id: "conservative", label: "Conservative" },
  { id: "balanced", label: "Balanced" },
  { id: "aggressive", label: "Aggressive" },
];

/* ============================================================================
 * STRATEGY PLAYS — the watchlist-driven, no-LLM front door to the rules engine.
 *
 * A member picks a ticker off THEIR watchlist and attaches a PLAY. Each play is
 * a curated strategy that maps 1:1 onto an EXISTING alert kind (migration 125),
 * so it is a fully DETERMINISTIC check computed from the nightly screener
 * metrics / price data — no language model, no new migration, and it is already
 * evaluated by the existing personalized-rules crons the moment it is saved:
 *   • nightly  cron (/api/cron/evaluate-alerts)          → w52_break, rsi_cross, ema_cross
 *   • intraday cron (/api/cron/evaluate-alerts-intraday) → vol_surge
 *
 * The Kai Watch NL path (credits-dependent) is untouched; this is the front door
 * that works WITHOUT any live LLM. Every play is framed as analysis to study.
 * ==========================================================================*/
export type PlayId = "breakout" | "oversold" | "momentum" | "pullback";

export interface StrategyPlay {
  id: PlayId;
  name: string;
  tagline: string; // one plain-language line for the play object
  /** The honest, computable check — "we alert you when {ticker} …". */
  watchLine: string;
  kind: AlertKind;
  params: AlertParams;
  cadence: "nightly" | "intraday";
}

export const STRATEGY_PLAYS: StrategyPlay[] = [
  {
    id: "breakout",
    name: "Breakout watch",
    tagline: "Presses a fresh 52-week high",
    watchLine: "reaches a new 52-week high",
    kind: "w52_break",
    params: { edge: "high" },
    cadence: "nightly",
  },
  {
    id: "oversold",
    name: "Oversold bounce",
    tagline: "Gets stretched to the downside",
    watchLine: "RSI drops below 30 (oversold)",
    kind: "rsi_cross",
    params: { op: "below", level: 30 },
    cadence: "nightly",
  },
  {
    id: "momentum",
    name: "Momentum surge",
    tagline: "Trades on unusually heavy volume",
    watchLine: "trades on 3×+ its average volume",
    kind: "vol_surge",
    params: { ratio: 3 },
    cadence: "intraday",
  },
  {
    id: "pullback",
    name: "Pullback to trend",
    tagline: "Holds its rising 20-day trend line",
    watchLine: "keeps closing above its 20-day average",
    kind: "ema_cross",
    params: { ema: 20, side: "above" },
    cadence: "nightly",
  },
];

export function getPlay(id: string): StrategyPlay | undefined {
  return STRATEGY_PLAYS.find((p) => p.id === id);
}

/* ============================================================================
 * SAMPLE ALERT — a single, clearly-labelled example of what a Kai briefing
 * alert looks like, built from REAL nightly screener data (never invented
 * numbers). Server-constructed and rendered with a SAMPLE badge; it is never
 * written to the DB, so it is automatically excluded from the track-record
 * ledger and never fans out to anyone.
 * ==========================================================================*/
export interface SampleLevels {
  entryLow: number;
  entryHigh: number;
  targets: { price: number; label: string }[];
  invalidation: number;
  pivot: number; // the breakout level being pressed
  shelfLow: number; // the recent consolidation floor
}

export interface SampleAlert {
  ticker: string;
  name: string;
  price: number;
  direction: "long";
  setup_label: string;
  tier: string;
  thesis: string; // plain-language setup thesis
  kaiRead: string; // the "Kai's read" framing line
  levels: SampleLevels;
  rsi: number | null;
  issued_at: string;
}

interface SampleMetricsInput {
  ticker: string;
  name: string | null;
  price: number | null;
  rsi14: number | null;
  dist_52w_high: number | null;
}

/**
 * Build the sample alert from a metrics row + the ticker's recent daily closes
 * (most-recent-first). Levels are derived from real price structure: the pressed
 * 52-week-high pivot, the recent shelf low, and a measured-move projection.
 */
export function buildSampleAlert(
  m: SampleMetricsInput,
  recentCloses: number[]
): SampleAlert | null {
  const price = m.price;
  if (price == null || recentCloses.length < 5) return null;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const round0 = (n: number) => Math.round(n);

  const last10 = recentCloses.slice(0, 10);
  const shelfLow = Math.min(...last10);
  const recentMax = Math.max(...recentCloses);
  const hiFromDist =
    m.dist_52w_high != null ? price / (1 + m.dist_52w_high / 100) : null;
  const pivot = r2(Math.max(recentMax, hiFromDist ?? 0, price));
  const range = Math.max(pivot - shelfLow, price * 0.04); // measured-move height

  const entryLow = r2(pivot * 0.996);
  const entryHigh = r2(pivot * 1.006);
  const t1 = round0(pivot + range);
  const t2 = round0(pivot + range * 1.7);
  const invalidation = round0(shelfLow * 0.995);

  const shortName = (m.name || m.ticker).replace(/,?\s+(Inc\.?|Corp\.?|Corporation|Common Stock|Class [A-Z]).*$/i, "").trim() || m.ticker;
  const rsi = m.rsi14 != null ? Math.round(m.rsi14) : null;

  const thesis =
    `${shortName} has been coiling near $${round0(shelfLow)}–$${round0(pivot)} and is now pressing the top of that range on strong buying. ` +
    `Price is holding above its 20- and 50-day averages${rsi != null ? `, momentum is firm (RSI ${rsi})` : ""}, ` +
    `and a decisive close above the $${pivot} pivot would open room toward the measured-move targets.`;

  const kaiRead =
    `Kai's read: treat this as a setup to study, not a trade to place. The idea is live only while ${m.ticker} holds the entry zone; ` +
    `a close back under $${invalidation} says the base failed and the read was wrong.`;

  return {
    ticker: m.ticker,
    name: shortName,
    price: r2(price),
    direction: "long",
    setup_label: "Breakout continuation",
    tier: "Tier 1 · Trend continuation",
    thesis,
    kaiRead,
    levels: {
      entryLow,
      entryHigh,
      targets: [
        { price: t1, label: "T1 · measured move" },
        { price: t2, label: "T2 · extension" },
      ],
      invalidation,
      pivot,
      shelfLow: r2(shelfLow),
    },
    rsi,
    issued_at: new Date().toISOString(),
  };
}
