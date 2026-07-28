"use client";

import { useMemo, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import type { Register } from "@/lib/register";
import type { StepResult } from "@/lib/learn/schema";
import { playCue } from "@/lib/learn/feedback";
import {
  ChoiceGroup,
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
  ariaLabel = "Answer choices",
  footerNote,
  feedbackFor,
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
  ariaLabel?: string;
  /** Quiet line beside Check (the canvas's "+10 XP"). Callers must only pass
   *  XP that will actually be awarded — see LessonEngine's xpNote. */
  footerNote?: string;
  /** Resolve the feedback for the option the member actually picked, so a
   *  wrong answer is answered with the reason THAT option was tempting rather
   *  than one generic line for four different mistakes. */
  feedbackFor?: (optIdx: number) => { text: string; kai?: boolean } | null | undefined;
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

  // The roving tab stop: the chosen answer, or the first one when nothing is
  // chosen — an untouched radiogroup must still be reachable by keyboard.
  const focusPos = Math.max(
    0,
    activeOrder.findIndex((optIdx) => optIdx === selected)
  );

  // The authored line for the option they actually picked, when there is one.
  const picked = selected != null ? feedbackFor?.(selected) : null;

  return (
    <div>
      <ChoiceGroup
        ariaLabel={ariaLabel}
        layout={layout}
        count={activeOrder.length}
        disabled={locked}
        onSelect={(pos) => !locked && setSelected(activeOrder[pos])}
      >
        {activeOrder.map((optIdx, pos) => (
          <OptionButton
            key={optIdx}
            label={options[optIdx].label}
            letter={showLetters ? String.fromCharCode(65 + pos) : undefined}
            state={stateFor(optIdx)}
            disabled={locked}
            tabIndex={pos === focusPos ? 0 : -1}
            onClick={() => !locked && setSelected(optIdx)}
          />
        ))}
      </ChoiceGroup>

      <AnimatePresence mode="wait">
        {phase === "first" || phase === "reask" ? (
          <m.div
            key="check"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="f0-rule-top mt-6 flex items-center gap-3 pt-4"
          >
            {/* Board 21's footer bar: the quiet XP note, then the full-width
                Check. The note is only ever XP that will really be banked. */}
            {footerNote && (
              <span
                className="shrink-0 font-mono text-[11px] tabular-nums"
                style={{ color: "color-mix(in srgb, #D99A00 78%, var(--ink))" }}
              >
                {footerNote}
              </span>
            )}
            <PrimaryButton
              onClick={check}
              disabled={selected === null}
              icon="none"
              block
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
            {picked?.kai ? (
              // Kai takes the wrong answer himself: he names why that option
              // was tempting and hands the question straight back, so there is
              // no note repeating him underneath.
              <div className="mt-4">
                <GuideLine register={register}>{picked.text}</GuideLine>
              </div>
            ) : (
              <>
                {picked?.text ?? explanation ? (
                  <FeedbackNote kind="explain">
                    {picked?.text ?? explanation}
                  </FeedbackNote>
                ) : null}
                <div className="mt-4">
                  <GuideLine register={register}>{reaskLabel}</GuideLine>
                </div>
              </>
            )}
            <div className="flex justify-end">
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
              {picked?.text ??
                explanation ??
                "Here's the one — the highlighted answer above."}
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
