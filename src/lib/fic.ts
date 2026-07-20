import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Family Investing Club — weekly club record + Start Here orientation.
 *
 * One `fic_weeks` row drives the home "This Week in FIC" subtab, the Parent
 * Corner, and the kid challenge. The owner authors it from the admin dashboard.
 * Orientation ("Start Here") is a mandatory, family-level checklist tracked in
 * `orientation_progress`; some steps auto-complete from other features'
 * tables (watchlist, RSVP, missions) — those queries are GUARDED so a table
 * that another agent hasn't shipped yet degrades gracefully instead of crashing.
 */

// ── This Week ────────────────────────────────────────────────────────────────

export interface FicWeek {
  id: string;
  week_start: string;
  class_title: string;
  class_session_id: string | null;
  company_name: string | null;
  company_ticker: string | null;
  cotw_what_they_do: string | null;
  cotw_how_they_make_money: string | null;
  cotw_why_customers_love: string | null;
  cotw_why_investors_watch: string | null;
  cotw_what_could_go_wrong: string | null;
  cotw_discussion_question: string | null;
  cotw_watchlist_assignment: string | null;
  family_assignment: string | null;
  parent_prompt: string | null;
  kid_challenge: string | null;
  parent_what_child_learned: string | null;
  parent_dinner_questions: string | null;
  parent_explain_simply: string | null;
  parent_what_not_to_do: string | null;
  parent_risk_talk: string | null;
  parent_patience: string | null;
  published: boolean;
  is_current: boolean;
  updated_at?: string;
}

/**
 * The single published week to feature. Preference order:
 *   1) the row explicitly flagged is_current (owner "pick current week")
 *   2) the most recent published week whose start date is on/before today
 *   3) the most recent published week overall
 * Returns null if nothing is published yet.
 */
export async function getCurrentFicWeek(
  supabase: SupabaseClient
): Promise<FicWeek | null> {
  const { data, error } = await supabase
    .from("fic_weeks")
    .select("*")
    .eq("published", true)
    .order("week_start", { ascending: false });
  if (error || !data || data.length === 0) return null;

  const rows = data as FicWeek[];
  const flagged = rows.find((r) => r.is_current);
  if (flagged) return flagged;

  const today = new Date().toISOString().slice(0, 10);
  const started = rows.find((r) => r.week_start <= today);
  return started ?? rows[0];
}

// ── Start Here orientation ───────────────────────────────────────────────────

export type OrientationStepKind = "attest" | "auto";

export interface OrientationStep {
  key: string;
  title: string;
  blurb: string;
  kind: OrientationStepKind;
  /** Where the family goes to actually do the step. */
  ctaLabel: string;
  ctaHref?: string;
  /** For attest steps: the button copy once they've done it elsewhere. */
  attestLabel?: string;
}

export const ORIENTATION_STEPS: OrientationStep[] = [
  {
    key: "watch_orientation",
    title: "Watch the orientation",
    blurb:
      "Start with the family orientation. It sets the ground rules: we learn first, we practice with pretend money, and there's no pressure to ever trade for real.",
    kind: "attest",
    ctaLabel: "Watch orientation",
    attestLabel: "Mark as watched",
  },
  {
    key: "intro_post",
    title: "Introduce your family",
    blurb:
      "Say hello in the community. Tell everyone who's in your family crew and one company you already love — it's the friendliest first step.",
    kind: "auto",
    ctaLabel: "Post an intro",
    ctaHref: "/community",
  },
  {
    key: "open_accounts",
    title: "Learn about opening accounts",
    blurb:
      "Read the plain-English guide on custodial and brokerage accounts. It's education, not a sales pitch — whether and how much your family contributes each week is a personal decision you make on your own.",
    kind: "attest",
    ctaLabel: "Read the accounts guide",
    attestLabel: "Mark as reviewed",
  },
  {
    key: "add_watchlist",
    title: "Add your first 3 companies",
    blurb:
      "Add three companies your family already uses to your Family Watchlist. This becomes your research board for the weeks ahead.",
    kind: "auto",
    ctaLabel: "Open Family Watchlist",
    ctaHref: "/watchlist",
  },
  {
    key: "rsvp_class",
    title: "RSVP to your first live class",
    blurb:
      "Grab your spot in an upcoming live class. Classes are where the week comes together as a family.",
    kind: "auto",
    ctaLabel: "See live classes",
    ctaHref: "/live-sessions",
  },
  {
    key: "first_mission",
    title: "Complete your first kid mission",
    blurb:
      "Have a kid finish one mission — like Brand Detective or Money Machine. Playful, hands-on, and it earns XP.",
    kind: "auto",
    ctaLabel: "Go to Kid Missions",
    ctaHref: "/missions",
  },
];

