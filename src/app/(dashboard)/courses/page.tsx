"use client";

import { motion } from "framer-motion";
import { Lock, BookOpen } from "lucide-react";
import Link from "next/link";

interface Course {
  id: string;
  title: string;
  description: string;
  lessons: number;
  tier: "challenge" | "academy";
  progress: number;
}

const courses: Course[] = [
  {
    id: "stocks-options",
    title: "Stocks & Options Mastery",
    description:
      "Master the foundations of stock trading and options strategies. The essential starting point for every family trader.",
    lessons: 9,
    tier: "challenge",
    progress: 22,
  },
  {
    id: "forex",
    title: "Forex Trading",
    description:
      "Navigate the global currency markets with confidence. Currency pairs, pips, and macro analysis for diversified family portfolios.",
    lessons: 5,
    tier: "academy",
    progress: 0,
  },
  {
    id: "futures",
    title: "Futures & Commodities",
    description:
      "Trade futures contracts across commodities and indices. Margin, leverage, and contract specifications.",
    lessons: 3,
    tier: "academy",
    progress: 0,
  },
  {
    id: "crypto",
    title: "Crypto & Digital Assets",
    description:
      "Understand blockchain technology and crypto trading strategies for generational wealth.",
    lessons: 3,
    tier: "academy",
    progress: 0,
  },
];

export default function CoursesPage() {
  const userTier = "academy";

  return (
    <div className="max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h2 className="font-display text-2xl font-bold text-midnight-100">
          Course Library
        </h2>
        <p className="text-midnight-400 text-sm mt-1 font-body">
          Build your trading skills step by step
        </p>
      </motion.div>

      {/* Featured course */}
      {(() => {
        const featured = courses[0];
        const isLocked = featured.tier === "academy" && userTier === "challenge";

        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="mb-6"
          >
            <Link
              href={`/courses/${featured.id}`}
              className={`block relative rounded-xl border border-midnight-700/60 bg-midnight-900/40 p-6 transition-colors hover:border-midnight-600 ${
                isLocked ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {isLocked && (
                <div className="absolute inset-0 rounded-xl bg-midnight-950/60 z-10 flex items-center justify-center">
                  <div className="text-center">
                    <Lock className="w-6 h-6 text-gold-400 mx-auto mb-2" />
                    <p className="text-sm font-display font-semibold text-gold-400">
                      Academy Members Only
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        featured.tier === "challenge"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-gold-400/10 text-gold-400"
                      }`}
                    >
                      {featured.tier}
                    </span>
                    <span className="text-xs text-midnight-500">{featured.lessons} lessons</span>
                  </div>
                  <h3 className="font-display text-xl font-semibold text-midnight-100 mb-2">
                    {featured.title}
                  </h3>
                  <p className="text-sm text-midnight-400 font-body mb-3">
                    {featured.description}
                  </p>
                  <div className="w-full max-w-xs h-1 rounded-full bg-midnight-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gold-400"
                      style={{ width: `${featured.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-midnight-500 mt-1.5">{featured.progress}% complete</p>
                </div>
                <div className="shrink-0 w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-gold-400" />
                </div>
              </div>
            </Link>
          </motion.div>
        );
      })()}

      {/* Remaining courses */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {courses.slice(1).map((course, i) => {
          const isLocked = course.tier === "academy" && userTier === "challenge";

          return (
            <motion.div
              key={course.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
            >
              <Link
                href={`/courses/${course.id}`}
                className={`block relative rounded-lg border border-midnight-700/40 bg-midnight-900/30 p-5 transition-colors hover:border-midnight-600 h-full ${
                  isLocked ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {isLocked && (
                  <div className="absolute inset-0 rounded-lg bg-midnight-950/60 z-10 flex flex-col items-center justify-center">
                    <Lock className="w-5 h-5 text-gold-400 mb-1.5" />
                    <p className="text-xs font-display font-semibold text-gold-400">
                      Academy Only
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      course.tier === "challenge"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-gold-400/10 text-gold-400"
                    }`}
                  >
                    {course.tier}
                  </span>
                </div>

                <h3 className="font-display text-base font-semibold text-midnight-100 mb-1.5">
                  {course.title}
                </h3>
                <p className="text-xs text-midnight-400 font-body mb-4 line-clamp-2">
                  {course.description}
                </p>

                <div className="mt-auto">
                  <div className="w-full h-1 rounded-full bg-midnight-800 overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded-full bg-gold-400"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-midnight-500">
                    <span>{course.lessons} lessons</span>
                    <span>{course.progress}%</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
