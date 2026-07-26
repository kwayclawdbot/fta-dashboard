"use client";

import { useMemo } from "react";
import type {
  MultipleChoiceStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { getLessonSkin } from "../skin";
import { StepPrompt } from "../ui";
import ChoiceCore from "../ChoiceCore";

/** Multiple choice — single-question, mastery-loop step with the correct-pop. */
export default function MultipleChoiceStep({
  spec,
  register,
  soundOn,
  onResolve,
}: StepComponentProps<Spec>) {
  const skin = useMemo(() => getLessonSkin(register), [register]);
  return (
    <div>
      <StepPrompt skin={skin} eyebrow="Question">
        {spec.question}
      </StepPrompt>
      <ChoiceCore
        options={spec.options.map((label) => ({ label }))}
        correctIndex={spec.correctIndex}
        explanation={spec.explanation}
        reinforce={spec.reinforce}
        skin={skin}
        soundOn={soundOn}
        onResolve={onResolve}
        layout="list"
      />
    </div>
  );
}
