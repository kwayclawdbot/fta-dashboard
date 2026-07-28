"use client";

import { useCallback, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import type {
  ExplainerStep as Spec,
  ExplainerBeat,
  StepComponentProps,
} from "@/lib/learn/schema";
import { PrimaryButton, EASE_OUT } from "../ui";
import OrderBookFigure from "../OrderBookFigure";
import { Caption, SpeakingDots, useLessonAudio, useNarration } from "../audio";
import { MonoEyebrow } from "@/components/learn/kit";

/**
 * The concept block — AUDIO-FIRST.
 *
 * The owner's note killed the old version outright: "it should be audio speaking
 * the words with images or animations or interactions on screen, not read like a
 * book". So the paragraphs are no longer on the screen at all. They are the
 * SCRIPT. Kai speaks one beat, the screen holds ONE line of large type and the
 * drawing that beat is about, the drawing changes on the segment boundary, and
 * the next beat starts. The member looks and listens; they never read a wall.
 *
 * SYNC MODEL: beat-level, not word-level. Segment N starts → the visual state
 * authored on beat N animates in. The figure is re-keyed only when the drawing
 * genuinely changes (mode, or whether the spread is measured), so a run of beats
 * over the same picture leaves it standing instead of rebuilding it under the
 * voice.
 *
 * SILENT PATH: with sound off (or blocked) nothing auto-advances — the member
 * taps Next through the beats and captions are on, so the same content is a
 * read-at-your-own-pace lesson. `body` is the fallback for a lesson whose beats
 * were never authored.
 */

function figureKey(beat: ExplainerBeat): string {
  const ill = beat.illustration;
  if (!ill) return "none";
  return `${ill.kind}:${ill.mode}:${ill.showSpread === false ? "bare" : "measured"}`;
}

export default function ExplainerStep({ spec, onResolve }: StepComponentProps<Spec>) {
  const reduce = useReducedMotion();
  const audio = useLessonAudio();
  const beats = spec.beats ?? [];
  const hasBeats = beats.length > 0;
  const [i, setI] = useState(0);

  const beat: ExplainerBeat | undefined = beats[i];
  const last = i >= beats.length - 1;
  const autoAdvance = audio?.audible === true;

  const next = useCallback(() => {
    setI((n) => Math.min(n + 1, beats.length - 1));
  }, [beats.length]);

  // The voice for this beat. When it is audible and there are beats left, the
  // lesson walks itself; otherwise `done` just reveals the affordance.
  const { done } = useNarration(beat?.audio, `${spec.id}:${beat?.id ?? "none"}`, {
    enabled: hasBeats,
    onEnd: () => {
      if (audio?.audible && i < beats.length - 1) next();
    },
  });

  if (!hasBeats || !beat) {
    // No authored beats (older lesson JSON) — the prose, plainly.
    return (
      <div>
        {spec.heading && (
          <h2 className="mb-4 max-w-[24ch] font-display text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[32px]">
            {spec.heading}
          </h2>
        )}
        <div className="space-y-4">
          {spec.body.map((p, n) => (
            <p key={n} className="max-w-[65ch] text-[17px] leading-[1.65] text-ink">
              {p}
            </p>
          ))}
        </div>
        {spec.illustration && <OrderBookFigure spec={spec.illustration} />}
        <div className="mt-7 flex justify-end">
          <PrimaryButton onClick={() => onResolve({})} icon="arrow">
            Continue
          </PrimaryButton>
        </div>
      </div>
    );
  }

  const showAdvance = done || !autoAdvance;

  return (
    <div>
      {spec.heading && <MonoEyebrow>{spec.heading}</MonoEyebrow>}

      {/* THE LINE. One phrase, big, swapped on the segment boundary. This is
          the whole of the screen's text — everything else is the voice. */}
      <div className="mt-2 min-h-[92px] sm:min-h-[108px]">
        <AnimatePresence mode="wait">
          <m.h2
            key={beat.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="max-w-[20ch] font-display text-[28px] font-extrabold leading-[1.12] tracking-[-0.022em] text-ink sm:text-[36px]"
          >
            {beat.headline ?? spec.heading ?? ""}
          </m.h2>
        </AnimatePresence>
      </div>

      {/* The number being talked about, held at figure scale. */}
      <AnimatePresence mode="wait">
        {beat.key && (
          <m.div
            key={`${beat.key.value}-${beat.key.caption ?? ""}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE_OUT }}
            className="mt-5 border-l-2 border-gold-500 py-1 pl-4"
          >
            <div className="font-display text-display-2 font-extrabold tabular-nums text-ink">
              {beat.key.value}
            </div>
            {beat.key.caption && (
              <div className="mt-1.5 text-eyebrow font-display font-bold uppercase text-soft">
                {beat.key.caption}
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>

      {/* The teaching object. Re-keyed only when the drawing actually changes,
          so it rebuilds on the beat that changes it and stands still otherwise. */}
      <AnimatePresence mode="wait">
        {beat.illustration && (
          <m.div
            key={figureKey(beat)}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE_OUT }}
          >
            <OrderBookFigure spec={beat.illustration} playWalk={beat.playWalk} />
          </m.div>
        )}
      </AnimatePresence>

      {/* The transcript, when it is asked for or when nothing can be heard. */}
      <Caption asset={beat.audio} fallback={beat.say} />

      {/* Footer: where we are in the beat run, the voice indicator, and the
          affordance — which only appears once the voice has stopped. */}
      <div className="f0-rule-top mt-7 flex items-center gap-3 pt-4">
        <div className="flex items-center gap-1.5" aria-hidden>
          {beats.map((b, n) => (
            <m.span
              key={b.id}
              className="block h-1.5 rounded-full"
              initial={false}
              animate={{
                width: n === i ? 18 : 6,
                backgroundColor: n <= i ? "var(--accent-solid)" : "var(--sand)",
              }}
              transition={{ duration: 0.24, ease: EASE_OUT }}
            />
          ))}
        </div>
        <SpeakingDots active={!done && autoAdvance} />
        <span className="sr-only" aria-live="polite">
          Beat {i + 1} of {beats.length}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {!last && autoAdvance && (
            <button
              type="button"
              onClick={next}
              className="f0-focus text-xs text-soft underline underline-offset-2 transition-colors hover:text-ink"
            >
              Skip ahead
            </button>
          )}
          <AnimatePresence>
            {showAdvance && (
              <m.div
                key={last ? "continue" : "next"}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <PrimaryButton
                  onClick={last ? () => onResolve({}) : next}
                  icon="arrow"
                >
                  {last ? "Continue" : "Next"}
                </PrimaryButton>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
