"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Play,
  Check,
  Lock,
  Clock,
  BookOpen,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface Lesson {
  id: string;
  title: string;
  duration: string;
  status: "completed" | "available" | "locked";
  dripDays?: number;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

// Placeholder course data
const COURSES: Record<
  string,
  { title: string; description: string; modules: Module[] }
> = {
  "trading-foundations": {
    title: "Trading Foundations",
    description:
      "Master the basics of market structure, chart reading, and risk management. The essential starting point for every family trader.",
    modules: [
      {
        id: "m1",
        title: "Module 1: Getting Started",
        lessons: [
          { id: "l1", title: "Welcome to Trading", duration: "8 min", status: "completed" },
          { id: "l2", title: "How Markets Work", duration: "12 min", status: "completed" },
          { id: "l3", title: "Your Trading Account Setup", duration: "10 min", status: "available" },
        ],
      },
      {
        id: "m2",
        title: "Module 2: Chart Reading Basics",
        lessons: [
          { id: "l4", title: "Candlestick Patterns", duration: "15 min", status: "available" },
          { id: "l5", title: "Support & Resistance", duration: "14 min", status: "locked", dripDays: 2 },
          { id: "l6", title: "Trend Lines & Channels", duration: "12 min", status: "locked", dripDays: 3 },
        ],
      },
      {
        id: "m3",
        title: "Module 3: Risk Management",
        lessons: [
          { id: "l7", title: "Position Sizing", duration: "11 min", status: "locked", dripDays: 5 },
          { id: "l8", title: "Stop Losses & Take Profit", duration: "13 min", status: "locked", dripDays: 5 },
          { id: "l9", title: "Risk-Reward Ratios", duration: "10 min", status: "locked", dripDays: 7 },
        ],
      },
      {
        id: "m4",
        title: "Module 4: Your First Trade",
        lessons: [
          { id: "l10", title: "Paper Trading Practice", duration: "20 min", status: "locked", dripDays: 10 },
          { id: "l11", title: "Building a Trading Plan", duration: "15 min", status: "locked", dripDays: 12 },
          { id: "l12", title: "Going Live Safely", duration: "18 min", status: "locked", dripDays: 14 },
        ],
      },
    ],
  },
};

// Fallback for unknown slugs
const DEFAULT_COURSE = {
  title: "Course",
  description: "Course content is being prepared.",
  modules: [] as Module[],
};

const statusIcon = (status: Lesson["status"]) => {
  switch (status) {
    case "completed":
      return (
        <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-green-400" />
        </div>
      );
    case "available":
      return (
        <div className="w-7 h-7 rounded-full bg-gold-400/20 flex items-center justify-center">
          <Play className="w-3.5 h-3.5 text-gold-400" />
        </div>
      );
    case "locked":
      return (
        <div className="w-7 h-7 rounded-full bg-midnight-700 flex items-center justify-center">
          <Lock className="w-3.5 h-3.5 text-midnight-500" />
        </div>
      );
  }
};

export default function CourseDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const course = COURSES[slug] || DEFAULT_COURSE;

  const totalLessons = course.modules.reduce(
    (sum, m) => sum + m.lessons.length,
    0
  );
  const completedLessons = course.modules.reduce(
    (sum, m) => sum + m.lessons.filter((l) => l.status === "completed").length,
    0
  );
  const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(course.modules.length > 0 ? [course.modules[0].id] : [])
  );

  function toggleModule(id: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Link
          href="/courses"
          className="inline-flex items-center gap-1.5 text-sm text-midnight-400 hover:text-midnight-200 transition-colors font-body"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to courses
        </Link>
      </motion.div>

      {/* Course Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glow-border rounded-xl bg-midnight-900/60 p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold text-midnight-100 mb-2">
              {course.title}
            </h2>
            <p className="text-sm text-midnight-400 font-body mb-4">
              {course.description}
            </p>
            <div className="flex items-center gap-4 text-xs text-midnight-400">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                {totalLessons} lessons
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {completedLessons}/{totalLessons} completed
              </span>
            </div>
          </div>

          {/* Progress circle */}
          <div className="shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="rgba(251,191,36,0.1)"
                strokeWidth="5"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="#FBBF24"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={
                  2 * Math.PI * 34 - (progress / 100) * 2 * Math.PI * 34
                }
                className="transition-all duration-700"
              />
              <text
                x="40"
                y="40"
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-midnight-100 text-sm font-display font-bold"
                transform="rotate(90 40 40)"
              >
                {progress}%
              </text>
            </svg>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="w-full h-2 rounded-full bg-midnight-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600"
            />
          </div>
        </div>
      </motion.div>

      {/* Modules */}
      <div className="space-y-3">
        {course.modules.map((module, mi) => {
          const isExpanded = expandedModules.has(module.id);
          const moduleCompleted = module.lessons.every(
            (l) => l.status === "completed"
          );
          const moduleProgress = module.lessons.filter(
            (l) => l.status === "completed"
          ).length;

          return (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: mi * 0.08, duration: 0.4 }}
              className="glow-border rounded-xl bg-midnight-900/60 overflow-hidden"
            >
              {/* Module header */}
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-midnight-800/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-display font-bold ${
                      moduleCompleted
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gold-400/10 text-gold-400"
                    }`}
                  >
                    {moduleCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      mi + 1
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-display text-sm font-semibold text-midnight-100">
                      {module.title}
                    </p>
                    <p className="text-xs text-midnight-500 font-body">
                      {moduleProgress}/{module.lessons.length} lessons completed
                    </p>
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-5 h-5 text-midnight-400" />
                </motion.div>
              </button>

              {/* Lessons */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-midnight-800 px-5 py-2">
                      {module.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className={`flex items-center gap-3 py-3 ${
                            lesson.status === "locked"
                              ? "opacity-50"
                              : "cursor-pointer hover:bg-midnight-800/30 -mx-2 px-2 rounded-lg transition-colors"
                          }`}
                        >
                          {statusIcon(lesson.status)}
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-body ${
                                lesson.status === "completed"
                                  ? "text-midnight-300 line-through"
                                  : lesson.status === "available"
                                    ? "text-midnight-100"
                                    : "text-midnight-500"
                              }`}
                            >
                              {lesson.title}
                            </p>
                            {lesson.status === "locked" && lesson.dripDays && (
                              <p className="text-xs text-midnight-600 mt-0.5 flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Available in {lesson.dripDays} days
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-midnight-500 font-body flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            {lesson.duration}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Empty state */}
      {course.modules.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glow-border rounded-xl bg-midnight-900/60 p-12 text-center"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-gold-400/10 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-gold-400" />
          </div>
          <h3 className="font-display text-lg font-semibold text-midnight-100 mb-2">
            Course Coming Soon
          </h3>
          <p className="text-midnight-400 text-sm font-body max-w-sm mx-auto">
            We&apos;re putting the finishing touches on this course. Check back
            soon!
          </p>
        </motion.div>
      )}
    </div>
  );
}
