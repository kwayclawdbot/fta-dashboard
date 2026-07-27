"use client";

import type {
  TrueFalseStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { StepPrompt } from "../ui";
import ChoiceCore from "../ChoiceCore";

/** True / false as a two-choice swipe-style decision (big tap targets). */
export default function TrueFalseStep({
  spec,
  register,
  soundOn,
  xpNote,
  onResolve,
}: StepComponentProps<Spec>) {
  const trueLabel = spec.trueLabel ?? "True";
  const falseLabel = spec.falseLabel ?? "False";
  // Index 0 = true, 1 = false.
  const correctIndex = spec.answer ? 0 : 1;
  return (
    <div>
      <StepPrompt sub="Tap the one you believe.">{spec.statement}</StepPrompt>
      <ChoiceCore
        options={[{ label: trueLabel }, { label: falseLabel }]}
        correctIndex={correctIndex}
        explanation={spec.explanation}
        reinforce={spec.reinforce}
        register={register}
        soundOn={soundOn}
        onResolve={onResolve}
        layout="split"
        showLetters={false}
        reaskLabel="Read it once more, then decide."
        ariaLabel="True or false"
        footerNote={xpNote}
      />
    </div>
  );
}