export const ORIENTATION_TOTAL = ORIENTATION_STEPS.length;

export interface OrientationState {
  completed: Set<string>;
  total: number;
  allDone: boolean;
}

/** Guarded count — returns 0 if the table/query is missing (other agent's lane). */
async function safeCount(
  run: () => PromiseLike<{ count: number | null; error: unknown }>
): Promise<number> {
  try {
    const { count, error } = await run();
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Read the family's orientation completion, auto-detecting the steps that live
 * in other features' tables. Any auto step that's satisfied but not yet
 * recorded is persisted so the checklist stays stable across sessions.
 */
export async function getOrientationState(
  supabase: SupabaseClient,
  familyId: string | null | undefined,
  memberIds: string[]
): Promise<OrientationState> {
  const completed = new Set<string>();
  if (!familyId) {
    return { completed, total: ORIENTATION_TOTAL, allDone: false };
  }

  // 1) Recorded completions.
  const { data: rows } = await supabase
    .from("orientation_progress")
    .select("step_key")
    .eq("family_id", familyId);
  for (const r of rows || []) completed.add((r as { step_key: string }).step_key);

  const ids = memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"];

  // 2) Auto-detections (guarded) for steps not already recorded.
  const toRecord: string[] = [];

  if (!completed.has("intro_post")) {
    const n = await safeCount(() =>
      supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .in("user_id", ids)
    );
    if (n > 0) toRecord.push("intro_post");
  }

  if (!completed.has("add_watchlist")) {
    const n = await safeCount(() =>
      supabase
        .from("family_watchlist")
        .select("id", { count: "exact", head: true })
        .eq("family_id", familyId)
    );
    if (n >= 3) toRecord.push("add_watchlist");
  }

  if (!completed.has("rsvp_class")) {
    const n = await safeCount(() =>
      supabase
        .from("session_rsvps")
        .select("id", { count: "exact", head: true })
        .in("user_id", ids)
    );
    if (n > 0) toRecord.push("rsvp_class");
  }

  if (!completed.has("first_mission")) {
    const n = await safeCount(() =>
      supabase
        .from("mission_completions")
        .select("id", { count: "exact", head: true })
        .in("user_id", ids)
    );
    if (n > 0) toRecord.push("first_mission");
  }

  // 3) Persist newly-detected completions (ignore duplicate races).
  if (toRecord.length) {
    await supabase
      .from("orientation_progress")
      .upsert(
        toRecord.map((step_key) => ({ family_id: familyId, step_key })),
        { onConflict: "family_id,step_key", ignoreDuplicates: true }
      );
    for (const k of toRecord) completed.add(k);
  }

  return {
    completed,
    total: ORIENTATION_TOTAL,
    allDone: completed.size >= ORIENTATION_TOTAL,
  };
}

/** Mark an attest-style step done for the family. */
export async function markOrientationStep(
  supabase: SupabaseClient,
  familyId: string,
  userId: string,
  stepKey: string
): Promise<void> {
  await supabase
    .from("orientation_progress")
    .upsert(
      { family_id: familyId, step_key: stepKey, completed_by: userId },
      { onConflict: "family_id,step_key", ignoreDuplicates: true }
    );
}
