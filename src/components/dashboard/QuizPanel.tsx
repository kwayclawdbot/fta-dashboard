"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, RotateCcw, Trophy, X } from "lucide-react";

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
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-6"
      >
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              passed ? "bg-green-500/20" : "bg-red-500/20"
            }`}
          >
            {passed ? (
              <Trophy className="w-8 h-8 text-green-400" />
            ) : (
              <X className="w-8 h-8 text-red-500" />
            )}
          </div>
          <h3 className="font-display text-xl font-bold text-midnight-100 mb-1">
            {passed ? "Quiz Passed!" : "Not Quite"}
          </h3>
          <p className="text-midnight-400 text-sm font-body">
            You scored {score}% ({correct}/{questions.length} correct)
          </p>
          {!passed && (
            <p className="text-midnight-500 text-xs font-body mt-1">
              {PASS_THRESHOLD}% required to pass
            </p>
          )}
        </div>

        {/* Results breakdown */}
        <div className="space-y-3 mb-6">
          {questions.map((q, i) => {
            const isCorrect = answers[i] === q.correctIndex;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 py-3 px-4 rounded-lg ${
                  isCorrect
                    ? "bg-green-500/5 border border-green-500/10"
                    : "bg-red-500/5 border border-red-500/10"
                }`}
              >
                <span
                  className={`text-xs font-display font-bold mt-0.5 ${
                    isCorrect ? "text-green-400" : "text-red-500"
                  }`}
                >
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-midnight-200 font-body mb-1">
                    {q.question}
                  </p>
                  {!isCorrect && (
                    <p className="text-xs text-midnight-500 font-body">
                      Correct: {q.options[q.correctIndex]}
                    </p>
                  )}
                  {q.explanation && (
                    <p className="text-xs text-midnight-400 font-body mt-1 leading-relaxed">
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
            className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-lg bg-midnight-800 text-midnight-200 hover:bg-midnight-700 transition-colors text-sm font-body"
          >
            <RotateCcw className="w-4 h-4" />
            Retry Quiz
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <div className="py-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs text-midnight-500 font-body">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < currentIndex
                  ? "bg-gold-400"
                  : i === currentIndex
                    ? "bg-gold-400/60"
                    : "bg-midnight-700"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <h4 className="font-display text-lg font-semibold text-midnight-100 mb-5">
            {currentQuestion.question}
          </h4>

          {/* Options */}
          <div className="space-y-2 mb-6">
            {currentQuestion.options.map((option, optIdx) => (
              <button
                key={optIdx}
                onClick={() => setSelectedOption(optIdx)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm font-body ${
                  selectedOption === optIdx
                    ? "border-gold-400/40 bg-gold-400/10 text-midnight-100"
                    : "border-midnight-700 bg-midnight-900/40 text-midnight-300 hover:border-midnight-600 hover:bg-midnight-800/40"
                }`}
              >
                <span className="text-midnight-500 mr-2 font-display text-xs">
                  {String.fromCharCode(65 + optIdx)}.
                </span>
                {option}
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={selectedOption === null}
        className={`flex items-center gap-2 ml-auto px-5 py-2.5 rounded-lg text-sm font-display font-semibold transition-all ${
          selectedOption !== null
            ? "bg-gold-400 text-midnight-950 hover:bg-gold-300"
            : "bg-midnight-800 text-midnight-600 cursor-not-allowed"
        }`}
      >
        {isLastQuestion ? "Submit" : "Next"}
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
