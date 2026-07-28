/**
 * NARRATION — the one enumeration of everything Kai says in a lesson.
 *
 * A lesson is spoken, so every line of authored copy that can reach a member's
 * ears has to be findable by a build script BEFORE the lesson ships. This module
 * is that single list. `enumerateNarration()` walks a typed lesson and returns
 * one entry per mp3 that must exist; `applyNarration()` writes the generated
 * assets back onto the same lesson object at exactly the roles the components
 * look up. Generator and renderer therefore cannot disagree about what a file is
 * called or where it hangs — a whole class of "the voice says the old copy" bug
 * is impossible by construction.
 *
 * IT IS ALSO THE COMPLIANCE SURFACE. Everything spoken is authored curriculum
 * prose plus a handful of engine chrome lines defined right here. There is no
 * live LLM anywhere in this path, so nothing a member hears was invented at
 * runtime — which is the entire reason the audio is pre-generated.
 *
 * TYPE-ONLY IMPORTS. scripts/build-lesson-audio.mjs imports this file directly
 * under Node's type stripping, where the `@/` alias does not resolve. Value
 * imports from `@/…` would break the build script; keep them typed.
 */

import type {
  AudioAsset,
  ExplainerStep,
  LessonJSON,
  MultipleChoiceStep,
  MatchPairsStep,
  PredictionStep,
  RealWorldStep,
  StepSpec,
  TrueFalseStep,
} from "@/lib/learn/schema";

/* ── engine chrome, spoken ──────────────────────────────────────────────
   The few lines that are NOT curriculum copy but still reach the ear. They
   live here, once, so the generator and the components read the same string.
   Changing one of these means regenerating audio — which is the point. */

export const REASK_LINE = {
  multiple_choice: "Let's try that again.",
  true_false: "Read it once more, then decide.",
  match_pairs: "Let's try that again.",
} as const;

export const PREDICTION_GUIDE = {
  correct: "You called it. That's the read of an investor.",
  wrong: "Not the call you made — and that's exactly how you learn to read one.",
} as const;

/* ── the enumeration ────────────────────────────────────────────────────── */

export interface NarrationTarget {
  /** Where the finished asset is written back. */
  kind: "lesson" | "step" | "beat";
  /** Step id — absent for lesson-level segments. */
  stepId?: string;
  /** Beat id — `beat` targets only. */
  beatId?: string;
  /** Role key inside `audio` — `lesson` and `step` targets only. */
  role?: string;
}

export interface NarrationSegment {
  /** mp3 basename, no extension: `<step-id>[-variant]`. */
  file: string;
  /** The words in the file. */
  say: string;
  target: NarrationTarget;
}

/** Keep a segment SHORT. The rule the curriculum inherits: 1–3 sentences, and
 *  never more than this many characters, because a beat longer than about
 *  twenty seconds is a paragraph being read aloud — the exact thing audio-first
 *  is replacing. The build script fails on a violation rather than shipping it. */
export const MAX_SEGMENT_CHARS = 420;

function push(
  out: NarrationSegment[],
  file: string,
  say: string | undefined | null,
  target: NarrationTarget
): void {
  const text = (say ?? "").trim();
  if (!text) return;
  out.push({ file, say: text, target });
}

