"use client";

import type {
  MultipleChoiceStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { StepPrompt } from "../ui";
import ChoiceCore from "../ChoiceCore";

/** Multiple choice — QuizPanel restyled to a single-question, mastery-loop step. */
export default function MultipleChoiceStep({
  spec,
  register,
  soundOn,
  onResolve,
}: StepComponentProps<Spec>) {
  return (
    <div>
      <StepPrompt>{spec.question}</StepPrompt>
      <ChoiceCore
        options={spec.options.map((label) => ({ label }))}
        correctIndex={spec.correctIndex}
        explanation={spec.explanation}
        reinforce={spec.reinforce}
        register={register}
        soundOn={soundOn}
        onResolve={onResolve}
        layout="list"
      />
    </div>
  );
}
