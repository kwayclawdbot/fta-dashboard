/**
 * KAI WATCH — deterministic watch-state machine (LANE A, zero-LLM).
 *
 * The evaluate-alerts crons already compute the underlying condition for every
 * active rule each cycle and then DISCARD everything that didn't fully trigger.
 * This module turns that discarded signal into a state: instead of only knowing
 * "fired / didn't fire", we derive HOW CLOSE the condition is — % distance to a
 * level, fraction of a move/volume threshold reached, RSI points from a line —
 * and map it onto a small, honest state machine:
 *
 *     watching → building → near_trigger → triggered | cooled | invalidated
 *                                        (+ earnings_wait when derivable)
 *
 * Everything here is a PURE function of the inputs + the previous state, with
 * every threshold a named constant — no language model, no market calls, fully
 * unit-testable. The crons call `deriveWatchState`, persist a transition ONLY
 * when the state string changes (`shouldEmitTransition`), and hand the
 * feed-worthy transitions to the templated copy + the cadence-capped emitter.
 *
 * Copy templates are plain-language per KAI-WATCH-UX ("Still watching NVDA —
 * volume is building, but price hasn't cleared resistance yet"). Kai LLM polish
 * is a later, optional layer; this file never needs credits.
 */

import type { AlertKind, AlertParams } from "./types.ts";

/* ── the states ──────────────────────────────────────────────────────────── */

export type WatchState =
  | "watching" // baseline — condition is far off / normal
  | "building" // measurably closer than baseline
  | "near_trigger" // right at the doorstep
  | "triggered" // condition met (the real alert fires separately)
  | "cooled" // retreated after having built up
  | "invalidated" // collapsed hard after nearly triggering
  | "earnings_wait"; // parked pending a scheduled event

export const WATCH_STATES: WatchState[] = [
  "watching",
  "building",
  "near_trigger",
  "triggered",
  "cooled",
  "invalidated",
  "earnings_wait",
];

/** The approaching-ladder rank, used to detect a RETREAT (rank dropped). */
const APPROACH_RANK: Record<string, number> = {
  watching: 0,
  building: 1,
  near_trigger: 2,
  triggered: 3,
};

/**
 * States that produce a plain-language "Kai Update" row in the feed. `watching`
 * is the silent baseline; `triggered` is covered by the real alert fire (no
 * duplicate). The rest are the trust-building progress lines.
 */
export const FEED_UPDATE_STATES: WatchState[] = [
  "building",
  "near_trigger",
  "cooled",
  "invalidated",
  "earnings_wait",
];

export function isFeedUpdateState(s: WatchState | null | undefined): boolean {
  return s != null && FEED_UPDATE_STATES.includes(s);
}

/**
 * States worth a PUSH (routed through the same digest / quiet-hours / daily-cap
 * plumbing as every other alert). Only "getting close" earns an interruption;
 * building / cooled / invalidated / earnings_wait are ambient feed items.
 */
export const PUSH_WORTHY_STATES: WatchState[] = ["near_trigger"];

export function isPushWorthyState(s: WatchState | null | undefined): boolean {
  return s != null && PUSH_WORTHY_STATES.includes(s);
}

/* ── deterministic thresholds (the whole knob-board) ─────────────────────── */

export const WATCH_STATE_THRESHOLDS = {
  /** price_cross: fraction of the way to the level (1.0 = at the level). */
  priceCrossBuilding: 0.95,
  priceCrossNear: 0.98,
  /** pct_move / vol_surge: fraction of the threshold reached. */
  pctMoveBuilding: 0.5,
  pctMoveNear: 0.8,
  volSurgeBuilding: 0.6,
  volSurgeNear: 0.85,
  /** rsi_cross: RSI points still separating price from the level. */
  rsiGapBuilding: 8,
  rsiGapNear: 3,
  rsiProgressSpan: 20, // gap → progress normaliser
  /** w52_break: percent from the 52-week extreme. */
  w52Building: 5,
  w52Near: 2,
  w52ProgressSpan: 10,
  /** sentiment_velocity: fraction of the net-vote delta swung. */
  sentimentBuilding: 0.4,
  sentimentNear: 0.7,
  /**
   * A retreat with progress at/under this floor is an INVALIDATION (the premise
   * broke), not a mere cooldown.
   */
  invalidatedProgress: 0.2,
  /** Days-to-earnings window that surfaces the earnings_wait parking state. */
  earningsWaitDays: 10,
} as const;

/** Max plain-language Kai Updates per watch per day (binding cadence cap). */
export const WATCH_UPDATE_DAILY_CAP = 2;

/** Below-cap → an update may be written; at/over → suppressed. */
export function withinCadenceCap(
  todayCount: number,
  cap: number = WATCH_UPDATE_DAILY_CAP
): boolean {
  return todayCount < cap;
}

