"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import type { Register } from "@/lib/register";
import type { AudioAsset, StepResult } from "@/lib/learn/schema";
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
import {
  Caption,
  SpeakingDots,
  useLessonAudio,
  useNarrationSequence,
} from "./audio";

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

/** The on-screen ECHO of a line that is being spoken: its first sentence.
 *
 *  Audio-first means the screen is not where the paragraph lives. But an echo
 *  is not a summary — it is the author's own opening sentence, cut on a
 *  sentence boundary, never reworded. The full text is one captions tap away,
 *  and when there is no voice at all the caller shows the whole thing instead. */
function echo(text: string): string {
  const first = text.split(/(?<=[.!?…])\s+/)[0]?.trim();
  return first && first.length >= 12 ? first : text;
}

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
  narration,
  cue,
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
  /** AUDIO-FIRST: the pre-generated voice for every line this component can
   *  show. Feedback is SPOKEN and the on-screen note is the short echo of it;
   *  the affordance that moves on ("Try it" / "Got it") only appears once the
   *  voice has actually stopped, so nobody is hurried past an explanation. */
  narration?: {
    reinforce?: AudioAsset;
    explanation?: AudioAsset;
    reask?: AudioAsset;
    wrongFor?: (optIdx: number) => AudioAsset | undefined;
  };
  /** Stable identity of this question, so a re-entry replays rather than
   *  reusing a stale "already spoken" flag. */
  cue?: string;
}) {
  const reduce = useReducedMotion();
  const audio = useLessonAudio();
  const [phase, setPhase] = useState<Phase>("first");
  const [selected, setSelected] = useState<number | null>(null);
  const [firstTryCorrect, setFirstTryCorrect] = useState(false);
  const cueBase = cue ?? "choice";
  const resolved = useRef(false);

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
      // Resolution is owned by the effect below, because how long to wait now
      // depends on whether Kai is still talking.
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

  /* ── the voice ──────────────────────────────────────────────────────────
     Wrong → Kai says the line written for THAT option, then (unless the line
     already hands the question back itself) the re-ask. The button that moves
     on is withheld until he stops. */
  const pickedAudio = selected != null ? narration?.wrongFor?.(selected) : undefined;
  const feedbackQueue = useMemo<(AudioAsset | undefined)[]>(() => {
    if (phase === "explaining") {
      const first = pickedAudio ?? narration?.explanation;
      return picked?.kai ? [first] : [first, narration?.reask];
    }
    if (phase === "revealed") return [pickedAudio ?? narration?.explanation];
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pickedAudio, picked?.kai, narration]);

  const speaking = phase === "explaining" || phase === "revealed";
  const { done: feedbackDone } = useNarrationSequence(
    feedbackQueue,
    `${cueBase}:${phase}:${selected ?? -1}`,
    { enabled: speaking }
  );

  // Only shorten the on-screen line to its opening sentence when the rest of it
  // is genuinely reaching the member's ears. Silent, blocked or ungenerated →
  // the full authored line is printed, because nothing may be lost.
  const spokenFeedback = (audio?.audible ?? false) && Boolean(feedbackQueue[0]);

  // Correct → the reinforcement is spoken, and the step resolves when the voice
  // stops rather than on a fixed timer, so the member never gets cut off
  // mid-sentence by the next screen sliding in.
  const playFn = audio?.play;
  const audible = audio?.audible === true;
  useEffect(() => {
    if (phase !== "done" || resolved.current) return;
    let alive = true;
    const finish = () => {
      if (!alive || resolved.current) return;
      resolved.current = true;
      onResolve({ correct: true, firstTry: firstTryCorrect });
    };
    const asset = firstTryCorrect ? narration?.reinforce : undefined;
    if (asset && audible && playFn) {
      playFn(asset, () => {
        if (alive) window.setTimeout(finish, 420);
      });
      return () => {
        alive = false;
      };
    }
    const t = window.setTimeout(finish, 650);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, audible, playFn]);

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
                <GuideLine register={register}>
                  {spokenFeedback ? echo(picked.text) : picked.text}
                </GuideLine>
              </div>
            ) : (
              <>
                {picked?.text ?? explanation ? (
                  <FeedbackNote kind="explain">
                    {spokenFeedback
                      ? echo(picked?.text ?? explanation ?? "")
                      : (picked?.text ?? explanation)}
                  </FeedbackNote>
                ) : null}
                <div className="mt-4">
                  <GuideLine register={register}>{reaskLabel}</GuideLine>
                </div>
              </>
            )}
            <Caption
              asset={feedbackQueue[0]}
              fallback={picked?.text ?? explanation}
            />
            <div className="flex items-center justify-end gap-3">
              <SpeakingDots active={!feedbackDone && audible} />
              {feedbackDone && (
                <PrimaryButton onClick={toReask} icon="arrow">
                  Try it
                </PrimaryButton>
              )}
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
              {(() => {
                const full =
                  picked?.text ??
                  explanation ??
                  "Here's the one — the highlighted answer above.";
                return spokenFeedback ? echo(full) : full;
              })()}
            </FeedbackNote>
            <Caption
              asset={feedbackQueue[0]}
              fallback={picked?.text ?? explanation}
            />
            <div className="mt-4 flex items-center justify-end gap-3">
              <SpeakingDots active={!feedbackDone && audible} />
              {feedbackDone && (
                <PrimaryButton
                  onClick={() => {
                    if (resolved.current) return;
                    resolved.current = true;
                    onResolve({ correct: true, firstTry: false });
                  }}
                  icon="arrow"
                  tone="confirm"
                >
                  Got it
                </PrimaryButton>
              )}
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
            <FeedbackNote kind="correct">
              {audible && narration?.reinforce ? echo(reinforce) : reinforce}
            </FeedbackNote>
            <Caption asset={narration?.reinforce} fallback={reinforce} />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
