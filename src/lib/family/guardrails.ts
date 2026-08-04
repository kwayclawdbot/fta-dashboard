/**
 * FAMILY MODE — the guardrail model (canvas F3).
 *
 * The one rule this file exists to enforce: **a guardrail the app renders as a
 * control must be a real write with real consequences.** Migration 190 sorts
 * every guardrail the canvas draws into one of four honest categories, and this
 * file is the TypeScript mirror of that sort so no surface can quietly promote
 * a statement of fact into a switch (or, worse, ship a switch that persists
 * nothing).
 *
 *   "structural"  — already true of the product. There is no real-money order
 *                   path and no options/margin surface anywhere, so there is
 *                   nothing to turn off. Renders locked-on with the reason.
 *   "enforced"    — persisted in family_guardrails AND enforced server-side by
 *                   the RESTRICTIVE policies in migration 190 §7. A tampered
 *                   client gets a database error, not a bypass.
 *   "recorded"    — persisted, honoured by the surfaces that exist, but the
 *                   product has no complete enforcement path yet. Says so.
 *   "absent"      — the canvas draws it; the product has no mechanism at all.
 *                   Renders as a stated absence, never as a dead toggle.
 *
 * The single "absent" case is "Approve who they follow": there is no follow
 * graph in this schema — no follows table, no follow request, no follower
 * edge — so a toggle would govern nothing.
 */

export type GuardrailEnforcement = "structural" | "enforced" | "recorded" | "absent";

/** The columns that exist on family_guardrails. */
export interface FamilyGuardrails {
  child_id: string;
  family_id: string;
  chat_family_only: boolean;
  downtime_enabled: boolean;
  downtime_start_hour: number;
  downtime_end_hour: number;
  daily_limit_min: number | null;
  live_listen_only: boolean;
  tz: string;
  updated_at: string;
  updated_by: string | null;
}

/** The write keys set_family_guardrail() accepts. Nothing else is settable. */
export type GuardrailKey =
  | "chat_family_only"
  | "downtime_enabled"
  | "downtime_start_hour"
  | "downtime_end_hour"
  | "daily_limit_min"
  | "live_listen_only"
  | "tz";

export const DEFAULT_GUARDRAILS: Omit<
  FamilyGuardrails,
  "child_id" | "family_id" | "updated_at" | "updated_by"
> = {
  chat_family_only: true,
  downtime_enabled: false,
  downtime_start_hour: 21,
  downtime_end_hour: 7,
  daily_limit_min: null,
  live_listen_only: true,
  tz: "America/New_York",
};

export interface GuardrailSpec {
  /** Section the canvas groups it under. */
  group: "money" | "people" | "time";
  /** Null for structural / absent entries — they have no column to write. */
  key: GuardrailKey | null;
  label: string;
  sub: string;
  enforcement: GuardrailEnforcement;
  /** Shown wherever the enforcement is not a hard server-side lock. */
  note?: string;
}

/**
 * The full F3 list, in canvas order. `enforcement` decides how the row renders:
 * only "enforced" rows get a switch.
 */
export const GUARDRAIL_SPECS: GuardrailSpec[] = [
  {
    group: "money",
    key: null,
    label: "Paper trading only",
    sub: "Real-money features stay hidden",
    enforcement: "structural",
    note: "There is no real-money order path in this product. The only trading surface is the simulator, so this cannot be turned off.",
  },
  {
    group: "money",
    key: null,
    label: "Hide options & leverage content",
    sub: "Feeds, lessons and alerts filtered",
    enforcement: "structural",
    note: "The platform is equities-only. There is no options chain, margin or leverage surface anywhere to reach.",
  },
  {
    group: "people",
    key: "chat_family_only",
    label: "Chat: Family Circle only",
    sub: "No DMs or public rooms",
    enforcement: "enforced",
  },
  {
    group: "people",
    key: null,
    label: "Approve who they follow",
    sub: "Requests come to you first",
    enforcement: "absent",
    note: "Not available: this product has no follow graph yet — members cannot follow each other at all, so there is nothing to approve. A switch here would control nothing.",
  },
  {
    group: "people",
    key: "live_listen_only",
    label: "Live rooms (listen only)",
    sub: "Can't join any live rooms",
    enforcement: "recorded",
    note: "Recorded and honoured by the Live surface. Live classes are scheduled broadcasts today — there is no speak or raise-hand write path to block, so this binds the moment room audio ships.",
  },
  {
    group: "time",
    key: "downtime_enabled",
    label: "Downtime",
    sub: "The app stops accepting activity overnight",
    enforcement: "enforced",
  },
  {
    group: "time",
    key: "daily_limit_min",
    label: "Daily limit",
    sub: "Minutes of Family Mode per day",
    enforcement: "enforced",
    note: "Minutes are counted while a Family Mode surface is open. Once the limit is reached, posting, paper trades and circle messages are refused by the database until tomorrow.",
  },
];

