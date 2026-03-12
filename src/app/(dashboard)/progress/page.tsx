"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Flame,
  BookOpen,
  Clock,
  Check,
  Award,
  Star,
  Target,
  Zap,
  GraduationCap,
} from "lucide-react";

// --- Placeholder data ---

const STATS = {
  totalLessons: 42,
  completed: 12,
  hoursWatched: 4.5,
  currentStreak: 3,
};

const COURSE_PROGRESS = [
  {
    slug: "trading-foundations",
    title: "Trading Foundations",
    completed: 2,
    total: 12,
  },
  {
    slug: "options-basics",
    title: "Options Trading Basics",
    completed: 6,
    total: 15,
  },
  {
    slug: "technical-analysis",
    title: "Technical Analysis",
    completed: 4,
    total: 15,
  },
];

const RECENT_ACTIVITY = [
  {
    lessonId: "l2",
    title: "How Markets Work",
    completedAt: "2026-03-12T14:30:00Z",
  },
  {
    lessonId: "l1",
    title: "Welcome to Trading",
    completedAt: "2026-03-12T13:15:00Z",
  },
  {
    lessonId: "opt-6",
    title: "Buying Your First Call",
    completedAt: "2026-03-11T16:45:00Z",
  },
  {
    lessonId: "opt-5",
    title: "Understanding Premiums",
    completedAt: "2026-03-11T15:20:00Z",
  },
  {
    lessonId: "ta-4",
    title: "Moving Averages",
    completedAt: "2026-03-10T11:00:00Z",
  },
  {
    lessonId: "ta-3",
    title: "Volume Analysis",
    completedAt: "2026-03-10T10:30:00Z",
  },
];

interface Badge {
  key: string;
  name: string;
  description: string;
  icon: React.ElementType;
  earned: boolean;
  earnedAt?: string;
}

const ALL_BADGES: Badge[] = [
  {
    key: "first_lesson",
    name: "First Lesson",
    description: "Completed your first lesson",
    icon: Star,
    earned: true,
    earnedAt: "2026-03-10",
  },
  {
    key: "module_master",
    name: "Module Master",
    description: "Completed all lessons in a module",
    icon: Award,
    earned: false,
  },
  {
    key: "week_warrior",
    name: "Week Warrior",
    description: "7-day learning streak",
    icon: Flame,
    earned: false,
  },
  {
    key: "quiz_ace",
    name: "Quiz Ace",
    description: "Scored 100% on a quiz",
    icon: Target,
    earned: true,
    earnedAt: "2026-03-11",
  },
  {
    key: "course_complete",
    name: "Course Complete",
    description: "Finished an entire course",
    icon: GraduationCap,
    earned: false,
  },
  {
    key: "fast_learner",
    name: "Fast Learner",
    description: "Complete 5 lessons in one day",
    icon: Zap,
    earned: false,
  },
];

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

export default function ProgressPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Page title */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="font-display text-2xl font-bold text-midnight-100">
          Your Progress
        </h1>
        <p className="text-sm text-midnight-400 font-body mt-1">
          Track your learning journey and achievements
        </p>
      </motion.div>

      {/* Stats row - simple text, no cards */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap gap-x-10 gap-y-4 py-5 border-y border-midnight-800"
      >
        <div>
          <p className="text-2xl font-display font-bold text-midnight-100">
            {STATS.completed}
            <span className="text-midnight-500 text-base font-normal">
              /{STATS.totalLessons}
            </span>
          </p>
          <p className="text-xs text-midnight-500 font-body mt-0.5 flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            Lessons completed
          </p>
        </div>
        <div>
          <p className="text-2xl font-display font-bold text-midnight-100">
            {STATS.hoursWatched}
            <span className="text-midnight-500 text-base font-normal">h</span>
          </p>
          <p className="text-xs text-midnight-500 font-body mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Hours watched
          </p>
        </div>
        <div>
          <p className="text-2xl font-display font-bold text-gold-400">
            {STATS.currentStreak}
            <span className="text-midnight-500 text-base font-normal">
              {" "}
              days
            </span>
          </p>
          <p className="text-xs text-midnight-500 font-body mt-0.5 flex items-center gap-1">
            <Flame className="w-3 h-3" />
            Current streak
          </p>
        </div>
      </motion.div>

      {/* Course progress */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <h2 className="font-display text-lg font-semibold text-midnight-100 mb-4">
          Course Progress
        </h2>
        <div className="space-y-4">
          {COURSE_PROGRESS.map((course) => {
            const pct =
              course.total > 0
                ? Math.round((course.completed / course.total) * 100)
                : 0;
            return (
              <div
                key={course.slug}
                className="py-3 border-b border-midnight-800/50 last:border-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-body text-midnight-200">
                    {course.title}
                  </h3>
                  <span className="text-xs text-midnight-400 font-body">
                    {course.completed}/{course.total} lessons
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-midnight-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                    className="h-full rounded-full bg-gold-400"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Recent activity */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h2 className="font-display text-lg font-semibold text-midnight-100 mb-4">
          Recent Activity
        </h2>
        <div className="space-y-0">
          {RECENT_ACTIVITY.map((item, i) => (
            <div
              key={item.lessonId}
              className="flex items-center gap-3 py-3 border-b border-midnight-800/50 last:border-0"
            >
              <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-green-400" />
              </div>
              <p className="text-sm text-midnight-200 font-body flex-1 min-w-0 truncate">
                {item.title}
              </p>
              <span className="text-xs text-midnight-500 font-body shrink-0">
                {formatRelativeTime(item.completedAt)}
              </span>
            </div>
          ))}
        </div>
        {RECENT_ACTIVITY.length === 0 && (
          <p className="text-sm text-midnight-500 font-body py-6">
            No completed lessons yet. Start learning to see your activity here.
          </p>
        )}
      </motion.section>

      {/* Badges */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <h2 className="font-display text-lg font-semibold text-midnight-100 mb-4">
          Badges
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {ALL_BADGES.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.key}
                className={`flex flex-col items-center text-center py-5 px-3 rounded-lg border transition-colors ${
                  badge.earned
                    ? "border-gold-400/20 bg-gold-400/5"
                    : "border-midnight-800 bg-midnight-900/30 opacity-40"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                    badge.earned
                      ? "bg-gold-400/20"
                      : "bg-midnight-800"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      badge.earned ? "text-gold-400" : "text-midnight-600"
                    }`}
                  />
                </div>
                <p
                  className={`text-sm font-display font-semibold mb-0.5 ${
                    badge.earned ? "text-midnight-100" : "text-midnight-600"
                  }`}
                >
                  {badge.name}
                </p>
                <p
                  className={`text-xs font-body ${
                    badge.earned ? "text-midnight-400" : "text-midnight-700"
                  }`}
                >
                  {badge.description}
                </p>
                {badge.earned && badge.earnedAt && (
                  <p className="text-xs text-gold-400/60 font-body mt-1">
                    Earned {badge.earnedAt}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}
