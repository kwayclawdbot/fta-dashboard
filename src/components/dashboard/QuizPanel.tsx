"use client";

import { useState } from "react";
import { m, AnimatePresence } from "@/lib/motion";
import { ChevronRight, RotateCcw, Check, X } from "lucide-react";

/**
 * The lesson quiz. Used ONLY by the lesson viewer.
 *
 * COLOUR LAW: green/red are PRICE colours, so a right answer is INK (settled)
 * and a wrong one steps back to `soft` with the correct answer stated plainly.
 * Volt orange is the ACTION colour — it marks the live selection and the
 * submit control, nothing else. Surfaces are semantic tokens, so the panel
 * works in both themes without a single `dark:` override.
 */

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

interface QuizPanelProps {
  questions: QuizQuestion[];
  onComplete?: (score: number, passed: boolean, answers?: number[]) => void;
}

export default function QuizPanel({ questions, onComplete }: QuizPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const PASS_THRESHOLD = 70;

  function handleNext() {
    if (selectedOption === null) return;

    const newAnswers = [...answers, selectedOption];
    setAnswers(newAnswers);
    setSelectedOption(null);

    if (isLastQuestion) {
      // Calculate score
      const correct = newAnswers.filter(
        (a, i) => a === questions[i].correctIndex
      ).length;
      const score = Math.round((correct / questions.length) * 100);
      const passed = score >= PASS_THRESHOLD;
      setShowResults(true);
      onComplete?.(score, passed, newAnswers);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handleRetry() {
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswers([]);
    setShowResults(false);
  }

  if (showResults) {
    const correct = answers.filter(
      (a, i) => a === questions[i].correctIndex
    ).length;
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= PASS_THRESHOLD;

    return (
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-2"
      >
        {/* The result, as scale rather than as a coloured badge */}
        <div className="flex items-baseline gap-3">
          <p className="font-display text-display-1 font-extrabold tabular-nums text-ink">
            {score}%
          </p>
          <p className="font-display text-[15px] font-bold text-ink">
            {passed ? "Passed" : "Not yet"}
          </p>
        </div>
        <p className="mt-1.5 font-mono text-[12px] tabular-nums text-soft">
          {correct} of {questions.length} right
          {!passed && ` · ${PASS_THRESHOLD}% to pass`}
        </p>

        {/* Breakdown */}
        <div className="f0-ledger mt-6">
          {questions.map((q, i) => {
            const isCorrect = answers[i] === q.correctIndex;
            return (
              <div key={i} className="f0-ledger-row">
                {/* .f0-ledger-row centers its children (globals has no @layer,
                    so the class beats utilities) — top-align with self-start. */}
                {isCorrect ? (
                  <Check className="mt-1 h-4 w-4 shrink-0 self-start text-ink" />
                ) : (
                  <X className="mt-1 h-4 w-4 shrink-0 self-start text-soft" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={`max-w-[58ch] text-[14px] leading-snug ${
                      isCorrect ? "text-soft" : "font-display font-bold text-ink"
                    }`}
                  >
                    {q.question}
                  </p>
                  {!isCorrect && (
                    <p className="mt-1 max-w-[58ch] text-[13px] text-ink">
                      Correct: {q.options[q.correctIndex]}
                    </p>
                  )}
                  {q.explanation && (
                    <p className="mt-1 max-w-[58ch] text-[13px] leading-relaxed text-soft">
                      {q.explanation}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!passed && (
          <button
            onClick={handleRetry}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-sand px-4 py-2.5 font-display text-[14px] font-bold text-ink transition-colors hover:border-gold-500"
          >
            <RotateCcw className="h-4 w-4" />
            Take it again
          </button>
        )}
      </m.div>
    );
  }

  return (
    <div className="py-2">
      {/* Progress */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <span className="font-mono text-[12px] tabular-nums text-soft">
          {currentIndex + 1} / {questions.length}
        </span>
        <div className="flex gap-1.5">
          {questions.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < currentIndex
                  ? "w-1.5 bg-volt-500"
                  : i === currentIndex
                    ? "w-5 bg-volt-500"
                    : "w-1.5 bg-sand"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <m.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <h4 className="mb-5 max-w-[40ch] font-display text-display-3 font-extrabold text-ink">
            {currentQuestion.question}
          </h4>

          {/* Options */}
          <div className="mb-6 space-y-2.5">
            {currentQuestion.options.map((option, optIdx) => {
              const on = selectedOption === optIdx;
              return (
                <button
                  key={optIdx}
                  onClick={() => setSelectedOption(optIdx)}
                  aria-pressed={on}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] transition-[transform,border-color,background-color] duration-150 ease-out active:scale-[0.99] ${
                    on
                      ? "border-gold-500 bg-gold-400/10 text-ink"
                      : "border-sand bg-card text-ink hover:border-gold-500"
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md font-display text-xs font-bold ${
                      on ? "bg-ink/10 text-ink" : "bg-sand text-soft"
                    }`}
                  >
                    {String.fromCharCode(65 + optIdx)}
                  </span>
                  <span className="min-w-0 flex-1">{option}</span>
                </button>
              );
            })}
          </div>
        </m.div>
      </AnimatePresence>

      {/* Submit */}
      <button
        onClick={handleNext}
        disabled={selectedOption === null}
        className="ml-auto flex items-center gap-2 rounded-full bg-volt-500 px-5 py-2.5 font-display text-[14px] font-bold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-sand disabled:text-soft"
      >
        {isLastQuestion ? "Submit" : "Next"}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
