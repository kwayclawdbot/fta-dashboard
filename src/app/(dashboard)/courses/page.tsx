"use client";

import { motion } from "framer-motion";
import { Lock, BookOpen } from "lucide-react";

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
    id: "trading-foundations",
    title: "Trading Foundations",
    description:
      "Master the basics of market structure, chart reading, and risk management. The essential starting point for every family trader.",
    lessons: 12,
    tier: "challenge",
    progress: 0,
  },
  {
    id: "options-mastery",
    title: "Options Mastery",
    description:
      "Learn to trade options with confidence. Calls, puts, spreads, and income strategies for consistent family wealth building.",
    lessons: 18,
    tier: "academy",
    progress: 0,
  },
  {
    id: "forex-fundamentals",
    title: "Forex & Futures",
    description:
      "Explore the world's largest market. Currency pairs, futures contracts, and macro analysis for diversified family portfolios.",
    lessons: 15,
    tier: "academy",
    progress: 0,
  },
  {
    id: "crypto-wealth",
    title: "Crypto Wealth Building",
    description:
      "Navigate digital assets safely. Bitcoin, Ethereum, DeFi, and long-term crypto strategies for generational wealth.",
    lessons: 10,
    tier: "academy",
    progress: 0,
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4 },
  }),
};

function ProgressRing({ progress }: { progress: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke="rgba(251,191,36,0.1)"
        strokeWidth="3"
      />
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke="#FBBF24"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-midnight-200 text-[9px] font-display font-bold"
        transform="rotate(90 24 24)"
      >
        {progress}%
      </text>
    </svg>
  );
}

export default function CoursesPage() {
  // Placeholder: challenge tier user (would come from user data)
  const userTier = "challenge";

  return (
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h2 className="font-display text-2xl font-bold text-midnight-100">
          Course Library
        </h2>
        <p className="text-midnight-400 text-sm mt-1 font-body">
          Build your trading skills step by step
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {courses.map((course, i) => {
          const isLocked = course.tier === "academy" && userTier === "challenge";

          return (
            <motion.div
              key={course.id}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ y: -4 }}
              className={`relative glow-border rounded-xl bg-midnight-900/60 p-6 transition-all ${
                isLocked ? "opacity-75" : "cursor-pointer"
              }`}
            >
              {/* Locked overlay */}
              {isLocked && (
                <div className="absolute inset-0 rounded-xl bg-midnight-950/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-gold-400/10 flex items-center justify-center mb-3">
                    <Lock className="w-6 h-6 text-gold-400" />
                  </div>
                  <p className="text-sm font-display font-semibold text-gold-400">
                    Academy Members Only
                  </p>
                  <p className="text-xs text-midnight-400 mt-1">
                    Upgrade to unlock this course
                  </p>
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-gold-400/10 flex items-center justify-center">
                    <BookOpen className="w-4.5 h-4.5 text-gold-400" />
                  </div>
                  <span
                    className={`text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      course.tier === "challenge"
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-gold-400/10 text-gold-400 border border-gold-400/20"
                    }`}
                  >
                    {course.tier}
                  </span>
                </div>
                <ProgressRing progress={course.progress} />
              </div>

              <h3 className="font-display text-lg font-semibold text-midnight-100 mb-2">
                {course.title}
              </h3>
              <p className="text-sm text-midnight-400 font-body mb-4 line-clamp-2">
                {course.description}
              </p>

              <div className="flex items-center justify-between text-xs text-midnight-500">
                <span>{course.lessons} lessons</span>
                <span>{course.progress}% complete</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