/** Every mp3 a lesson needs, in play order. */
export function enumerateNarration(lesson: LessonJSON): NarrationSegment[] {
  const out: NarrationSegment[] = [];

  push(out, "lesson-intro", lesson.guide?.intro, {
    kind: "lesson",
    role: "intro",
  });

  for (const step of lesson.steps) {
    const id = step.id;
    switch (step.type) {
      case "explainer": {
        const s = step as ExplainerStep;
        for (const beat of s.beats ?? []) {
          push(out, `${id}-${beat.id}`, beat.say, {
            kind: "beat",
            stepId: id,
            beatId: beat.id,
          });
        }
        break;
      }
      case "multiple_choice": {
        const s = step as MultipleChoiceStep;
        push(out, id, s.question, { kind: "step", stepId: id, role: "prompt" });
        push(out, `${id}-reinforce`, s.reinforce, {
          kind: "step",
          stepId: id,
          role: "reinforce",
        });
        push(out, `${id}-explanation`, s.explanation, {
          kind: "step",
          stepId: id,
          role: "explanation",
        });
        let needsReask = false;
        s.options.forEach((_, i) => {
          if (i === s.correctIndex) return;
          const fb = s.wrongFeedback?.[i];
          if (fb?.text) {
            push(out, `${id}-wrong-${i}`, fb.text, {
              kind: "step",
              stepId: id,
              role: `wrong:${i}`,
            });
          }
          // A `kai: true` line hands the question back itself; anything else is
          // followed on screen by the engine's re-ask, so that gets a voice too.
          if (!fb?.kai) needsReask = true;
        });
        if (needsReask)
          push(out, `${id}-reask`, REASK_LINE.multiple_choice, {
            kind: "step",
            stepId: id,
            role: "reask",
          });
        break;
      }
      case "true_false": {
        const s = step as TrueFalseStep;
        push(out, id, s.statement, { kind: "step", stepId: id, role: "prompt" });
        push(out, `${id}-reinforce`, s.reinforce, {
          kind: "step",
          stepId: id,
          role: "reinforce",
        });
        push(out, `${id}-explanation`, s.explanation, {
          kind: "step",
          stepId: id,
          role: "explanation",
        });
        push(out, `${id}-reask`, REASK_LINE.true_false, {
          kind: "step",
          stepId: id,
          role: "reask",
        });
        break;
      }
      case "match_pairs": {
        const s = step as MatchPairsStep;
        push(out, id, s.prompt, { kind: "step", stepId: id, role: "prompt" });
        push(out, `${id}-reinforce`, s.reinforce, {
          kind: "step",
          stepId: id,
          role: "reinforce",
        });
        push(out, `${id}-explanation`, s.explanation, {
          kind: "step",
          stepId: id,
          role: "explanation",
        });
        push(out, `${id}-reask`, REASK_LINE.match_pairs, {
          kind: "step",
          stepId: id,
          role: "reask",
        });
        break;
      }
      case "prediction": {
        const s = step as PredictionStep;
        push(out, id, s.question, { kind: "step", stepId: id, role: "prompt" });
        // The reveal is a WALK-UP, not a slab: the headline, then each authored
        // paragraph, each with its own segment so the book can be eaten and the
        // price counted while the matching sentence is spoken.
        push(out, `${id}-reveal-0`, s.reveal.headline, {
          kind: "step",
          stepId: id,
          role: "reveal:0",
        });
        s.reveal.body
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean)
          .forEach((para, i) =>
            push(out, `${id}-reveal-${i + 1}`, para, {
              kind: "step",
              stepId: id,
              role: `reveal:${i + 1}`,
            })
          );
        if (s.guideOn)
          push(out, `${id}-guide-${s.guideOn.value}`, s.guideOn.line, {
            kind: "step",
            stepId: id,
            role: `guide:${s.guideOn.value}`,
          });
        push(out, `${id}-guide-correct`, PREDICTION_GUIDE.correct, {
          kind: "step",
          stepId: id,
          role: "guide:correct",
        });
        push(out, `${id}-guide-wrong`, PREDICTION_GUIDE.wrong, {
          kind: "step",
          stepId: id,
          role: "guide:wrong",
        });
        break;
      }
      case "real_world": {
        const s = step as RealWorldStep;
        push(out, id, s.prompt, { kind: "step", stepId: id, role: "prompt" });
        push(out, `${id}-success`, s.successText, {
          kind: "step",
          stepId: id,
          role: "success",
        });
        break;
      }
    }
  }

  push(out, "lesson-outro", lesson.guide?.outro, {
    kind: "lesson",
    role: "outro",
  });

  return out;
}

/** Write generated assets back onto the lesson, in place, at the roles the
 *  components read. Unknown files are ignored; missing ones simply leave that
 *  line silent (every component degrades to text). */
export function applyNarration(
  lesson: LessonJSON,
  assets: Record<string, AudioAsset>
): number {
  let applied = 0;
  const byId = new Map<string, StepSpec>(lesson.steps.map((s) => [s.id, s]));

  for (const seg of enumerateNarration(lesson)) {
    const asset = assets[seg.file];
    if (!asset) continue;
    const { kind, stepId, beatId, role } = seg.target;

    if (kind === "lesson" && role) {
      lesson.audio = { ...(lesson.audio ?? {}), [role]: asset };
      applied++;
      continue;
    }
    const step = stepId ? byId.get(stepId) : undefined;
    if (!step) continue;

    if (kind === "step" && role) {
      step.audio = { ...(step.audio ?? {}), [role]: asset };
      applied++;
    } else if (kind === "beat" && beatId && step.type === "explainer") {
      const beat = (step as ExplainerStep).beats?.find((b) => b.id === beatId);
      if (beat) {
        beat.audio = asset;
        applied++;
      }
    }
  }
  return applied;
}

/** Total spoken length of a lesson, ms — the honest "how long is this" number
 *  once audio exists, measured from the files rather than guessed from words. */
export function narratedMs(lesson: LessonJSON): number {
  let ms = 0;
  const add = (a?: AudioAsset) => {
    if (a) ms += a.durationMs;
  };
  Object.values(lesson.audio ?? {}).forEach(add);
  for (const step of lesson.steps) {
    Object.values(step.audio ?? {}).forEach(add);
    if (step.type === "explainer")
      (step as ExplainerStep).beats?.forEach((b) => add(b.audio));
  }
  return ms;
}
