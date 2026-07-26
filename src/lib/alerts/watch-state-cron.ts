/**
 * KAI WATCH — server glue that runs the watch-state machine INSIDE the existing
 * evaluate-alerts crons (LANE A). Kept out of watch-state.ts so that module stays
 * pure + unit-testable; this file is the only part that touches the DB.
 *
 * Per cycle, for the rules a cron already has data for, it:
 *   1. reads each watch's CURRENT state (latest watch_states row),
 *   2. derives the new state from how close the condition is (deriveWatchState),
 *   3. on a real change, appends a watch_states transition, and
 *   4. for feed-worthy states, writes a cadence-capped plain-language Kai Update
 *      via emit_watch_update (max 2/day per watch, quiet-hours + digest aware).
 * `stampLastChecked` records honest freshness for every rule the cron looked at.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { AlertRule } from "./types";
import {
  deriveWatchState,
  shouldEmitTransition,
  isFeedUpdateState,
  isPushWorthyState,
  watchUpdateCopy,
  type WatchInputs,
  type WatchState,
} from "./watch-state";

type Db = ReturnType<typeof createAdminClient>;

export interface WatchEntry {
  rule: Pick<AlertRule, "id" | "kind" | "ticker" | "params" | "label">;
  inputs: WatchInputs;
  /** Optional short "current reading" phrase for the update copy. */
  metric?: string;
}

export interface WatchCycleResult {
  evaluated: number;
  transitions: number;
  updates_pushed: number;
  updates_held: number;
  updates_feed_only: number;
  updates_capped: number;
}

/** Stamp last_checked_at=now() for every rule this cron considered (freshness). */
export async function stampLastChecked(db: Db, ruleIds: string[]): Promise<void> {
  const ids = [...new Set(ruleIds)].filter(Boolean);
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    await db.from("alert_rules").update({ last_checked_at: new Date().toISOString() }).in("id", chunk);
  }
}

/** Load each rule's current watch state (latest transition per rule). */
async function loadCurrentStates(db: Db, ruleIds: string[]): Promise<Map<string, WatchState>> {
  const out = new Map<string, WatchState>();
  const ids = [...new Set(ruleIds)].filter(Boolean);
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    const { data } = await db
      .from("watch_states")
      .select("rule_id, state, entered_at")
      .in("rule_id", chunk)
      .order("entered_at", { ascending: false });
    // rows are newest-first; first sighting per rule_id is its current state.
    for (const r of (data || []) as { rule_id: string; state: WatchState }[]) {
      if (!out.has(r.rule_id)) out.set(r.rule_id, r.state);
    }
  }
  return out;
}

/**
 * Run the state machine for a batch of rules the cron already resolved inputs
 * for. Idempotent: a rule whose derived state equals its current state produces
 * no transition and no update (steady-state emits nothing).
 */
export async function runWatchStateCycle(
  db: Db,
  entries: WatchEntry[]
): Promise<WatchCycleResult> {
  const res: WatchCycleResult = {
    evaluated: entries.length,
    transitions: 0,
    updates_pushed: 0,
    updates_held: 0,
    updates_feed_only: 0,
    updates_capped: 0,
  };
  if (entries.length === 0) return res;

  const current = await loadCurrentStates(
    db,
    entries.map((e) => e.rule.id)
  );

  for (const e of entries) {
    const prev = current.get(e.rule.id) ?? null;
    const derived = deriveWatchState(e.rule.kind, e.rule.params, e.inputs, prev);
    if (!derived) continue; // insufficient inputs → leave state, still fresh-stamped
    const next = derived.state;
    if (!shouldEmitTransition(prev, next)) continue;

    // 1) append the transition (the state log — current state = latest row).
    await db.from("watch_states").insert({
      rule_id: e.rule.id,
      state: next,
      detail: {
        progress: Math.round(derived.progress * 100) / 100,
        condition: e.rule.label,
        metric: e.metric ?? null,
        from: prev,
      },
    });
    res.transitions++;

    // 2) feed-worthy progress states get a cadence-capped Kai Update. 'triggered'
    //    is covered by the real alert fire; 'watching' is the silent baseline.
    if (!isFeedUpdateState(next)) continue;
    const message = watchUpdateCopy(next, e.rule.ticker || "", {
      condition: e.rule.label,
      metric: e.metric,
    });
    const { data: mode } = await db.rpc("emit_watch_update", {
      p_rule_id: e.rule.id,
      p_state: next,
      p_ticker: e.rule.ticker || "",
      p_message: message,
      p_condition: e.rule.label,
      p_push_worthy: isPushWorthyState(next),
    });
    if (mode === "push") res.updates_pushed++;
    else if (mode === "digest") res.updates_held++;
    else if (mode === "capped") res.updates_capped++;
    else res.updates_feed_only++;
  }

  return res;
}
