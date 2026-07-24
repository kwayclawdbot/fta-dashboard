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
  | "preset_match";

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

/** Suggested rules seeded from a strategy profile (education-first framing). */
export function suggestedRulesFor(sp: StrategyProfile): {
  kind: AlertKind;
  params: AlertParams;
  label: string;
  reason: string;
}[] {
  const out: { kind: AlertKind; params: AlertParams; label: string; reason: string }[] = [];
  const setups = sp.setup_prefs || [];

  if (setups.includes("breakout")) {
    out.push({
      kind: "w52_break",
      params: { edge: "high" },
      label: "A watchlist name reaches a new 52-week high",
      reason: "Breakout traders watch for names clearing prior highs.",
    });
  }
  if (setups.includes("pullback")) {
    out.push({
      kind: "ema_cross",
      params: { ema: 20, side: "below" },
      label: "A name pulls back below its 20-day average",
      reason: "Pullback setups look for a dip toward a rising trend.",
    });
  }
  if (setups.includes("oversold")) {
    out.push({
      kind: "rsi_cross",
      params: { op: "below", level: 30 },
      label: "A name becomes oversold (RSI under 30)",
      reason: "An oversold reading can mark a stretched, mean-reverting move.",
    });
  }
  if (setups.includes("momentum")) {
    out.push({
      kind: "vol_surge",
      params: { ratio: 3 },
      label: "A name trades on 3×+ its average volume",
      reason: "Momentum shows up first as unusual volume.",
    });
  }
  if (setups.includes("value")) {
    out.push({
      kind: "preset_match",
      params: { presetId: "oversold-quality", presetLabel: "Oversold quality" },
      label: 'New names enter the "Oversold quality" screen',
      reason: "Value-leaning members watch quality names that get cheap.",
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
