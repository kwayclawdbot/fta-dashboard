"use client";

import { useMemo, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import type { Register } from "@/lib/register";
import type { StepResult } from "@/lib/learn/schema";
import { playCue } from "@/lib/learn/feedback";
import {
  FeedbackNote,
  GuideLine,
  OptionButton,
  PrimaryButton,
  EASE_OUT,
  type OptionState,
} from "./ui";

/**
 * The mastery-loop choice engine, shared by multiple_choice and true_false.
 *
 * Binding behavior (FIC-LEARNING-WORLD §1): a wrong answer is NEVER just red +
 * retry. Wrong → the guide EXPLAINS → we immediately re-ask a VARIANT (options
 * reshuffled) of the same question. Only after the corrected attempt does the
 * step resolve. firstTry drives the honest mastery + lesson-score signal.
 */

export interface ChoiceOption {
  label: string;
}

type Phase = "first" | "explaining" | "reask" | "revealed" | "done";

export default function ChoiceCore({
  options,
  correctIndex,
  explanation,
  reinforce,
  register,
  soundOn,
  onResolve,
  layout = "list",
  showLetters = true,
  reaskLabel = "Let's try that again.",
}: {
  options: ChoiceOption[];
  correctIndex: number;
  explanation?: string;
  reinforce?: string;
  register: Register;
  soundOn: boolean;
  onResolve: (r: StepResult) => void;
  layout?: "list" | "split";
  showLetters?: boolean;
  reaskLabel?: string;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("first");
  const [selected, setSelected] = useState<number | null>(null);
  const [firstTryCorrect, setFirstTryCorrect] = useState(false);

  // A "variant" for the re-ask: reshuffle the option order so it is a genuine
  // re-ask, not the identical layout. The correct label is tracked by identity.
  const order = useMemo(
    () => options.map((_, i) => i),
    [options]
  );
  const reaskOrder = useMemo(() => {
    const a = [...order];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [order]);

  const activeOrder = phase === "reask" ? reaskOrder : order;
  const locked = phase === "explaining" || phase === "revealed" || phase === "done";

  function stateFor(optIdx: number): OptionState {
    const isCorrect = optIdx === correctIndex;
    if (phase === "revealed") return isCorrect ? "reveal" : "idle";
    if (phase === "explaining" || phase === "done") {
      if (selected === optIdx) return isCorrect ? "correct" : "wrong";
      if (phase === "done" && isCorrect) return "correct";
      return "idle";
    }
    return selected === optIdx ? "selected" : "idle";
  }

  function check() {
    if (selected === null) return;
    const correct = selected === correctIndex;
    if (correct) {
      playCue("correct", register, soundOn);
      if (phase === "first") setFirstTryCorrect(true);
      setPhase("done");
      // Small dwell so the green state is felt before resolving.
      window.setTimeout(
        () => onResolve({ correct: true, firstTry: phase === "first" }),
        650
      );
      return;
    }
    // Wrong.
    playCue("wrong", register, soundOn);
    if (phase === "first") {
      setPhase("explaining"); // guide explains, then re-ask
    } else {
      // Wrong on the re-ask too — reveal the answer (never leave them stuck).
      setPhase("revealed");
    }
  }

  function toReask() {
    setSelected(null);
    setPhase("reask");
  }

  return (
    <div>
      <div
        className={
          layout === "split"
            ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
            : "flex flex-col gap-2.5"
        }
      >
        {activeOrder.map((optIdx, pos) => (
          <OptionButton
            key={optIdx}
            label={options[optIdx].label}
            letter={showLetters ? String.fromCharCode(65 + pos) : undefined}
            state={stateFor(optIdx)}
            disabled={locked}
            onClick={() => !locked && setSelected(optIdx)}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {phase === "first" || phase === "reask" ? (
          <m.div
            key="check"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="mt-5 flex justify-end"
          >
            <PrimaryButton
              onClick={check}
              disabled={selected === null}
              icon="check"
            >
              Check
            </PrimaryButton>
          </m.div>
        ) : null}

        {phase === "explaining" && (
          <m.div
            key="explain"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            {explanation && (
              <FeedbackNote kind="explain">{explanation}</FeedbackNote>
            )}
            <div className="mt-4">
              <GuideLine register={register}>{reaskLabel}</GuideLine>
              <div className="flex justify-end">
                <PrimaryButton onClick={toReask} icon="arrow">
                  Try it
                </PrimaryButton>
              </div>
            </div>
          </m.div>
        )}

        {phase === "revealed" && (
          <m.div
            key="reveal"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <FeedbackNote kind="explain">
              {explanation
                ? explanation
                : "Here's the one — the highlighted answer above."}
            </FeedbackNote>
            <div className="mt-4 flex justify-end">
              <PrimaryButton
                onClick={() => onResolve({ correct: true, firstTry: false })}
                icon="arrow"
                tone="confirm"
              >
                Got it
              </PrimaryButton>
            </div>
          </m.div>
        )}

        {phase === "done" && firstTryCorrect && reinforce && (
          <m.div
            key="reinforce"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <FeedbackNote kind="correct">{reinforce}</FeedbackNote>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