/* ── unified inputs (nightly metrics OR intraday snapshot, caller-normalised) */

export interface WatchInputs {
  price?: number | null;
  /** Day % (intraday) or the window's chg (nightly) — caller picks. */
  changePercent?: number | null;
  volRatio?: number | null;
  rsi14?: number | null;
  ema20State?: string | null;
  ema50State?: string | null;
  dist52wHigh?: number | null;
  dist52wLow?: number | null;
  /** sentiment_velocity: current net community sentiment + stored baseline. */
  sentimentNet?: number | null;
  sentimentBase?: number | null;
  /** news_event: a fresh material event landed this cycle. */
  hasFreshEvent?: boolean;
  /** Days until a known scheduled event (earnings) — null when unknown. */
  earningsInDays?: number | null;
}

type ApproachState = "watching" | "building" | "near_trigger" | "triggered";

export interface Classification {
  raw: ApproachState;
  /** Monotonic closeness in [0,1]; 1 = condition met. Drives retreat logic. */
  progress: number;
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const T = WATCH_STATE_THRESHOLDS;

/**
 * Classify how close a single rule is to firing. Returns null when the inputs
 * needed to judge the rule are missing (caller leaves the state untouched but
 * still stamps last_checked_at). Deterministic; mirrors the trigger conditions
 * used by evalNightly / evalIntraday so `triggered` here agrees with a real fire.
 */
export function classify(
  kind: AlertKind,
  params: AlertParams,
  inp: WatchInputs
): Classification | null {
  const p = params || {};
  switch (kind) {
    case "price_cross": {
      const px = num(inp.price);
      const target = num(p.price);
      if (px == null || target == null || target <= 0 || px <= 0) return null;
      const above = p.op !== "below";
      if (above ? px >= target : px <= target) return { raw: "triggered", progress: 1 };
      const frac = above ? px / target : target / px; // → 1 as it approaches
      return { raw: bandByFraction(frac, T.priceCrossBuilding, T.priceCrossNear), progress: clamp01(frac) };
    }
    case "pct_move": {
      const chg = num(inp.changePercent);
      if (chg == null) return null;
      const th = Math.max(0.01, p.pct ?? 5);
      const ratio = Math.abs(chg) / th;
      if (ratio >= 1) return { raw: "triggered", progress: 1 };
      return { raw: bandByFraction(ratio, T.pctMoveBuilding, T.pctMoveNear), progress: clamp01(ratio) };
    }
    case "vol_surge": {
      const vr = num(inp.volRatio);
      if (vr == null) return null;
      const th = Math.max(0.01, p.ratio ?? 3);
      const ratio = vr / th;
      if (ratio >= 1) return { raw: "triggered", progress: 1 };
      return { raw: bandByFraction(ratio, T.volSurgeBuilding, T.volSurgeNear), progress: clamp01(ratio) };
    }
    case "rsi_cross": {
      const rsi = num(inp.rsi14);
      if (rsi == null) return null;
      const level = p.level ?? 30;
      const above = p.op === "above";
      const triggered = above ? rsi >= level : rsi <= level;
      if (triggered) return { raw: "triggered", progress: 1 };
      const gap = above ? level - rsi : rsi - level; // >0 = still separated
      const progress = clamp01(1 - gap / T.rsiProgressSpan);
      return { raw: bandByGap(gap, T.rsiGapBuilding, T.rsiGapNear), progress };
    }
    case "ema_cross": {
      // Binary: above/below its own average. No honest "building" reading, so it
      // is watching until it crosses (avoids a fake gradient).
      const state = p.ema === 50 ? inp.ema50State : inp.ema20State;
      if (!state || state === "unknown") return null;
      const wantAbove = p.side !== "below";
      const triggered = (wantAbove && state === "above") || (!wantAbove && state === "below");
      return triggered ? { raw: "triggered", progress: 1 } : { raw: "watching", progress: 0 };
    }
    case "w52_break": {
      const edge = p.edge === "low" ? num(inp.dist52wLow) : num(inp.dist52wHigh);
      if (edge == null) return null;
      const ad = Math.abs(edge);
      if (ad <= 0.5) return { raw: "triggered", progress: 1 };
      const progress = clamp01(1 - ad / T.w52ProgressSpan);
      return { raw: bandByGap(ad, T.w52Building, T.w52Near), progress };
    }
    case "sentiment_velocity": {
      const cur = num(inp.sentimentNet);
      const base = num(inp.sentimentBase);
      if (cur == null || base == null) return null; // first sighting only seeds
      const delta = Math.max(1, p.delta ?? 5);
      const wantBull = p.sentiment !== "bearish";
      const signed = (wantBull ? cur - base : base - cur) / delta;
      if (signed >= 1) return { raw: "triggered", progress: 1 };
      return { raw: bandByFraction(signed, T.sentimentBuilding, T.sentimentNear), progress: clamp01(signed) };
    }
    case "news_event": {
      if (inp.hasFreshEvent) return { raw: "triggered", progress: 1 };
      return { raw: "watching", progress: 0 };
    }
    default:
      return null;
  }
}

/**
 * Derive the watch state from a fresh classification + the previous state.
 * Returns null when the rule can't be classified this cycle (missing inputs).
 *
 * Retreat logic: if the rule had climbed to building/near_trigger and this cycle
 * it fell back down the ladder, it is `cooled` — or `invalidated` when progress
 * collapsed near zero after nearly triggering. A cooled/invalidated watch stays
 * put until it genuinely rebuilds (so we don't ping-pong watching↔cooled).
 */
export function deriveWatchState(
  kind: AlertKind,
  params: AlertParams,
  inp: WatchInputs,
  prev: WatchState | null
): { state: WatchState; progress: number } | null {
  const c = classify(kind, params, inp);
  if (c == null) return null;
  const raw = c.raw;

  if (raw === "triggered") return { state: "triggered", progress: 1 };

  // Retreat from a previously-advanced state.
  if (prev === "building" || prev === "near_trigger") {
    if (APPROACH_RANK[raw] < APPROACH_RANK[prev]) {
      const state: WatchState =
        c.progress <= T.invalidatedProgress && prev === "near_trigger" ? "invalidated" : "cooled";
      return { state, progress: c.progress };
    }
  }

  // Once cooled/invalidated, only a real rebuild re-engages; otherwise hold
  // (returning the same state ⇒ no transition ⇒ no repeat update).
  if (prev === "cooled" || prev === "invalidated") {
    if (raw === "building" || raw === "near_trigger") return { state: raw, progress: c.progress };
    return { state: prev, progress: c.progress };
  }

  // earnings_wait parks a still-quiet watch that has a known event coming.
  if (
    raw === "watching" &&
    inp.earningsInDays != null &&
    inp.earningsInDays >= 0 &&
    inp.earningsInDays <= T.earningsWaitDays
  ) {
    return { state: "earnings_wait", progress: c.progress };
  }
  // Leaving the earnings window (event passed / pushed out) settles back to
  // watching — a legitimate transition worth nothing louder than the baseline.
  return { state: raw, progress: c.progress };
}

/** Emit a transition ONLY on a real state change (steady-state ⇒ nothing). */
export function shouldEmitTransition(
  prev: WatchState | null,
  next: WatchState | null
): boolean {
  if (next == null) return false;
  return prev !== next;
}

/* ── templated, zero-LLM plain-language copy ─────────────────────────────── */

export interface WatchCopyDetail {
  condition?: string; // human condition label (e.g. "crosses above $150")
  metric?: string; // the moving number (e.g. "volume 1.9× avg")
}

/**
 * Plain-language Kai Update line for a state transition. Never engineering
 * vocabulary; mirrors the KAI-WATCH-UX voice. `condition` is the watch's own
 * label ("what Kai is watching for"); `metric` is the current reading.
 */
export function watchUpdateCopy(
  state: WatchState,
  ticker: string,
  detail: WatchCopyDetail = {}
): string {
  const t = ticker.toUpperCase();
  const cond = detail.condition ? ` ${detail.condition}` : "";
  const metric = detail.metric ? ` — ${detail.metric}` : "";
  switch (state) {
    case "building":
      return `Still watching ${t}${metric}, but the setup hasn't come together yet.`;
    case "near_trigger":
      return `${t} is heating up${metric}. Kai is close to alerting you on${cond || " this one"}.`;
    case "cooled":
      return `This setup on ${t} cooled off${metric}. Kai is still watching, nothing to act on.`;
    case "invalidated":
      return `The ${t} setup broke down${metric}. Kai is standing down on it for now.`;
    case "earnings_wait":
      return `Kai is watching ${t} into its earnings — you'll hear the moment it matters.`;
    case "triggered":
      return `${t}${cond ? ` ${cond}` : ""} — Kai just alerted you.`;
    case "watching":
    default:
      return `Kai is watching ${t}. Everything looks normal.`;
  }
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Map a 0→1 closeness fraction to a band using building/near cutoffs. */
function bandByFraction(frac: number, building: number, near: number): ApproachState {
  if (frac >= near) return "near_trigger";
  if (frac >= building) return "building";
  return "watching";
}

/** Map a shrinking gap (points/percent) to a band; smaller gap = closer. */
function bandByGap(gap: number, building: number, near: number): ApproachState {
  if (gap <= near) return "near_trigger";
  if (gap <= building) return "building";
  return "watching";
}
