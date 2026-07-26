"use client";

import { useMemo, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { Check } from "lucide-react";
import type {
  MatchPairsStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { playCue } from "@/lib/learn/feedback";
import { FeedbackNote, GuideLine, StepPrompt, EASE_OUT } from "../ui";

/**
 * Match pairs — tap a left item, then its match on the right. Correct locks
 * green; a wrong connection triggers the mastery-loop (guide explains once, then
 * you keep matching — never a hard reset). firstTry = matched with no mistakes.
 */
export default function MatchPairsStep({
  spec,
  register,
  soundOn,
  onResolve,
}: StepComponentProps<Spec>) {
  const reduce = useReducedMotion();
  const n = spec.pairs.length;

  const rightOrder = useMemo(() => {
    const a = spec.pairs.map((_, i) => i);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [spec.pairs]);

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [explained, setExplained] = useState(false);
  const [done, setDone] = useState(false);

  function pickRight(rightIdx: number) {
    if (selectedLeft === null || matched.has(rightIdx) || done) return;
    if (rightIdx === selectedLeft) {
      // correct (right original index == left index means same pair)
      playCue("correct", register, soundOn);
      const next = new Set(matched);
      next.add(rightIdx);
      setMatched(next);
      setSelectedLeft(null);
      if (next.size === n) {
        setDone(true);
        window.setTimeout(
          () => onResolve({ correct: true, firstTry: mistakes === 0 }),
          700
        );
      }
    } else {
      playCue("wrong", register, soundOn);
      setMistakes((m) => m + 1);
      setWrongFlash(rightIdx);
      window.setTimeout(() => setWrongFlash(null), 420);
      setSelectedLeft(null);
      if (!explained) setExplained(true);
    }
  }

  const cell =
    "rounded-xl border px-4 py-3.5 text-left font-body text-[15px] transition-[transform,border-color,background-color] duration-150 ease-out active:scale-[0.99]";

  return (
    <div>
      <StepPrompt sub="Tap one on the left, then its match on the right.">
        {spec.prompt}
      </StepPrompt>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2.5">
          {spec.pairs.map((p, i) => {
            const isMatched = matched.has(i);
            const isSel = selectedLeft === i;
            return (
              <button
                key={i}
                disabled={isMatched || done}
                onClick={() => !isMatched && setSelectedLeft(i)}
                className={`${cell} ${
                  isMatched
                    ? "border-green-500 bg-chip-green text-green-900"
                    : isSel
                      ? "border-gold-400 bg-gold-400/10 text-ink"
                      : "border-sand bg-white/60 text-ink hover:border-gold-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">{p.left}</span>
                  {isMatched && (
                    <Check className="h-4 w-4 shrink-0 text-green-600" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2.5">
          {rightOrder.map((origIdx) => {
            const isMatched = matched.has(origIdx);
            const isWrong = wrongFlash === origIdx;
            return (
              <m.button
                key={origIdx}
                disabled={isMatched || done}
                onClick={() => pickRight(origIdx)}
                animate={
                  isWrong && !reduce ? { x: [0, -5, 5, -3, 0] } : { x: 0 }
                }
                transition={{ duration: 0.32, ease: EASE_OUT }}
                className={`${cell} ${
                  isMatched
                    ? "border-green-500 bg-chip-green text-green-900"
                    : isWrong
                      ? "border-red-400 bg-red-500/10 text-red-800"
                      : "border-sand bg-white/60 text-ink hover:border-gold-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    {spec.pairs[origIdx].right}
                  </span>
                  {isMatched && (
                    <Check className="h-4 w-4 shrink-0 text-green-600" />
                  )}
                </span>
              </m.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {explained && !done && spec.explanation && (
          <m.div
            key="explain"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <FeedbackNote kind="explain">{spec.explanation}</FeedbackNote>
            <div className="mt-3">
              <GuideLine register={register}>
                Not a match — keep going, you&apos;ve got the rest.
              </GuideLine>
            </div>
          </m.div>
        )}
        {done && mistakes === 0 && spec.reinforce && (
          <m.div
            key="reinforce"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <FeedbackNote kind="correct">{spec.reinforce}</FeedbackNote>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
