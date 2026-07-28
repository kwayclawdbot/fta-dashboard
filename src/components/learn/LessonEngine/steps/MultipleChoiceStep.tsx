"use client";

import type {
  MultipleChoiceStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { StepPrompt } from "../ui";
import ChoiceCore from "../ChoiceCore";
import LessonScene from "../LessonScene";
import { useNarration } from "../audio";

/**
 * Multiple choice — and, with a `scene`, the MICRO-LESSON format (canvas App
 * 21): one framed question, an authored figure of the tape, four choices, one
 * Check. A lesson whose steps array is a single one of these IS a micro-lesson;
 * it runs through <LessonEngine> and therefore writes the same lesson_progress
 * / quiz_attempts / xp_events intents as any other lesson. There is deliberately
 * no second XP path.
 */
export default function MultipleChoiceStep({
  spec,
  register,
  soundOn,
  xpNote,
  onResolve,
}: StepComponentProps<Spec>) {
  // The question is SPOKEN and shown — a question is the one thing that has to
  // be on screen while it is answered, so this is the only text that stays.
  useNarration(spec.audio?.prompt, `${spec.id}:prompt`);
  return (
    <div>
      <StepPrompt mark={spec.framing}>{spec.question}</StepPrompt>
      {spec.scene && <LessonScene scene={spec.scene} />}
      {/* No caption on the prompt: the question is already on screen in full,
          so a transcript of it would just be the same words twice. */}
      <ChoiceCore
        options={spec.options.map((label) => ({ label }))}
        correctIndex={spec.correctIndex}
        explanation={spec.explanation}
        reinforce={spec.reinforce}
        register={register}
        soundOn={soundOn}
        onResolve={onResolve}
        feedbackFor={(i) => spec.wrongFeedback?.[i] ?? null}
        narration={{
          reinforce: spec.audio?.reinforce,
          explanation: spec.audio?.explanation,
          reask: spec.audio?.reask,
          wrongFor: (i) => spec.audio?.[`wrong:${i}`],
        }}
        cue={spec.id}
        layout="list"
        ariaLabel="Answer choices"
        footerNote={xpNote}
      />
    </div>
  );
}
