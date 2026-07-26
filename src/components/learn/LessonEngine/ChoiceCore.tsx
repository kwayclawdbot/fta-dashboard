"use client";

import { useMemo, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import type { StepResult } from "@/lib/learn/schema";
import { playCue } from "@/lib/learn/feedback";
import { lessonHaptic, EASE_OUT, type LessonSkin } from "./skin";
import {
  FeedbackNote,
  GuideLine,
  OptionButton,
  PrimaryButton,
  type OptionState,
} from "./ui";

/**
 * The mastery-loop choice engine, shared by multiple_choice and true_false.
 *
 * Binding behavior (FIC-LEARNING-WORLD §1): a wrong answer is NEVER just red +
 * retry. Wrong → the guide EXPLAINS → we immediately re-ask a VARIANT (options
 * reshuffled). Only after the corrected attempt does the step resolve. firstTry
 * drives the honest mastery + lesson-score signal.
 *
 * Track A adds the satisfying-correct moment: register-scaled scale-pop + colour
 * pulse + floating XP tick + haptic, and a warm (never red) wrong→explain beat.
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
  skin,
  soundOn,
  onResolve,
  layout = "list",
  showLetters = true,
  reaskKind = "choice",
}: {
  options: ChoiceOption[];
  correctIndex: number;
  explanation?: string;
  reinforce?: string;
  skin: LessonSkin;
  soundOn: boolean;
  onResolve: (r: StepResult) => void;
  layout?: "list" | "split";
  showLetters?: boolean;
  reaskKind?: "choice" | "tf";
}) {
  const reduce = useReducedMotion();
  const register = skin.mode;
  const [phase, setPhase] = useState<Phase>("first");
  const [selected, setSelected] = useState<number | null>(null);
  const [firstTryCorrect, setFirstTryCorrect] = useState(false);

  const order = useMemo(() => options.map((_, i) => i), [options]);
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
  const reaskLabel = reaskKind === "tf" ? skin.reask.tf : skin.reask.choice;

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
      lessonHaptic(skin, !!reduce);
      if (phase === "first") setFirstTryCorrect(true);
      setPhase("done");
      window.setTimeout(
        () => onResolve({ correct: true, firstTry: phase === "first" }),
        720
      );
      return;
    }
    playCue("wrong", register, soundOn);
    if (phase === "first") setPhase("explaining");
    else setPhase("revealed");
  }

  function toReask() {
    setSelected(null);
    setPhase("reask");
  }

  const showTick = phase === "done" ? skin.motion.xpTick : null;

  return (
    <div>
      <div
        className={
          layout === "split"
            ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
            : "flex flex-col gap-3"
        }
      >
        {activeOrder.map((optIdx, pos) => {
          const st = stateFor(optIdx);
          const isPoppedCorrect = phase === "done" && optIdx === selected && st === "correct";
          return (
            <OptionButton
              key={optIdx}
              label={options[optIdx].label}
              letter={showLetters ? String.fromCharCode(65 + pos) : undefined}
              state={st}
              disabled={locked}
              pop={isPoppedCorrect}
              xpTick={isPoppedCorrect ? showTick : null}
              onClick={() => !locked && setSelected(optIdx)}
            />
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {phase === "first" || phase === "reask" ? (
          <m.div
            key="check"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="mt-6 flex justify-end"
          >
            <PrimaryButton onClick={check} disabled={selected === null} icon="check">
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
            {explanation && <FeedbackNote kind="explain">{explanation}</FeedbackNote>}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <GuideLine skin={skin} pose="thinking">
                  {reaskLabel}
                </GuideLine>
              </div>
              <PrimaryButton onClick={toReask} icon="arrow">
                Try it
              </PrimaryButton>
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
            <div className="mt-5 flex justify-end">
              <PrimaryButton
                onClick={() => onResolve({ correct: true, firstTry: false })}
                icon="arrow"
                tone="ok"
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
