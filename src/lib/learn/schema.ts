/**
 * Learning World — lesson step schema (FIC-LEARNING-WORLD §1, proposal §2).
 *
 * The interactive step sequence IS the lesson; video is one block type. A lesson
 * row with a non-null `steps` jsonb renders in <LessonEngine>; null renders in
 * the legacy viewer. These types are the contract between the authored JSON
 * (migration 167 / Lesson Studio later) and the engine's step registry.
 *
 * ZERO LLM in this flow — every string (questions, wrong-answer explanations,
 * guide lines) is authored content stored in the JSON. Kai-generated exercises
 * are a later garnish behind human review.
 */

import type { Register } from "@/lib/register";

export const LESSON_SCHEMA_VERSION = 1 as const;

/** Every interaction step targets zero or one skill for per-step mastery. */
export type SkillId = string;

/* ── Step specs ─────────────────────────────────────────────────────────── */

export interface BaseStep {
  /** Stable id, unique within the lesson (used for resume + de-dupe). */
  id: string;
  type: string;
  /** Skill this interaction updates (skill_mastery). Optional. */
  skill?: SkillId;
}

/** Non-interactive concept/explanation block. Continue to advance. */
export interface ExplainerStep extends BaseStep {
  type: "explainer";
  heading?: string;
  /** Paragraphs. */
  body: string[];
  /** Optional pull-quote / big-number figure shown alongside. */
  figure?: { kind: "stat" | "quote"; value: string; caption?: string };
}

/** Multiple choice (QuizPanel restyle, single question). */
export interface MultipleChoiceStep extends BaseStep {
  type: "multiple_choice";
  question: string;
  options: string[];
  correctIndex: number;
  /** Shown after a wrong pick, before the mastery-loop re-ask. */
  explanation?: string;
  /** Reinforcement shown on the correct pick. */
  reinforce?: string;
}

/** True / false, rendered as a swipe decision. */
export interface TrueFalseStep extends BaseStep {
  type: "true_false";
  statement: string;
  answer: boolean;
  explanation?: string;
  reinforce?: string;
  /** Optional relabel (e.g. "Fact" / "Myth"). */
  trueLabel?: string;
  falseLabel?: string;
}

/** Match pairs — connect left items to their right match. */
export interface MatchPairsStep extends BaseStep {
  type: "match_pairs";
  prompt: string;
  pairs: { left: string; right: string }[];
  explanation?: string;
  reinforce?: string;
}

/** Predict, then reveal the real outcome (never punished — the reveal teaches). */
export interface PredictionStep extends BaseStep {
  type: "prediction";
  question: string;
  options: { label: string; value: string }[];
  /** The value that actually happened. */
  outcomeValue: string;
  reveal: { headline: string; body: string };
}

/** A rendered micro-video block (Track B Remotion outputs: Concept Explainer,
 *  Answer Reveal, Company Breakdown, etc.). Presentation-only + null-safe — a
 *  lesson simply omits this step type until a real asset URL exists. */
export interface MicroVideoStep extends BaseStep {
  type: "micro_video";
  /** mp4/webm asset URL. */
  src: string;
  /** poster shown before play (also the LQIP). */
  poster?: string;
  heading?: string;
  /** short summary / takeaway line under the video. */
  caption?: string;
  /** optional WebVTT captions track URL (caption-friendly). */
  captions?: string;
}

export type RealWorldAction = "save_watchlist" | "research_ticker";

/** The differentiator: escape the lesson into the live product, return with a
 *  real check. save_watchlist verifies a family_watchlist row for `ticker`. */
export interface RealWorldStep extends BaseStep {
  type: "real_world";
  action: RealWorldAction;
  ticker: string;
  company: string;
  prompt: string;
  /** Button copy that deep-links into the product. */
  cta: string;
  /** Shown once the real artifact is detected. */
  successText: string;
}

export type StepSpec =
  | ExplainerStep
  | MicroVideoStep
  | MultipleChoiceStep
  | TrueFalseStep
  | MatchPairsStep
  | PredictionStep
  | RealWorldStep;

export type StepType = StepSpec["type"];

/* ── Lesson envelope ────────────────────────────────────────────────────── */

export interface LessonJSON {
  schema: typeof LESSON_SCHEMA_VERSION;
  title: string;
  skills: SkillId[];
  difficulty: number; // 1–5
  audience: Register[];
  duration_minutes: number;
  xp: number;
  /** Authored guide (Kai) lines — no live LLM. */
  guide?: { intro?: string; outro?: string };
  steps: StepSpec[];
}

/* ── Engine <-> step contract ───────────────────────────────────────────── */

/** What a step reports back to the engine when the member has resolved it. */
export interface StepResult {
  /** Graded steps: did they end up correct? (After the mastery-loop, this is
   *  true — the loop only resolves once corrected.) */
  correct?: boolean;
  /** Was it right on the FIRST attempt? Drives the lesson score + honest
   *  mastery signal. */
  firstTry?: boolean;
  /** Skill to bump (defaults to spec.skill). */
  skill?: SkillId;
}

/** Props every step component receives from the engine. */
export interface StepComponentProps<T extends StepSpec = StepSpec> {
  spec: T;
  register: Register;
  /** Whether the viewer opted into kid sound (from Celebrate's opt-in). */
  soundOn: boolean;
  /** Call once, when the step is fully resolved and the engine may advance. */
  onResolve: (result: StepResult) => void;
}

/** True for step types that produce a graded (correct/incorrect) signal. */
export function isGradedStep(type: StepType): boolean {
  return (
    type === "multiple_choice" ||
    type === "true_false" ||
    type === "match_pairs" ||
    type === "prediction"
  );
}

/** Runtime guard: is this a usable stepped lesson? */
export function isSteppedLesson(steps: unknown): steps is StepSpec[] {
  return Array.isArray(steps) && steps.length > 0;
}

/** Parse a lessons.steps value (jsonb) into a LessonJSON, tolerating either the
 *  full envelope or a bare steps array. Returns null if unusable. */
export function parseLessonSteps(
  raw: unknown,
  fallback: { title: string; xp: number }
): LessonJSON | null {
  if (!raw) return null;
  // Full envelope
  if (
    typeof raw === "object" &&
    raw !== null &&
    "steps" in raw &&
    isSteppedLesson((raw as { steps: unknown }).steps)
  ) {
    const env = raw as Partial<LessonJSON> & { steps: StepSpec[] };
    return {
      schema: LESSON_SCHEMA_VERSION,
      title: env.title ?? fallback.title,
      skills: env.skills ?? [],
      difficulty: env.difficulty ?? 1,
      audience: env.audience ?? ["adult", "teen", "kid"],
      duration_minutes: env.duration_minutes ?? 4,
      xp: env.xp ?? fallback.xp,
      guide: env.guide,
      steps: env.steps,
    };
  }
  // Bare array
  if (isSteppedLesson(raw)) {
    return {
      schema: LESSON_SCHEMA_VERSION,
      title: fallback.title,
      skills: [],
      difficulty: 1,
      audience: ["adult", "teen", "kid"],
      duration_minutes: 4,
      xp: fallback.xp,
      steps: raw,
    };
  }
  return null;
}
