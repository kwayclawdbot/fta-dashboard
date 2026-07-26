"use client";

import { useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { TrendingUp } from "lucide-react";
import type {
  PredictionStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { playCue } from "@/lib/learn/feedback";
import { OptionButton, PrimaryButton, StepPrompt, GuideLine, EASE_OUT } from "../ui";

/**
 * Prediction → reveal. The member commits to a call, THEN sees what actually
 * happened. Being "wrong" is not punished — the reveal is the teaching moment
 * (spec §2 prediction-then-reveal). Mastery still records whether the call
 * matched reality, but there is no mastery-loop re-ask here.
 */
export default function PredictionStep({
  spec,
  register,
  soundOn,
  onResolve,
}: StepComponentProps<Spec>) {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const correct = picked === spec.outcomeValue;

  function reveal() {
    if (picked === null) return;
    playCue(correct ? "correct" : "advance", register, soundOn);
    setRevealed(true);
  }

  return (
    <div>
      <StepPrompt sub="Make your call first. No peeking — that's the fun part.">
        {spec.question}
      </StepPrompt>

      <div className="flex flex-col gap-2.5">
        {spec.options.map((o) => (
          <OptionButton
            key={o.value}
            label={o.label}
            state={
              revealed
                ? o.value === spec.outcomeValue
                  ? "reveal"
                  : picked === o.value
                    ? "wrong"
                    : "idle"
                : picked === o.value
                  ? "selected"
                  : "idle"
            }
            disabled={revealed}
            onClick={() => !revealed && setPicked(o.value)}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {!revealed ? (
          <m.div
            key="lock"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="mt-5 flex justify-end"
          >
            <PrimaryButton onClick={reveal} disabled={picked === null} icon="none">
              Lock it in
            </PrimaryButton>
          </m.div>
        ) : (
          <m.div
            key="reveal"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="mt-5"
          >
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-ink to-night-700 px-5 py-5 text-paper">
              <div className="flex items-center gap-2 text-gold-300">
                <TrendingUp className="h-4 w-4" />
                <span className="font-display text-xs font-bold uppercase tracking-wider">
                  What actually happened
                </span>
              </div>
              <p className="mt-2 font-display text-xl font-bold leading-tight">
                {spec.reveal.headline}
              </p>
              <p className="mt-2 font-body text-sm leading-relaxed text-paper/80">
                {spec.reveal.body}
              </p>
            </div>
            <div className="mt-4">
              <GuideLine register={register}>
                {correct
                  ? "You called it. That's the read of an investor."
                  : "Not the call you made — and that's exactly how you learn to read one."}
              </GuideLine>
            </div>
            <div className="flex justify-end">
              <PrimaryButton
                onClick={() => onResolve({ correct, firstTry: correct })}
                icon="arrow"
              >
                Continue
              </PrimaryButton>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
