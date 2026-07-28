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

/* ── Narration — the AUDIO-FIRST layer ──────────────────────────────────
   A lesson is SPOKEN. Kai says the teaching copy; the screen holds only the
   drawing for that beat, one short line of large type, and the interaction.
   Nobody reads a wall.

   The audio is PRE-GENERATED (scripts/build-lesson-audio.mjs, OpenAI
   gpt-4o-mini-tts, voice `ash`) and served as a static file. There is NO
   runtime TTS: a lesson costs nothing to replay, works offline-ish behind the
   service worker, and sounds identical for every member forever.

   `say` is the SCRIPT — the approved curriculum prose, segmented, never
   rewritten. It doubles as the caption text when captions are on, so the
   caption can never drift from the audio. */
export interface AudioAsset {
  /** Public path of the pre-generated mp3 (under /lessons/audio/…). */
  url: string;
  /** Measured length of that exact file, ms — written by the build script,
   *  never estimated at runtime. Drives "advance when the voice stops". */
  durationMs: number;
  /** The exact words in the file. Shown when captions are on. */
  say: string;
}

/** Narration segments for one step / lesson, keyed by ROLE.
 *
 *  Roles are stable strings the components look up directly:
 *    "prompt" · "reinforce" · "explanation" · "reask" · "wrong:<optIdx>"
 *    "reveal:<n>" · "guide:<value>" · "guide:correct" · "guide:wrong"
 *    "success" — and, on the lesson envelope, "intro" / "outro".
 *
 *  Absent roles simply have no voice; every component degrades to silent text,
 *  so a half-generated lesson still runs. */
export type StepAudio = Record<string, AudioAsset>;

/** One SPOKEN BEAT of an explainer: 1–3 sentences of narration paired with the
 *  visual state that holds while they are spoken. The drawing changes on the
 *  segment boundary — beat N starts, figure N animates in. That is the whole
 *  sync model; there is no word-level karaoke. */
export interface ExplainerBeat {
  /** Stable id within the step — also the mp3 basename suffix. */
  id: string;
  /** What Kai SAYS. Approved prose, segmented — never rewritten for audio. */
  say: string;
  /** The ONE line of large type on screen for this beat. A headline or a
   *  keyword, never the paragraph — the paragraph is the voice's job. */
  headline?: string;
  /** Optional large figure/number held beside the drawing for this beat. */
  key?: { value: string; caption?: string };
  /** Teaching-object state for this beat. */
  illustration?: LessonIllustration;
  /** `walk_up` illustrations: start the consume motion on this beat, so the
   *  book is eaten while the sentence describing it is being spoken. */
  playWalk?: boolean;
  /** Filled in by scripts/build-lesson-audio.mjs. */
  audio?: AudioAsset;
}

/* ── Step specs ─────────────────────────────────────────────────────────── */

export interface BaseStep {
  /** Stable id, unique within the lesson (used for resume + de-dupe). */
  id: string;
  type: string;
  /** Skill this interaction updates (skill_mastery). Optional. */
  skill?: SkillId;
  /** Pre-generated narration for this step, keyed by role. See StepAudio. */
  audio?: StepAudio;
}

/** Non-interactive concept/explanation block. Continue to advance.
 *
 *  AUDIO-FIRST: authored `beats` are the real presentation — Kai talks through
 *  them one at a time while the drawing changes underneath. `body` is kept as
 *  the source prose (and the silent/no-audio fallback), but when `beats` is
 *  present the paragraphs are never rendered as a wall of text. */
export interface ExplainerStep extends BaseStep {
  type: "explainer";
  heading?: string;
  /** Paragraphs. Source of truth for the narration script; not the screen. */
  body: string[];
  /** Optional pull-quote / big-number figure shown alongside. */
  figure?: { kind: "stat" | "quote"; value: string; caption?: string };
  /** Optional authored teaching object drawn under the prose. */
  illustration?: LessonIllustration;
  /** The spoken beat sequence. Each beat = one audio segment + one visual. */
  beats?: ExplainerBeat[];
}

/* ── Scene ──────────────────────────────────────────────────────────────
   The micro-lesson figure (canvas App 21): the tape that sets up the
   question — "the company beat earnings but the stock dropped 8%".

   AUTHORED, NOT LIVE. These are hand-written teaching shapes, never a real
   quote feed, so a lesson reads the same in five years. `points` are
   normalised 0–1 heights in time order; the leg colours are DERIVED from
   those points, not declared, so the drawing can never contradict itself.

   COLOUR: the two legs are genuine price, so they wear text-price-up /
   text-price-down. The event marker is the accent (it is the annotation,
   not the price). Nothing here is a directive verdict. */
