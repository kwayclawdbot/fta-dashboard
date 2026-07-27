import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChallengeBeat,
  ChallengeDay,
  ChallengePhase,
  ChallengeQuestion,
  ChallengeState,
} from "./types";

/**
 * Read/write helpers over migration 199's RPCs. Everything here is a thin,
 * typed wrapper — the derivations that matter (phase, day state, streak, cohort
 * counts) happen in Postgres so the SERVER is the authority, not the browser.
 *
 * There is no client-side date arithmetic that gates anything in this file.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

/** Lazily provision the journey row + grant the once-ever signup XP. */
export async function joinChallenge(db: DB, src?: string): Promise<void> {
  await db.rpc("challenge_join", { p_src: src ?? null });
}

/** THE one read. Returns null when the member has no active cohort. */
export async function fetchChallengeState(db: DB): Promise<ChallengeState | null> {
  const { data, error } = await db.rpc("challenge_state");
  if (error || !data) return null;
  const state = data as ChallengeState | { ok: false };
  return "ok" in state && state.ok ? (state as ChallengeState) : null;
}

/** The MINUTE-2 questions with their options, ordered. */
export async function fetchQuestions(db: DB): Promise<ChallengeQuestion[]> {
  const [{ data: qs }, { data: opts }] = await Promise.all([
    db.from("challenge_questions").select("key, sort, prompt, helper, kind, required").order("sort"),
    db
      .from("challenge_question_options")
      .select("question_key, key, label, emoji, sort")
      .order("sort"),
  ]);
  if (!qs) return [];
  return (qs as Omit<ChallengeQuestion, "options">[]).map((q) => ({
    ...q,
    options: ((opts || []) as (ChallengeQuestion["options"][number] & {
      question_key: string;
    })[])
      .filter((o) => o.question_key === q.key)
      .map(({ key, label, emoji, sort }) => ({ key, label, emoji, sort })),
  }));
}

export async function saveAnswer(
  db: DB,
  key: string,
  answerKey: string | null,
  answerText: string | null
): Promise<{ answered: number; required: number; xp_awarded: number } | null> {
  const { data, error } = await db.rpc("challenge_save_answer", {
    p_key: key,
    p_answer_key: answerKey,
    p_answer_text: answerText,
  });
  if (error) return null;
  return data as { answered: number; required: number; xp_awarded: number };
}

export async function completeBeat(db: DB, key: string, ref?: string): Promise<boolean> {
  const { error } = await db.rpc("challenge_complete_beat", {
    p_key: key,
    p_ref: ref ?? null,
  });
  return !error;
}

export async function completeStep(
  db: DB,
  day: number,
  step: "brief" | "do" | "share",
  payload: Record<string, unknown> = {}
): Promise<{ ok: boolean; error?: string; xp_awarded?: number }> {
  const { data, error } = await db.rpc("challenge_complete_step", {
    p_day: day,
    p_step: step,
    p_payload: payload,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, xp_awarded: (data as { xp_awarded?: number })?.xp_awarded };
}

export async function postArtifact(
  db: DB,
  args: {
    day: number;
    kind: string;
    body: string;
    ticker?: string | null;
    company?: string | null;
    payload?: Record<string, unknown>;
    postToCommunity?: boolean;
  }
): Promise<{ ok: boolean; error?: string; artifactId?: string; feedPostId?: string }> {
  const { data, error } = await db.rpc("challenge_post_artifact", {
    p_day: args.day,
    p_kind: args.kind,
    p_body: args.body,
    p_ticker: args.ticker ?? null,
    p_company: args.company ?? null,
    p_payload: args.payload ?? {},
    p_post_to_community: args.postToCommunity ?? true,
  });
  if (error) return { ok: false, error: error.message };
  const d = data as { artifact_id?: string; feed_post_id?: string };
  return { ok: true, artifactId: d?.artifact_id, feedPostId: d?.feed_post_id };
}

export async function setSmsOptIn(
  db: DB,
  on: boolean,
  phone?: string | null
): Promise<boolean> {
  const { error } = await db.rpc("challenge_set_sms_opt_in", {
    p_on: on,
    p_phone: phone ?? null,
  });
  return !error;
}

export async function markCalendarAdded(db: DB): Promise<boolean> {
  const { error } = await db.rpc("challenge_mark_calendar_added");
  return !error;
}

/* ── pure derivations (no clocks) ─────────────────────────────────────────── */

/** The pre-season week a beat belongs to, given the server phase + beats. */
export function currentWeek(beats: ChallengeBeat[], serverNowIso: string): number {
  const now = new Date(serverNowIso).getTime();
  let week = 1;
  for (const b of beats) {
    if (new Date(b.opens_at).getTime() <= now) week = Math.max(week, b.week);
  }
  return week;
}

/**
 * "Today's one thing" — the single next step the HQ points at. The rule is
 * deliberately boring: the earliest incomplete beat in the current week, else
 * the earliest incomplete beat in any open past week (catch-up), else null.
 * One next step, never a to-do list.
 */
export function todaysOneThing(
  beats: ChallengeBeat[],
  serverNowIso: string
): ChallengeBeat | null {
  const week = currentWeek(beats, serverNowIso);
  const open = beats.filter((b) => b.open && !b.completed_at);
  return (
    open.find((b) => b.week === week) ??
    open.sort((a, b) => a.week - b.week || a.sort - b.sort)[0] ??
    null
  );
}

/** The day the challenge surface should lead with, given server-derived state. */
export function activeDay(days: ChallengeDay[]): ChallengeDay | null {
  return (
    days.find((d) => d.state === "live") ??
    days.find((d) => d.state === "open") ??
    days.find((d) => d.state === "missed") ??
    days.find((d) => d.state === "locked") ??
    days[days.length - 1] ??
    null
  );
}

export const PHASE_LABEL: Record<ChallengePhase, string> = {
  pre_open: "Opening soon",
  preseason: "Pre-season",
  forming: "Cohort forming",
  live: "Challenge week",
  aftermath: "Finisher week",
  closed: "Closed",
};

/**
 * Cohort copy under the floor. The canvas draws "2,847 in" and "1,942 doing
 * this right now"; production is a handful. Below the floor we say something
 * TRUE about being early instead of printing a number that reads as failure —
 * and above it we print the real count.
 */
export function cohortLine(counts: {
  members: number;
  below_floor: boolean;
}): string {
  if (!counts.below_floor) return `${counts.members.toLocaleString()} in your cohort`;
  if (counts.members <= 1) return "You are the first one in";
  return "You are one of the first members of this cohort";
}
