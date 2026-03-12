"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Flame, Award, Play, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const stats = [
  { label: "Lessons Completed", value: 0, icon: BookOpen, color: "text-gold-400" },
  { label: "Current Streak", value: 0, icon: Flame, color: "text-gold-500" },
  { label: "Badges Earned", value: 0, icon: Award, color: "text-gold-400" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4 },
  }),
};

export default function DashboardPage() {
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setDisplayName(
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          "Trader"
        );
      }
    });
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="font-display text-2xl font-bold text-midnight-100">
          Welcome back, <span className="text-gradient-gold">{displayName || "Trader"}</span>
        </h2>
        <p className="text-midnight-400 text-sm mt-1 font-body">
          Let&apos;s keep building your family&apos;s legacy.
        </p>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="glow-border rounded-xl bg-midnight-900/60 p-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-midnight-50">
                    {stat.value}
                  </p>
                  <p className="text-xs text-midnight-400 font-body">{stat.label}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Two-column cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Continue Learning */}
        <motion.div
          custom={3}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="glow-border rounded-xl bg-midnight-900/60 p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-midnight-100">
                Continue Learning
              </h3>
              <p className="text-sm text-midnight-400 mt-1 font-body">
                Pick up where you left off
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
              <Play className="w-5 h-5 text-gold-400" />
            </div>
          </div>

          <div className="rounded-lg bg-midnight-800/60 border border-midnight-700 p-4 mb-4">
            <p className="text-sm text-midnight-300 font-body">
              No courses started yet. Begin your first lesson to start tracking progress.
            </p>
          </div>

          <Link
            href="/courses"
            className="inline-flex items-center gap-1.5 text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors"
          >
            Browse courses
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Upcoming Live Session */}
        <motion.div
          custom={4}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="glow-border rounded-xl bg-midnight-900/60 p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-midnight-100">
                Upcoming Live Session
              </h3>
              <p className="text-sm text-midnight-400 mt-1 font-body">
                Next scheduled session
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-gold-400" />
            </div>
          </div>

          <div className="rounded-lg bg-midnight-800/60 border border-midnight-700 p-4 mb-4">
            <p className="text-sm text-midnight-300 font-body">
              No upcoming sessions scheduled. Check back soon for live trading sessions.
            </p>
          </div>

          <Link
            href="/live-sessions"
            className="inline-flex items-center gap-1.5 text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors"
          >
            View schedule
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