export interface LessonSceneSpec {
  kind: "price_event";
  /** Mono caption above the figure, e.g. "The tape around the print". */
  caption?: string;
  /** Normalised 0–1 heights, in time order. Minimum two. */
  points: number[];
  /** Index in `points` where the event landed (the pivot the legs split on). */
  eventIndex: number;
  /** Short mono tag at the pivot, e.g. "EPS BEAT". */
  eventLabel?: string;
  /** Short mono tag at the last point, e.g. "−8%". */
  endLabel?: string;
}

/* ── Illustration ───────────────────────────────────────────────────────
   The authored TEACHING OBJECT (CURRICULUM-OVERVIEW §6): "objects, not
   scenes". A named drawing with identity that is reused across a phase and
   accumulates meaning — never a stock scene, never a generic container.

   `order_book` is the first: two facing ladders of resting orders with the
   gap between them measured. It is drawn hand-ruled (bar lengths deliberately
   uneven), ink for structure, the accent for the ONE thing being pointed at
   (best bid / best ask), gold for annotation only. It returns on Day 9 and
   Day 27, so it lives in the schema rather than inside one lesson.

   The numbers are AUTHORED and dated in the lesson JSON — never a live feed —
   so a lesson reads identically in five years. */
export interface OrderBookIllustration {
  kind: "order_book";
  /** `ladder` = one book. `before_after` = the same book twice, one variable
   *  changed, so the change is legible. `walk_up` = a book that gets eaten. */
  mode: "ladder" | "before_after" | "walk_up";
  /** Resting bids, best (highest) first. */
  bids: string[];
  /** Resting asks, best (lowest) first. */
  asks: string[];
  /** Gold hairline label across the gap. */
  spreadLabel?: string;
  /** Draw the gold measure across the gap at all. Default true. Set false for
   *  the BEAT that shows the two ladders BEFORE the voice has named the spread —
   *  the measurement arriving on the next beat is the whole point of splitting
   *  them, and a measure drawn before it is spoken gives the answer away. */
  showSpread?: boolean;
  /** `before_after` only — the second state of the same drawing. */
  after?: { bids: string[]; asks: string[]; label?: string };
  /** `before_after` only — label on the first state. */
  beforeLabel?: string;
  /** `walk_up` only — the running price printed above the book while the
   *  ask side is consumed, in order. Last entry is where it settles. */
  walkPrices?: string[];
  /** Mono caption under the figure — the dated provenance line. */
  caption?: string;
}

export type LessonIllustration = OrderBookIllustration;

/** Multiple choice (QuizPanel restyle, single question).
 *
 *  THIS IS ALSO THE MICRO-LESSON FORMAT (canvas App 21). A lesson whose
 *  `steps` array holds a single `multiple_choice` step with a `scene` IS a
 *  micro-lesson: one framed question, an authored figure, four choices, one
 *  Check. It runs through <LessonEngine> like any other lesson, which means
 *  it writes the SAME lesson_progress / quiz_attempts / xp_events intents —
 *  there is deliberately no second XP path for micro-lessons. */
export interface MultipleChoiceStep extends BaseStep {
  type: "multiple_choice";
  question: string;
  /** One word or phrase inside `question` to annotate with the drawn mark. */
  framing?: string;
  /** Optional authored figure drawn above the choices. */
  scene?: LessonSceneSpec;
  options: string[];
  correctIndex: number;
  /** Shown after a wrong pick, before the mastery-loop re-ask. */
  explanation?: string;
  /** PER-OPTION wrong-answer feedback, parallel to `options`.
   *
   *  The curriculum's rule is that feedback must name WHY the wrong option was
   *  tempting, which means it cannot be one string for four different mistakes.
   *  A `kai: true` entry is spoken in the guide's voice and carries its own
   *  hand-back to the question; a plain entry is the note, followed by the
   *  engine's re-ask line. Missing / null entries fall back to `explanation`. */
  wrongFeedback?: ({ text: string; kai?: boolean } | null)[];
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
  /** Authored teaching object shown WITH the question — the thing the member is
   *  predicting against. On reveal it plays its outcome motion (a `walk_up`
   *  book is consumed level by level while the price counts up). */
  illustration?: LessonIllustration;
  reveal: {
    headline: string;
    body: string;
    /** The authored price figure for the reveal — the tape the outcome left
     *  behind. Hand-written points, never a live quote. */
    scene?: LessonSceneSpec;
  };
  /** Authored guide line shown only when the member picked this value — the
   *  "that was the smartest wrong answer, and here is why" beat. */
  guideOn?: { value: string; line: string };
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
  /** Lesson-level narration: "intro" (spoken off the Start press, which is also
   *  the gesture that arms audio) and "outro" (spoken on the completion card). */
  audio?: StepAudio;
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
  /** Quiet "+N XP" line a step may show beside its action, supplied by the
   *  engine. It is ABSENT once the lesson's XP has already been banked, so the
   *  number is never a promise the de-duped award will not keep. */
  xpNote?: string;
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
      audio: env.audio,
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
