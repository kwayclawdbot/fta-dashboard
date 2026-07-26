"use client";

import { useMemo, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { Check } from "lucide-react";
import type {
  MatchPairsStep as Spec,
  StepComponentProps,
} from "@/lib/learn/schema";
import { playCue } from "@/lib/learn/feedback";
import { getLessonSkin, lessonHaptic, EASE_OUT } from "../skin";
import { FeedbackNote, GuideLine, StepPrompt } from "../ui";
import styles from "../skin.module.css";

/**
 * Match pairs — tap a left item, then its match on the right. Correct locks with
 * a pop; a wrong connection is a warm coaching beat (guide explains once, you
 * keep matching — never a hard reset). firstTry = matched with no mistakes.
 */
export default function MatchPairsStep({
  spec,
  register,
  soundOn,
  onResolve,
}: StepComponentProps<Spec>) {
  const reduce = useReducedMotion();
  const skin = useMemo(() => getLessonSkin(register), [register]);
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
  const [justMatched, setJustMatched] = useState<number | null>(null);
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [explained, setExplained] = useState(false);
  const [done, setDone] = useState(false);

  function pickRight(rightIdx: number) {
    if (selectedLeft === null || matched.has(rightIdx) || done) return;
    if (rightIdx === selectedLeft) {
      playCue("correct", register, soundOn);
      lessonHaptic(skin, !!reduce);
      const next = new Set(matched);
      next.add(rightIdx);
      setMatched(next);
      setJustMatched(rightIdx);
      window.setTimeout(() => setJustMatched(null), 520);
      setSelectedLeft(null);
      if (next.size === n) {
        setDone(true);
        window.setTimeout(
          () => onResolve({ correct: true, firstTry: mistakes === 0 }),
          760
        );
      }
    } else {
      playCue("wrong", register, soundOn);
      setMistakes((m) => m + 1);
      setWrongFlash(rightIdx);
      window.setTimeout(() => setWrongFlash(null), 440);
      setSelectedLeft(null);
      if (!explained) setExplained(true);
    }
  }

  function cellClass(state: "idle" | "sel" | "matched" | "wrong", popped: boolean) {
    const map = {
      idle: styles.optIdle,
      sel: styles.optSelected,
      matched: styles.optCorrect,
      wrong: styles.optWrong,
    } as const;
    return `${styles.option} ${map[state]} ${popped ? styles.pop : ""}`;
  }

  return (
    <div>
      <StepPrompt
        skin={skin}
        eyebrow="Match them up"
        sub="Tap one on the left, then its match on the right."
      >
        {spec.prompt}
      </StepPrompt>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          {spec.pairs.map((p, i) => {
            const isMatched = matched.has(i);
            const isSel = selectedLeft === i;
            return (
              <button
                key={i}
                disabled={isMatched || done}
                onClick={() => !isMatched && setSelectedLeft(i)}
                className={cellClass(
                  isMatched ? "matched" : isSel ? "sel" : "idle",
                  false
                )}
              >
                <span className="min-w-0 flex-1">{p.left}</span>
                {isMatched && (
                  <Check className="h-5 w-5 shrink-0" style={{ color: "var(--l-ok)" }} />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3">
          {rightOrder.map((origIdx) => {
            const isMatched = matched.has(origIdx);
            const isWrong = wrongFlash === origIdx;
            return (
              <m.button
                key={origIdx}
                disabled={isMatched || done}
                onClick={() => pickRight(origIdx)}
                animate={isWrong && !reduce ? { x: [0, -6, 6, -3, 0] } : { x: 0 }}
                transition={{ duration: 0.34, ease: EASE_OUT }}
                className={cellClass(
                  isMatched ? "matched" : isWrong ? "wrong" : "idle",
                  justMatched === origIdx
                )}
              >
                <span className="min-w-0 flex-1">{spec.pairs[origIdx].right}</span>
                {isMatched && (
                  <Check className="h-5 w-5 shrink-0" style={{ color: "var(--l-ok)" }} />
                )}
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
            <div className="mt-4">
              <GuideLine skin={skin} pose="thinking">
                {skin.reask.match}
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
