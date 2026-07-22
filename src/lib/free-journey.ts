import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The free "first week" journey. Steps are auto-detected server-side by the
 * `free_journey_state` RPC (migration 088) from data the member already
 * produces; only `watched_video` is a client event persisted via
 * `free_journey_mark`. This module is the thin client for both.
 */

export type JourneyStepKey =
  | "class_rsvped"
  | "watched_video"
  | "first_lesson"
  | "said_hi"
  | "first_game";

export interface JourneyState {
  class_rsvped: boolean;
  watched_video: boolean;
  first_lesson: boolean;
  said_hi: boolean;
  first_game: boolean;
  /** The member's free-class time (ISO) — drives the post-class band. */
  class_at: string | null;
  class_passed: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

const EMPTY: JourneyState = {
  class_rsvped: false,
  watched_video: false,
  first_lesson: false,
  said_hi: false,
  first_game: false,
  class_at: null,
  class_passed: false,
};

/** The five checklist steps, in order (labels live in the component). */
export const JOURNEY_STEP_KEYS: JourneyStepKey[] = [
  "class_rsvped",
  "watched_video",
  "first_lesson",
  "said_hi",
  "first_game",
];

export function journeyDoneCount(s: JourneyState): number {
  return JOURNEY_STEP_KEYS.reduce((n, k) => n + (s[k] ? 1 : 0), 0);
}

export function journeyComplete(s: JourneyState): boolean {
  return journeyDoneCount(s) >= JOURNEY_STEP_KEYS.length;
}

/** Fetch the merged, auto-detected checklist state for the current user. */
export async function fetchJourneyState(supabase: DB): Promise<JourneyState> {
  try {
    const { data } = await supabase.rpc("free_journey_state");
    if (!data || typeof data !== "object") return EMPTY;
    return { ...EMPTY, ...(data as Partial<JourneyState>) };
  } catch {
    return EMPTY;
  }
}

/** Persist a client-only step (today: `watched_video`). Best-effort. */
export async function markJourneyStep(
  supabase: DB,
  step: JourneyStepKey
): Promise<void> {
  try {
    await supabase.rpc("free_journey_mark", { p_step: step });
  } catch {
    /* non-fatal */
  }
}
