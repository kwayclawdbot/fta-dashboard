"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Lock,
  Play,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import VideoPlayer from "@/components/dashboard/VideoPlayer";
import QuizPanel from "@/components/dashboard/QuizPanel";

// --- Placeholder data (same structure as course detail page) ---

interface LessonData {
  id: string;
  title: string;
  duration: string;
  status: "completed" | "available" | "locked";
  description?: string;
  hasQuiz?: boolean;
}

interface ModuleData {
  id: string;
  title: string;
  lessons: LessonData[];
}

const COURSE_MODULES: Record<string, ModuleData[]> = {
  "trading-foundations": [
    {
      id: "m1",
      title: "Module 1: Getting Started",
      lessons: [
        {
          id: "l1",
          title: "Welcome to Trading",
          duration: "8 min",
          status: "completed",
          description:
            "An introduction to what trading is, how markets function, and what your journey as a family trader will look like. We cover the mindset shifts needed and set expectations for the program.",
        },
        {
          id: "l2",
          title: "How Markets Work",
          duration: "12 min",
          status: "completed",
          description:
            "Understand the mechanics behind stock exchanges, order types, and how prices move. This foundation is essential before placing any trade.",
          hasQuiz: true,
        },
        {
          id: "l3",
          title: "Your Trading Account Setup",
          duration: "10 min",
          status: "available",
          description:
            "Step-by-step walkthrough of setting up your brokerage account, choosing the right platform, and configuring essential settings.",
        },
      ],
    },
    {
      id: "m2",
      title: "Module 2: Chart Reading Basics",
      lessons: [
        {
          id: "l4",
          title: "Candlestick Patterns",
          duration: "15 min",
          status: "available",
          description:
            "Learn to read candlestick charts like a pro. We cover the most common patterns and what they signal about market sentiment.",
          hasQuiz: true,
        },
        {
          id: "l5",
          title: "Support & Resistance",
          duration: "14 min",
          status: "locked",
          description:
            "Discover how to identify key price levels where buyers and sellers tend to cluster.",
        },
        {
          id: "l6",
          title: "Trend Lines & Channels",
          duration: "12 min",
          status: "locked",
          description:
            "Draw accurate trend lines and understand price channels to better time your entries.",
        },
      ],
    },
    {
      id: "m3",
      title: "Module 3: Risk Management",
      lessons: [
        {
          id: "l7",
          title: "Position Sizing",
          duration: "11 min",
          status: "locked",
          description: "Calculate the right position size for every trade based on your risk tolerance.",
        },
        {
          id: "l8",
          title: "Stop Losses & Take Profit",
          duration: "13 min",
          status: "locked",
          description: "Set effective stop losses and take profit levels to protect your capital.",
        },
        {
          id: "l9",
          title: "Risk-Reward Ratios",
          duration: "10 min",
          status: "locked",
          description: "Understand why risk-reward ratios matter and how to use them to filter trades.",
          hasQuiz: true,
        },
      ],
    },
    {
      id: "m4",
      title: "Module 4: Your First Trade",
      lessons: [
        {
          id: "l10",
          title: "Paper Trading Practice",
          duration: "20 min",
          status: "locked",
          description: "Practice trading with simulated money before risking real capital.",
        },
        {
          id: "l11",
          title: "Building a Trading Plan",
          duration: "15 min",
          status: "locked",
          description: "Create your personalized trading plan with clear rules and guidelines.",
        },
        {
          id: "l12",
          title: "Going Live Safely",
          duration: "18 min",
          status: "locked",
          description: "Everything you need to know before placing your first real trade.",
          hasQuiz: true,
        },
      ],
    },
  ],
};

