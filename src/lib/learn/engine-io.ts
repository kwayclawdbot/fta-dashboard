/**
 * Learning World — engine IO layer.
 *
 * Wraps the EXACT three write intents the legacy iframe bridge + LessonViewer
 * write today, so every downstream surface (belts, leaderboards, report cards,
 * get_home_state, badges) keeps working with no changes:
 *
 *   1. lesson_progress upsert (section progress / complete)
 *   2. quiz_attempts insert + quiz XP (graded result)
 *   3. awardXp('lesson', …) with (kind, ref_id) de-dupe + belt-crossing celebrate
 *
 * Plus two additive-only writes new to P2:
 *   • lesson_step_progress upsert (resume detail — never touches lesson_progress)
 *   • bump_skill_mastery RPC (deterministic, zero LLM)
 *
 * All own-row RLS scoped; every write is best-effort (never throws into the UI).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { XP, awardXp, hasXpForRef, getUserXp } from "@/lib/xp";
import { beltCelebrateFields } from "@/lib/belts";
import { celebrateRegister, type Register } from "@/lib/register";
import type { CelebrateOptions } from "@/components/fic/Celebrate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

/** Persist resume position. Monotonic-forward; additive to lesson_progress. */
export async function saveStepProgress(
  supabase: DB,
  userId: string,
  lessonId: string,
  stepIndex: number,
  stepState: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from("lesson_step_progress").upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        step_index: stepIndex,
        step_state: stepState,
      },
      { onConflict: "user_id,lesson_id" }
    );
  } catch {
    /* non-fatal */
  }
}

/** Hydrate resume position for a lesson. Returns 0 when none / on error. */
export async function loadStepProgress(
  supabase: DB,
  userId: string,
  lessonId: string
): Promise<{ stepIndex: number; stepState: Record<string, unknown> }> {
  try {
    const { data } = await supabase
      .from("lesson_step_progress")
      .select("step_index, step_state")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .maybeSingle();
    if (data) {
      return {
        stepIndex: (data.step_index as number) ?? 0,
        stepState: (data.step_state as Record<string, unknown>) ?? {},
      };
    }
  } catch {
    /* non-fatal */
  }
  return { stepIndex: 0, stepState: {} };
}

/** Deterministic per-interaction mastery bump (RPC in migration 166). */
export async function bumpMastery(
  supabase: DB,
  skillId: string,
  correct: boolean
): Promise<void> {
  try {
    await supabase.rpc("bump_skill_mastery", {
      p_skill_id: skillId,
      p_correct: correct,
    });
  } catch {
    /* non-fatal */
  }
}

/**
 * Mark the lesson complete — byte-for-byte the legacy write path:
 * lesson_progress upsert (status completed, 100%) + one-time lesson XP +
 * belt-crossing celebration payload. Returns the celebrate options to enqueue
 * (level-up / belt ceremony) or null.
 */
export async function completeLesson(
  supabase: DB,
  userId: string,
  lessonId: string,
  register: Register,
  lessonXp: number
): Promise<CelebrateOptions | null> {
  try {
    await supabase.from("lesson_progress").upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        status: "completed",
        progress_pct: 100,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" }
    );

    if (!(await hasXpForRef(supabase, userId, "lesson", lessonId))) {
      const prevXp = await getUserXp(supabase, userId);
      await awardXp(supabase, userId, "lesson", lessonXp, lessonId);
      const belt = beltCelebrateFields(
        prevXp,
        prevXp + lessonXp,
        register === "kid"
      );
      if (belt) {
        return {
          variant: "levelup",
          register: celebrateRegister(register),
          ...belt,
        };
      }
    }
  } catch {
    /* non-fatal */
  }
  return null;
}

/**
 * Record the lesson's graded steps as a quiz attempt (report-card data) + award
 * quiz XP — identical intents to the legacy QuizPanel path. Safe to skip when
 * the lesson has no quiz row (quizId null).
 */
export async function recordQuizAttempt(
  supabase: DB,
  userId: string,
  quizId: string | null,
  score: number,
  passed: boolean,
  answers: unknown[]
): Promise<void> {
  if (!quizId) return;
  try {
    await supabase.from("quiz_attempts").insert({
      user_id: userId,
      quiz_id: quizId,
      score,
      passed,
      answers,
    });
    if (passed && !(await hasXpForRef(supabase, userId, "quiz", quizId))) {
      await awardXp(supabase, userId, "quiz", XP.QUIZ_PASS, quizId);
      if (score >= 100) {
        await awardXp(
          supabase,
          userId,
          "bonus",
          XP.QUIZ_PERFECT_BONUS,
          `${quizId}-perfect`
        );
      }
    }
  } catch {
    /* non-fatal */
  }
}

/**
 * Real-world action check for `research_ticker`: did the member actually come
 * back from the quote with something to show for it?
 *
 * The rep for this skill is READING a live two-sided quote and forming a view,
 * so the artifact we accept is a real one — a stance the member recorded on the
 * ticker (ticker_stances, own-row RLS), or the ticker sitting on the family
 * watchlist. Opening a tab is not evidence; a written stance is. Returns false
 * on any error, so a member is never told they did something they did not.
 */
export async function checkResearchedTicker(
  supabase: DB,
  userId: string | null,
  familyId: string | null,
  ticker: string
): Promise<boolean> {
  const t = ticker.toUpperCase();
  if (userId) {
    try {
      const { count } = await supabase
        .from("ticker_stances")
        .select("ticker", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("ticker", t);
      if ((count || 0) > 0) return true;
    } catch {
      /* fall through to the watchlist artifact */
    }
  }
  return checkWatchlistHas(supabase, familyId, t);
}

/** Real-world action check: does the family already watch this ticker? */
export async function checkWatchlistHas(
  supabase: DB,
  familyId: string | null,
  ticker: string
): Promise<boolean> {
  if (!familyId) return false;
  try {
    const { count } = await supabase
      .from("family_watchlist")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId)
      .eq("ticker", ticker.toUpperCase());
    return (count || 0) > 0;
  } catch {
    return false;
  }
}