/** 21 → "9 PM". Used for the downtime window copy. */
export function hourLabel(h: number): string {
  const hour = ((h % 24) + 24) % 24;
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

export function downtimeLabel(g: Pick<FamilyGuardrails, "downtime_start_hour" | "downtime_end_hour">): string {
  return `${hourLabel(g.downtime_start_hour)} – ${hourLabel(g.downtime_end_hour)}`;
}

/**
 * The one-line guardrail summary /family prints under each supervised member.
 *
 * EVERY ENTRY IS A TRUE STATEMENT ABOUT THIS CHILD RIGHT NOW. The temptation on
 * a screen like this is to print the reassuring set — "Paper only · Family chat
 * only · Downtime 9 PM – 7 AM" — regardless of what is actually stored, which
 * would tell a parent their household is fenced when it is not. So:
 *
 *   • "Paper only" is unconditional because it is structural (GUARDRAIL_SPECS):
 *     there is no real-money order path in this product to turn on.
 *   • chat_family_only prints its own state either way — never silence, because
 *     silence on a safety line reads as "on".
 *   • Downtime prints the window ONLY when downtime_enabled. Disabled says so.
 *   • The daily limit appears only when one is set; "no limit" is the default
 *     and adding a chip for it would pad the line without adding a fact.
 */
export function guardrailSummary(g: FamilyGuardrails): string[] {
  const out: string[] = ["Paper only"];
  out.push(g.chat_family_only ? "Family chat only" : "Chat not limited to family");
  out.push(g.downtime_enabled ? `Downtime ${downtimeLabel(g)}` : "No downtime set");
  if (g.daily_limit_min != null) out.push(`${minutesLabel(g.daily_limit_min)} a day`);
  return out;
}

/** Minutes → "3h 12m" / "45m". */
export function minutesLabel(min: number | null | undefined): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Is the household clock inside the downtime window right now? */
export function inDowntimeNow(g: FamilyGuardrails, now = new Date()): boolean {
  if (!g.downtime_enabled) return false;
  let hour: number;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: g.tz,
      }).format(now)
    );
  } catch {
    hour = now.getHours();
  }
  hour = hour % 24;
  const { downtime_start_hour: s, downtime_end_hour: e } = g;
  if (s === e) return false;
  return s < e ? hour >= s && hour < e : hour >= s || hour < e;
}

/** The daily-limit choices the parental control offers. */
export const DAILY_LIMIT_CHOICES: { value: number | null; label: string }[] = [
  { value: null, label: "No limit" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
  { value: 90, label: "90 min" },
];

export const DOWNTIME_START_CHOICES = [19, 20, 21, 22, 23];
export const DOWNTIME_END_CHOICES = [5, 6, 7, 8, 9];

/**
 * CANONICAL GUARDRAIL-BLOCKED MICROCOPY — one source of truth for the Family
 * surfaces (Circle send, watchlist vote, activity banner). These used to be
 * three near-duplicate strings that had drifted apart, each carrying an em-dash
 * in visible copy. A guardrail is downtime or the daily limit; it pauses writes
 * while reading stays open. Edit the voice here once and every surface follows.
 */
const GUARDRAIL_ACTIVE_STATE =
  "A guardrail on this account is active right now (downtime, or the daily limit).";

/**
 * Short "that write was blocked" line. `action` is the verb that failed
 * ("send"/"save"); `subject` is what reopens ("It" for the Circle, "Voting").
 */
export function guardrailBlocked(action: string, subject: string): string {
  return `That didn't ${action}. ${GUARDRAIL_ACTIVE_STATE} ${subject} reopens on its own when the guardrail lifts.`;
}

/** Circle message failed to post. */
export const GUARDRAIL_CIRCLE_BLOCKED = guardrailBlocked("send", "It");

/** Watchlist vote failed to save. */
export const GUARDRAIL_VOTE_BLOCKED = guardrailBlocked("save", "Voting");

/** Informational banner: the account is resting; reading stays open. */
export const GUARDRAIL_ACTIVE_NOTICE = `${GUARDRAIL_ACTIVE_STATE} Reading stays open; posting, paper trades and Circle messages resume when it lifts.`;