// Placeholder quiz
const PLACEHOLDER_QUIZ = [
  {
    question: "What does a long green candlestick indicate?",
    options: [
      "Strong selling pressure",
      "Strong buying pressure",
      "Market indecision",
      "Low trading volume",
    ],
    correctIndex: 1,
  },
  {
    question: "What is the primary purpose of a stop loss?",
    options: [
      "To maximize profits",
      "To limit potential losses",
      "To increase position size",
      "To track market trends",
    ],
    correctIndex: 1,
  },
  {
    question: "What does 'support level' refer to?",
    options: [
      "The highest price a stock has reached",
      "A price level where buying pressure tends to prevent further decline",
      "The average price over 200 days",
      "The price at which most traders sell",
    ],
    correctIndex: 1,
  },
];

export default function LessonViewerPage() {
  const params = useParams();
  const slug = params.slug as string;
  const moduleId = params.moduleId as string;
  const lessonId = params.lessonId as string;

  const modules = COURSE_MODULES[slug] || [];
  const currentModule = modules.find((m) => m.id === moduleId);
  const currentLesson = currentModule?.lessons.find((l) => l.id === lessonId);

  const [isCompleted, setIsCompleted] = useState(
    currentLesson?.status === "completed"
  );
  const [showQuiz, setShowQuiz] = useState(false);

  // Find prev/next lessons across modules
  const allLessons = modules.flatMap((m) =>
    m.lessons.map((l) => ({ ...l, moduleId: m.id }))
  );
  const currentIdx = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson =
    currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  const handleVideoProgress = useCallback((pct: number) => {
    // Will be used with real video player
  }, []);

  function handleMarkComplete() {
    setIsCompleted(true);
    // TODO: call API - apiFetch(`/api/v1/progress/${lessonId}/complete`, { method: 'POST' })
    if (currentLesson?.hasQuiz) {
      setShowQuiz(true);
    }
  }

  function handleQuizComplete(score: number, passed: boolean) {
    // TODO: call API - apiFetch(`/api/v1/quizzes/${lessonId}/submit`, ...)
  }

  if (!currentModule || !currentLesson) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">
          Lesson Not Found
        </h2>
        <p className="text-midnight-400 text-sm font-body mb-6">
          This lesson doesn&apos;t exist or is not available yet.
        </p>
        <Link
          href={`/courses/${slug}`}
          className="text-gold-400 text-sm font-body hover:underline"
        >
          Back to course
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mb-4"
      >
        <Link
          href={`/courses/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-midnight-400 hover:text-midnight-200 transition-colors font-body"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to course
        </Link>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content - video + info */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex-1 lg:w-[65%] min-w-0"
        >
          {/* Lesson title */}
          <h1 className="font-display text-xl font-bold text-midnight-100 mb-3">
            {currentLesson.title}
          </h1>

          {/* Video */}
          <VideoPlayer
            provider="placeholder"
            title={currentLesson.title}
            onProgress={handleVideoProgress}
          />

          {/* Lesson info */}
          <div className="mt-6">
            {/* Description */}
            {currentLesson.description && (
              <p className="text-sm text-midnight-300 font-body leading-relaxed mb-6">
                {currentLesson.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-4 text-xs text-midnight-500 font-body mb-6">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {currentLesson.duration}
              </span>
              {currentLesson.hasQuiz && (
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  Includes quiz
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pb-6 border-b border-midnight-800">
              {!isCompleted ? (
                <button
                  onClick={handleMarkComplete}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gold-400 text-midnight-950 text-sm font-display font-semibold hover:bg-gold-300 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Mark as Complete
                </button>
              ) : (
                <div className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-body">
                  <Check className="w-4 h-4" />
                  Completed
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center gap-2 ml-auto">
                {prevLesson && prevLesson.status !== "locked" && (
                  <Link
                    href={`/courses/${slug}/${prevLesson.moduleId}/${prevLesson.id}`}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800 transition-colors font-body"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Previous
                  </Link>
                )}
                {nextLesson && nextLesson.status !== "locked" && (
                  <Link
                    href={`/courses/${slug}/${nextLesson.moduleId}/${nextLesson.id}`}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800 transition-colors font-body"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </div>

            {/* Quiz section */}
            {currentLesson.hasQuiz && isCompleted && showQuiz && (
              <div className="mt-6">
                <h3 className="font-display text-lg font-semibold text-midnight-100 mb-1">
                  Lesson Quiz
                </h3>
                <p className="text-xs text-midnight-500 font-body mb-4">
                  Test your understanding of this lesson
                </p>
                <div className="border-t border-midnight-800">
                  <QuizPanel
                    questions={PLACEHOLDER_QUIZ}
                    onComplete={handleQuizComplete}
                  />
                </div>
              </div>
            )}

            {/* Show quiz prompt if completed but quiz not started */}
            {currentLesson.hasQuiz && isCompleted && !showQuiz && (
              <div className="mt-6 py-5">
                <button
                  onClick={() => setShowQuiz(true)}
                  className="flex items-center gap-2 text-sm text-gold-400 hover:text-gold-300 transition-colors font-body"
                >
                  <BookOpen className="w-4 h-4" />
                  Take the lesson quiz
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Sidebar - lesson list */}
        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:w-[35%] shrink-0"
        >
          <div className="lg:sticky lg:top-6">
            <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-3">
              {currentModule.title}
            </h3>

            <div className="border border-midnight-800 rounded-lg overflow-hidden">
              {currentModule.lessons.map((lesson, i) => {
                const isActive = lesson.id === lessonId;
                const isLocked = lesson.status === "locked";

                return (
                  <div key={lesson.id}>
                    {i > 0 && <div className="border-t border-midnight-800" />}
                    {isLocked ? (
                      <div className="flex items-center gap-3 px-4 py-3 opacity-40">
                        <div className="w-6 h-6 rounded-full bg-midnight-800 flex items-center justify-center shrink-0">
                          <Lock className="w-3 h-3 text-midnight-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-midnight-500 font-body truncate">
                            {lesson.title}
                          </p>
                        </div>
                        <span className="text-xs text-midnight-600 font-body shrink-0">
                          {lesson.duration}
                        </span>
                      </div>
                    ) : (
                      <Link
                        href={`/courses/${slug}/${moduleId}/${lesson.id}`}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                          isActive
                            ? "bg-gold-400/5 border-l-2 border-l-gold-400"
                            : "hover:bg-midnight-800/40"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            lesson.status === "completed"
                              ? "bg-green-500/20"
                              : isActive
                                ? "bg-gold-400/20"
                                : "bg-midnight-800"
                          }`}
                        >
                          {lesson.status === "completed" ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : isActive ? (
                            <Play className="w-3 h-3 text-gold-400" />
                          ) : (
                            <Play className="w-3 h-3 text-midnight-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-body truncate ${
                              isActive
                                ? "text-gold-400 font-medium"
                                : lesson.status === "completed"
                                  ? "text-midnight-400"
                                  : "text-midnight-200"
                            }`}
                          >
                            {lesson.title}
                          </p>
                        </div>
                        <span className="text-xs text-midnight-500 font-body shrink-0">
                          {lesson.duration}
                        </span>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Other modules */}
            <div className="mt-6">
              <h4 className="text-xs text-midnight-500 font-body uppercase tracking-wider mb-2">
                Other Modules
              </h4>
              <div className="space-y-1">
                {modules
                  .filter((m) => m.id !== moduleId)
                  .map((m) => {
                    const firstAvailable = m.lessons.find(
                      (l) => l.status !== "locked"
                    );
                    return (
                      <div key={m.id}>
                        {firstAvailable ? (
                          <Link
                            href={`/courses/${slug}/${m.id}/${firstAvailable.id}`}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800/40 transition-colors font-body"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                            <span className="truncate">{m.title}</span>
                          </Link>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 text-sm text-midnight-600 font-body opacity-50">
                            <Lock className="w-3.5 h-3.5" />
                            <span className="truncate">{m.title}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
