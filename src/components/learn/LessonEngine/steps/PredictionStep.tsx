"use client";

import { useMemo, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { TrendingUp } from "lucide-react";
import type {
  PredictionStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { playCue } from "@/lib/learn/feedback";
import { getLessonSkin, lessonHaptic, EASE_OUT } from "../skin";
import { OptionButton, PrimaryButton, StepPrompt, GuideLine } from "../ui";

/**
 * Prediction → reveal. The member commits to a call, THEN sees what actually
 * happened. Being "wrong" is never punished — the reveal is the teaching moment.
 * Mastery records whether the call matched reality; no mastery-loop re-ask.
 */
export default function PredictionStep({
  spec,
  register,
  soundOn,
  onResolve,
}: StepComponentProps<Spec>) {
  const reduce = useReducedMotion();
  const skin = useMemo(() => getLessonSkin(register), [register]);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const correct = picked === spec.outcomeValue;

  function reveal() {
    if (picked === null) return;
    playCue(correct ? "correct" : "advance", register, soundOn);
    if (correct) lessonHaptic(skin, !!reduce);
    setRevealed(true);
  }

  return (
    <div>
      <StepPrompt
        skin={skin}
        eyebrow="Make the call"
        sub="Commit first — no peeking. That's the whole point."
      >
        {spec.question}
      </StepPrompt>

      <div className="flex flex-col gap-3">
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
            className="mt-6 flex justify-end"
          >
            <PrimaryButton onClick={reveal} disabled={picked === null} icon="none">
              Lock it in
            </PrimaryButton>
          </m.div>
        ) : (
          <m.div
            key="reveal"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className="mt-6"
          >
            <div
              className="overflow-hidden rounded-3xl px-6 py-6 text-paper"
              style={{
                background:
                  "radial-gradient(120% 140% at 85% 0%, color-mix(in srgb, var(--l-accent) 40%, transparent) 0%, transparent 55%), linear-gradient(150deg, #12131A 0%, #1B1D28 100%)",
              }}
            >
              <div
                className="flex items-center gap-2"
                style={{ color: "var(--l-accent-b)" }}
              >
                <TrendingUp className="h-4 w-4" />
                <span className="font-display text-[11px] font-black uppercase tracking-[0.18em]">
                  What actually happened
                </span>
              </div>
              <p className="mt-3 font-display text-[26px] font-black leading-[1.1] sm:text-[30px]">
                {spec.reveal.headline}
              </p>
              <p className="mt-3 font-body text-[15px] leading-relaxed text-paper/85">
                {spec.reveal.body}
              </p>
            </div>
            <div className="mt-5">
              <GuideLine skin={skin} pose={correct ? "celebrating" : "thinking"}>
                {correct
                  ? "You called it. That's the read of an investor."
                  : "Not the call you made — and that's exactly how you learn to read one."}
              </GuideLine>
            </div>
            <div className="mt-5 flex justify-end">
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
