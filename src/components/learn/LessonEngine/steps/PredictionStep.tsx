"use client";

import { useMemo, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { TrendingUp } from "lucide-react";
import type {
  PredictionStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { playCue } from "@/lib/learn/feedback";
import {
  ChoiceGroup,
  OptionButton,
  PrimaryButton,
  StepPrompt,
  GuideLine,
  EASE_OUT,
} from "../ui";
import OrderBookFigure from "../OrderBookFigure";
import LessonScene from "../LessonScene";
import {
  Caption,
  SpeakingDots,
  useLessonAudio,
  useNarration,
  useNarrationSequence,
} from "../audio";

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
  const audio = useLessonAudio();
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const correct = picked === spec.outcomeValue;

  // The question is spoken while the book it is asked about sits on screen.
  useNarration(spec.audio?.prompt, `${spec.id}:prompt`, { enabled: !revealed });

  /* THE REVEAL IS A WALK-UP, NOT A SLAB. Kai says the headline, then each
     authored paragraph in turn, and the screen only ever holds the sentences he
     has already reached. The book is eaten on segment 1 — the sentence that
     describes it being eaten — so the price counting up and the words causing
     it are the same moment. That is the sync bar for this lesson. */
  const paras = useMemo(
    () => spec.reveal.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    [spec.reveal.body]
  );
  const guideLine =
    spec.guideOn && picked === spec.guideOn.value
      ? spec.guideOn.line
      : correct
        ? "You called it. That's the read of an investor."
        : "Not the call you made — and that's exactly how you learn to read one.";
  const guideAsset =
    spec.guideOn && picked === spec.guideOn.value
      ? spec.audio?.[`guide:${spec.guideOn.value}`]
      : correct
        ? spec.audio?.["guide:correct"]
        : spec.audio?.["guide:wrong"];

  const revealQueue = useMemo(
    () => [
      spec.audio?.["reveal:0"],
      ...paras.map((_, i) => spec.audio?.[`reveal:${i + 1}`]),
      guideAsset,
    ],
    [spec.audio, paras, guideAsset]
  );
  const guideIdx = paras.length + 1;
  const { index: beat, done: revealDone } = useNarrationSequence(
    revealQueue,
    `${spec.id}:reveal:${picked ?? ""}`,
    { enabled: revealed }
  );

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

      {/* The object the call is being made AGAINST — shown with the question,
          then eaten on reveal so the member watches the price move. */}
      {spec.illustration && (
        <OrderBookFigure
          spec={spec.illustration}
          playWalk={revealed && beat >= 1}
        />
      )}

      <ChoiceGroup
        ariaLabel="Your call"
        count={spec.options.length}
        disabled={revealed}
        onSelect={(pos) => !revealed && setPicked(spec.options[pos].value)}
      >
        {spec.options.map((o, i) => (
          <OptionButton
            key={o.value}
            label={o.label}
            tabIndex={
              (picked === null ? 0 : spec.options.findIndex((x) => x.value === picked)) === i
                ? 0
                : -1
            }
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
      </ChoiceGroup>

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
            {/* The reveal is the one dark object in a prediction step — an
                obsidian field in BOTH themes, so its type is theme-invariant
                cream (the standing rule for f0-hero-field). */}
            <div className="f0-hero-field f0-grain px-5 py-6">
              <div className="relative flex items-center gap-2 text-volt-400">
                <TrendingUp className="h-4 w-4" />
                <span className="text-eyebrow font-display font-bold uppercase">
                  What actually happened
                </span>
              </div>
              <p className="relative mt-3 max-w-[34ch] font-display text-display-3 font-extrabold leading-tight text-[#F7F3EA]">
                {spec.reveal.headline}
              </p>
              {/* Authored as paragraphs (blank-line separated) — a three-beat
                  reveal read as one slab was a wall, and the third beat is the
                  one that generalises the lesson. */}
              {/* One paragraph per spoken segment, arriving as it is said. */}
              {paras.map((para, i) =>
                beat >= i + 1 ? (
                  <m.p
                    key={i}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: EASE_OUT }}
                    className="relative mt-2.5 max-w-[58ch] text-[15px] leading-relaxed text-[#F7F3EA]/70"
                  >
                    {para}
                  </m.p>
                ) : null
              )}
            </div>

            {/* The authored price figure — the tape the outcome left behind.
                Hand-written points, dated in the JSON, never a live quote. */}
            {spec.reveal.scene && (
              <div className="mt-4">
                <LessonScene scene={spec.reveal.scene} />
              </div>
            )}

            {/* Kai speaks to the specific wrong pick when the author wrote a
                line for it — "that was the smartest wrong answer, and here is
                why". Otherwise the engine default. It lands last, after the
                reveal has finished being told. */}
            {beat >= guideIdx && (
              <div className="mt-4">
                <GuideLine register={register}>{guideLine}</GuideLine>
              </div>
            )}
            <Caption asset={revealQueue[beat]} />
            <div className="mt-2 flex items-center justify-end gap-3">
              <SpeakingDots active={!revealDone && audio?.audible === true} />
              {revealDone && (
                <PrimaryButton
                  onClick={() => onResolve({ correct, firstTry: correct })}
                  icon="arrow"
                >
                  Continue
                </PrimaryButton>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
