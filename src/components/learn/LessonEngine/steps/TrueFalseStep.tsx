"use client";

import type {
  TrueFalseStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { StepPrompt } from "../ui";
import ChoiceCore from "../ChoiceCore";
import { useNarration } from "../audio";

/** True / false as a two-choice swipe-style decision (big tap targets). */
export default function TrueFalseStep({
  spec,
  register,
  soundOn,
  xpNote,
  onResolve,
}: StepComponentProps<Spec>) {
  // The statement is spoken as it is shown — it IS the question.
  useNarration(spec.audio?.prompt, `${spec.id}:prompt`);
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
        narration={{
          reinforce: spec.audio?.reinforce,
          explanation: spec.audio?.explanation,
          reask: spec.audio?.reask,
        }}
        cue={spec.id}
        layout="split"
        showLetters={false}
        reaskLabel="Read it once more, then decide."
        ariaLabel="True or false"
        footerNote={xpNote}
      />
    </div>
  );
}
