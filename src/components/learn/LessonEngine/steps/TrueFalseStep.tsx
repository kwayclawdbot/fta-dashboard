"use client";

import { useMemo } from "react";
import type {
  TrueFalseStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { getLessonSkin } from "../skin";
import { StepPrompt } from "../ui";
import ChoiceCore from "../ChoiceCore";

/** True / false as a two-choice decision with big tap targets. */
export default function TrueFalseStep({
  spec,
  register,
  soundOn,
  onResolve,
}: StepComponentProps<Spec>) {
  const skin = useMemo(() => getLessonSkin(register), [register]);
  const trueLabel = spec.trueLabel ?? "True";
  const falseLabel = spec.falseLabel ?? "False";
  // Index 0 = true, 1 = false.
  const correctIndex = spec.answer ? 0 : 1;
  return (
    <div>
      <StepPrompt skin={skin} eyebrow="True or false" sub="Tap the one you believe.">
        {spec.statement}
      </StepPrompt>
      <ChoiceCore
        options={[{ label: trueLabel }, { label: falseLabel }]}
        correctIndex={correctIndex}
        explanation={spec.explanation}
        reinforce={spec.reinforce}
        skin={skin}
        soundOn={soundOn}
        onResolve={onResolve}
        layout="split"
        showLetters={false}
        reaskKind="tf"
      />
    </div>
  );
}
