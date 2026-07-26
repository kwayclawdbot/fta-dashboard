/**
 * KAI WATCH — UI-side presentation helpers (Lane B, pure + client-safe).
 *
 * Zero server/LLM dependencies: turns the deterministic Lane A watch/setup state
 * (watch-state.ts / setup-lifecycle.ts) into the honest, companion-voiced strings
 * and color tokens the hub renders. Nothing here invents data — market status is
 * derived from the real clock, freshness from the real last_checked_at, and the
 * observational "what happened after" from already-stored daily closes.
 */

import type { WatchState } from "./watch-state.ts";
import type { SetupState } from "./setup-lifecycle.ts";

/* ── color language (brand register: volt=action/live · teal=building/network ·
 *    kai-blue=AI/scheduled · quiet=ambient) ──────────────────────────────── */
export type StateTone = "volt" | "teal" | "kai" | "quiet";

export interface StateMeta {
  /** Short status word for chips / rails. */
  label: string;
  tone: StateTone;
  /** Is this a "something changed, look now" state (drives the ⚡ affordance)? */
  live: boolean;
  /** Is the watch actively developing (belongs in Live Watches)? */
  developing: boolean;
}

export const WATCH_STATE_META: Record<WatchState, StateMeta> = {
  watching: { label: "All normal", tone: "quiet", live: false, developing: false },
  building: { label: "Building", tone: "teal", live: false, developing: true },
  near_trigger: { label: "Heating up", tone: "volt", live: true, developing: true },
  triggered: { label: "Triggered", tone: "volt", live: true, developing: true },
  cooled: { label: "Cooled off", tone: "quiet", live: false, developing: true },
  invalidated: { label: "Stood down", tone: "quiet", live: false, developing: true },
  earnings_wait: { label: "Into earnings", tone: "kai", live: false, developing: true },
};

/** The plain-language "what Kai sees right now" line under an active watch. */
export function watchStateLine(state: WatchState, ticker: string): string {
  const t = ticker.toUpperCase();
  switch (state) {
    case "watching":
      return "Everything looks normal — Kai will speak up the moment it isn't.";
    case "building":
      return `The setup on ${t} is starting to come together.`;
    case "near_trigger":
      return `${t} is right at the doorstep — Kai is close to alerting you.`;
    case "triggered":
      return `${t} hit what Kai was watching for.`;
    case "cooled":
      return "This one cooled off. Kai is still watching, nothing to act on.";
    case "invalidated":
      return "The setup broke down. Kai has stood down on it for now.";
    case "earnings_wait":
      return `Kai is holding until ${t}'s earnings — you'll hear the moment it matters.`;
    default:
      return "Kai is watching.";
  }
}

export const SETUP_STATE_META: Record<SetupState, StateMeta> = {
  waiting: { label: "Waiting", tone: "quiet", live: false, developing: true },
  confirmed: { label: "Confirming", tone: "teal", live: true, developing: true },
  triggered: { label: "Triggered", tone: "volt", live: true, developing: true },
  invalidated: { label: "Called off", tone: "quiet", live: false, developing: false },
  expired: { label: "Fizzled", tone: "quiet", live: false, developing: false },
};

/** Lifecycle-thread line for a followed setup. */
export function setupStateLine(state: SetupState, ticker: string): string {
  const t = ticker.toUpperCase();
  switch (state) {
    case "waiting":
      return `Kai is waiting for ${t} to make its move.`;
    case "confirmed":
      return `Volume is showing up behind ${t} — it's confirming.`;
    case "triggered":
      return `${t} cleared the level Kai flagged.`;
    case "invalidated":
      return `${t} broke down — Kai is calling this setup off.`;
    case "expired":
      return `${t} fizzled out without triggering — thread closed.`;
    default:
      return `Kai is following ${t}.`;
  }
}

/** Tailwind tokens for a tone (text + soft field + glowing live dot halo). */
export function toneClasses(tone: StateTone): {
  text: string;
  dot: string;
  glow: string;
  chip: string;
} {
  switch (tone) {
    case "volt":
      return {
        text: "text-volt-600",
        dot: "bg-volt-500",
        glow: "club-livedot-volt",
        chip: "bg-volt-500/12 text-volt-700",
      };
    case "teal":
      return {
        text: "text-teal-700",
        dot: "bg-teal-500",
        glow: "club-livedot-teal",
        chip: "bg-teal-500/12 text-teal-700",
      };
    case "kai":
      return {
        text: "text-kai-blue",
        dot: "bg-kai-blue",
        glow: "club-livedot-kai",
        chip: "bg-kai-blue-soft text-kai-blue",
      };
    case "quiet":
    default:
      return {
        text: "text-soft",
        dot: "bg-soft/50",
        glow: "",
        chip: "bg-sand text-soft",
      };
  }
}

