"use client";

import type {
  MultipleChoiceStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { StepPrompt } from "../ui";
import ChoiceCore from "../ChoiceCore";
import LessonScene from "../LessonScene";

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
  return (
    <div>
      <StepPrompt mark={spec.framing}>{spec.question}</StepPrompt>
      {spec.scene && <LessonScene scene={spec.scene} />}
      <ChoiceCore
        options={spec.options.map((label) => ({ label }))}
        correctIndex={spec.correctIndex}
        explanation={spec.explanation}
        reinforce={spec.reinforce}
        register={register}
        soundOn={soundOn}
        onResolve={onResolve}
        feedbackFor={(i) => spec.wrongFeedback?.[i] ?? null}
        layout="list"
        ariaLabel="Answer choices"
        footerNote={xpNote}
      />
    </div>
  );
}
