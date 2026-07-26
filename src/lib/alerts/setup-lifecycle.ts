/**
 * KAI WATCH — deterministic SETUP lifecycle (LANE A, zero-LLM).
 *
 * A "setup" is a broadcast (Kai Daily) alert promoted to a followable object with
 * its own life:  waiting → confirmed → triggered | invalidated | expired.
 * Members opt in (setup_subscriptions) and only opt-ins get the thread.
 *
 * State is derived here as a pure function of the setup's levels + a live price/
 * volume snapshot + the clock — no language model, no per-setup market calls
 * (the intraday cron already pulls one full-market snapshot). The cron persists a
 * transition only when the state actually changes, via advance_setup_state (which
 * fans the update to subscribers under the same cadence caps as watch updates).
 */

export type SetupState = "waiting" | "confirmed" | "triggered" | "invalidated" | "expired";

export type SetupDirection = "long" | "short" | "watch";

export const SETUP_LIFECYCLE_THRESHOLDS = {
  /** Volume ratio (vs 20-day avg) that counts as the setup being confirmed. */
  confirmVolRatio: 1.5,
  /** Within this fraction of the trigger level also counts as pressing/confirming. */
  confirmProximity: 0.02,
} as const;

/** States the cron still evaluates (terminal states are left alone). */
export const SETUP_LIVE_STATES: SetupState[] = ["waiting", "confirmed"];

/** Lifecycle transitions worth a push to the (opted-in) subscriber. */
export const SETUP_PUSH_WORTHY_STATES: SetupState[] = ["triggered", "invalidated", "confirmed"];

export function isSetupPushWorthy(s: SetupState): boolean {
  return SETUP_PUSH_WORTHY_STATES.includes(s);
}

export interface SetupLevels {
  support?: number | null;
  resistance?: number | null;
  stop?: number | null;
  [k: string]: number | null | undefined;
}

export interface SetupObject {
  direction: SetupDirection;
  entry: number | null;
  levels: SetupLevels;
  state: SetupState;
  expiresAt: string; // ISO
}

export interface SetupSnapshot {
  price?: number | null;
  volRatio?: number | null;
  now?: number; // ms; defaults to Date.now()
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * The level a LONG setup must clear to trigger (the breakout pivot): the explicit
 * entry, else the resistance level. Shorts trigger by breaking their support/entry
 * to the downside. Returns null when no such level is defined.
 */
function triggerLevel(setup: SetupObject): number | null {
  const isShort = setup.direction === "short";
  return num(setup.entry) ?? num(isShort ? setup.levels?.support : setup.levels?.resistance);
}

/** The level whose breach INVALIDATES the setup (the stop). */
function stopLevel(setup: SetupObject): number | null {
  return num(setup.levels?.stop);
}

/**
 * Derive the setup's lifecycle state from a live snapshot. Returns the setup's
 * CURRENT state unchanged when there isn't enough to judge (so the cron emits no
 * transition). Only ever advances a live (waiting/confirmed) setup.
 */
export function deriveSetupState(setup: SetupObject, snap: SetupSnapshot): SetupState {
  if (!SETUP_LIVE_STATES.includes(setup.state)) return setup.state; // terminal — leave it
  const now = snap.now ?? Date.now();
  const px = num(snap.price);
  const isShort = setup.direction === "short";
  const trig = triggerLevel(setup);
  const stop = stopLevel(setup);
  const vr = num(snap.volRatio);
  const T = SETUP_LIFECYCLE_THRESHOLDS;

  // Time-out first: a setup that never fired within its window expires.
  if (Date.parse(setup.expiresAt) <= now) return "expired";

  if (px == null) return setup.state; // nothing live to judge on

  // Invalidation (stop breached) outranks a trigger this cycle.
  if (stop != null) {
    if (isShort ? px >= stop : px <= stop) return "invalidated";
  }
  // Trigger (level cleared).
  if (trig != null) {
    if (isShort ? px <= trig : px >= trig) return "triggered";
    // Confirmation: volume showed up, or price is pressing the level.
    const pressing = isShort
      ? px <= trig * (1 + T.confirmProximity)
      : px >= trig * (1 - T.confirmProximity);
    if ((vr != null && vr >= T.confirmVolRatio) || pressing) return "confirmed";
  } else if (vr != null && vr >= T.confirmVolRatio && setup.state === "waiting") {
    // No level defined but real volume arrived — still a confirmation signal.
    return "confirmed";
  }
  return setup.state;
}

/** Plain-language subscriber copy for a setup lifecycle transition (zero-LLM). */
export function setupUpdateCopy(state: SetupState, ticker: string): string {
  const t = ticker.toUpperCase();
  switch (state) {
    case "confirmed":
      return `The ${t} setup you're following is confirming — volume is showing up behind it.`;
    case "triggered":
      return `${t} just triggered the setup you're following — it cleared the level Kai flagged.`;
    case "invalidated":
      return `The ${t} setup you're following broke down — Kai is calling it off.`;
    case "expired":
      return `The ${t} setup you were following fizzled out without triggering — Kai is closing the thread.`;
    case "waiting":
    default:
      return `Kai is still watching the ${t} setup — nothing has developed yet.`;
  }
}