/* ── market status (real clock, America/New_York) ───────────────────────── */
export interface MarketStatus {
  open: boolean;
  /** "Market open" / "Market closed" / "Pre-market" / "After hours" / "Weekend". */
  label: string;
}

/** US equity regular session: Mon–Fri 09:30–16:00 ET (holidays not modeled). */
export function marketStatus(now: Date = new Date()): MarketStatus {
  let wd = 1;
  let minutes = 12 * 60;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    wd = wdMap[get("weekday")] ?? 1;
    const h = parseInt(get("hour"), 10);
    const m = parseInt(get("minute"), 10);
    minutes = (Number.isFinite(h) ? h : 12) * 60 + (Number.isFinite(m) ? m : 0);
  } catch {
    // Intl timezone unsupported → treat as a neutral open midday.
  }
  if (wd === 0 || wd === 6) return { open: false, label: "Markets closed · weekend" };
  const openM = 9 * 60 + 30;
  const closeM = 16 * 60;
  if (minutes < openM) return { open: false, label: "Pre-market" };
  if (minutes >= closeM) return { open: false, label: "After hours" };
  return { open: true, label: "Market open" };
}

/* ── honest freshness ───────────────────────────────────────────────────── */
/**
 * A truthful "last checked" line. Never fakes immediacy — only says "Xm ago"
 * when it genuinely is; older checks fall back to a clock time; null is honest.
 */
export function freshnessLabel(lastCheckedAt: string | null | undefined, now: Date = new Date()): string {
  if (!lastCheckedAt) return "Not checked yet";
  const then = new Date(lastCheckedAt).getTime();
  if (!Number.isFinite(then)) return "Not checked yet";
  const mins = Math.floor((now.getTime() - then) / 60000);
  if (mins < 0) return "Checked just now";
  if (mins < 1) return "Checked just now";
  if (mins < 60) return `Checked ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 8) return `Checked ${hrs}h ago`;
  // Older than the session → show the actual clock time, no faked recency.
  return `Last checked ${new Date(lastCheckedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

/* ── observational "what happened after" (NEVER W/L) ────────────────────── */
export interface ObservationalOutcome {
  plus1d: number | null;
  plus5d: number | null;
  latest: number | null;
}

/** One observational-alert follow-through row for the track record split. */
export interface ObservationalRow extends ObservationalOutcome {
  id: string;
  ticker: string;
  firedAt: string;
  message: string;
}

/**
 * For an OBSERVATIONAL alert (sentiment shift / news / progress update) compute
 * the neutral "what the stock did after" from stored daily closes — a factual
 * follow-through readout, explicitly never graded as a win or loss.
 * `closes` = the ticker's daily closes (any order); `firedAt` ISO; `basePrice`
 * = the price when the alert fired.
 */
export function observationalOutcome(
  basePrice: number | null,
  firedAt: string,
  closes: { as_of: string; close: number }[]
): ObservationalOutcome {
  if (basePrice == null || basePrice <= 0) return { plus1d: null, plus5d: null, latest: null };
  const day = firedAt.slice(0, 10);
  const post = closes
    .filter((c) => c.as_of >= day && c.close != null)
    .sort((a, b) => a.as_of.localeCompare(b.as_of));
  if (post.length === 0) return { plus1d: null, plus5d: null, latest: null };
  const pct = (p: number) => ((p - basePrice) / basePrice) * 100;
  // post[0] is issue-day close; +1 trading day = index 1, +5 = index 5.
  const at = (i: number) => (post.length > i ? pct(post[i].close) : null);
  return {
    plus1d: at(1),
    plus5d: at(5),
    latest: pct(post[post.length - 1].close),
  };
}

/* ── setup levels (thin, tolerant reader for the setup card) ─────────────── */
export function readSetupLevels(levels: Record<string, unknown> | null | undefined): {
  support: number | null;
  resistance: number | null;
  stop: number | null;
} {
  const n = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const l = levels || {};
  return { support: n(l.support), resistance: n(l.resistance), stop: n(l.stop) };
}
