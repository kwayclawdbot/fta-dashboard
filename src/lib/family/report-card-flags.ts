/**
 * REPORT-CARD FLAGS — a diagnosis and its prescription, kept together.
 *
 * ── THE BUG THIS FILE EXISTS TO KILL ─────────────────────────────────────────
 * The coach's note on /family/overview read, on both children:
 *
 *   "This week, the best next step is to No pattern or game practice in the
 *    last 7 days."
 *
 * The needs-work list is written as DIAGNOSES — statements of what is currently
 * true, phrased to read as bullets under a "Needs work" heading. The note's
 * deterministic fallback then dropped `needsWork[0]` straight into
 * "the best next step is to ___", a slot that only accepts an IMPERATIVE. Every
 * label in the list broke that sentence, not just this one, because none of
 * them were ever written to complete it.
 *
 * A label and the action it implies are two different strings, so they are
 * modelled as two fields of one object. Anything that adds a flag from now on
 * has to write both, and the sentence cannot break again.
 */

export interface NeedsWorkFlag {
  /** Reads as a bullet: what is true right now. */
  label: string;
  /** Reads after "the best next step is to ___": what to do about it. */
  nextStep: string;
}

/** The note's closing clause when nothing is flagged at all. */
export const DEFAULT_NEXT_STEP =
  "keep a steady daily rhythm with the Daily 5 flashcards";

interface StatsForFlags {
  behind_count: number;
  quiz_low: number;
  last_practice_at: string | null;
  last_flashcard_at: string | null;
}

function olderThanDays(iso: string | null, days: number): boolean {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > days * 86400000;
}

/**
 * Impure (reads the clock) — callers must run this in an effect, never in
 * render.
 */
export function buildNeedsWork(s: StatsForFlags): NeedsWorkFlag[] {
  const out: NeedsWorkFlag[] = [];
  if (s.behind_count > 0) {
    const n = s.behind_count;
    out.push({
      label: `Behind pace — ${n} unlocked lesson${n === 1 ? "" : "s"} still open`,
      nextStep: `finish ${n === 1 ? "the open lesson" : "one of the open lessons"} before the week turns over`,
    });
  }
  if (s.quiz_low > 0) {
    const n = s.quiz_low;
    out.push({
      label: `${n} quiz${n === 1 ? "" : "zes"} below 70% — retake suggested`,
      nextStep: `retake the quiz${n === 1 ? "" : "zes"} that came in under 70%`,
    });
  }
  if (olderThanDays(s.last_practice_at, 7)) {
    out.push({
      label: "No pattern or game practice in the last 7 days",
      nextStep: "get back into pattern practice — one session this week is enough to restart it",
    });
  }
  if (olderThanDays(s.last_flashcard_at, 7)) {
    out.push({
      label: "No flashcard reviews in the last 7 days",
      nextStep: "run the Daily 5 flashcards together once this week",
    });
  }
  return out;
}

/**
 * Recover the action for a label that arrived on its own — an older client, or
 * a note regenerated from a cached payload that predates `nextSteps`. Matching
 * is on the stable, non-numeric part of each label.
 */
export function nextStepForLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const l = label.toLowerCase();
  if (l.includes("behind pace")) return "close out an open lesson before the week turns over";
  if (l.includes("below 70%")) return "retake the quizzes that came in under 70%";
  if (l.includes("pattern or game practice"))
    return "get back into pattern practice — one session this week is enough to restart it";
  if (l.includes("flashcard reviews")) return "run the Daily 5 flashcards together once this week";
  return null;
}
