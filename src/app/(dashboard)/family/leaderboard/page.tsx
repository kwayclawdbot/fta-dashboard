"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Crown, Flame, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LeaderboardEntry {
  rank: number;
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  lessons_completed: number;
  current_streak: number;
}

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const uniqueDays = [...new Set(dates.map((d) => new Date(d).toISOString().slice(0, 10)))].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;
  const startDay = uniqueDays[0] === today ? today : uniqueDays[0];
  let expected = new Date(startDay);
  for (const d of uniqueDays) {
    const current = new Date(d);
    if (current.toISOString().slice(0, 10) === expected.toISOString().slice(0, 10)) {
      streak++;
      expected.setDate(expected.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export default function FamilyLeaderboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState<"all" | "week">("all");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, family_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "parent") {
      router.replace("/family");
      return;
    }

    if (!profile.family_id) {
      setLoading(false);
      return;
    }

    // Get family members
    const { data: members } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("family_id", profile.family_id);

    if (!members) {
      setLoading(false);
      return;
    }

    const memberIds = members.map((m) => m.id);

    // Get lesson progress
    let query = supabase
      .from("lesson_progress")
      .select("user_id, status, completed_at")
      .in("user_id", memberIds)
      .eq("status", "completed");

    if (period === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte("completed_at", weekAgo.toISOString());
    }

    const { data: progress } = await query;
    const allProgress = progress || [];

    const leaderboard: LeaderboardEntry[] = members
      .map((m) => {
        const memberProgress = allProgress.filter((p) => p.user_id === m.id);
        const completionDates = memberProgress
          .filter((p) => p.completed_at)
          .map((p) => p.completed_at as string);
        return {
          rank: 0,
          id: m.id,
          display_name: m.display_name,
          avatar_url: m.avatar_url,
          lessons_completed: memberProgress.length,
          current_streak: calculateStreak(completionDates),
        };
      })
      .sort((a, b) => b.lessons_completed - a.lessons_completed)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));

    setEntries(leaderboard);
    setLoading(false);
  }, [supabase, router, period]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const rankColor = (rank: number) => {
    if (rank === 1) return "text-gold-400";
    if (rank === 2) return "text-midnight-300";
    if (rank === 3) return "text-amber-700";
    return "text-midnight-500";
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h2 className="font-display text-2xl font-bold text-midnight-100">
          Family Leaderboard
        </h2>
        <p className="text-midnight-400 text-sm font-body mt-1">
          See who&apos;s leading the pack
        </p>
      </motion.div>

      {/* Period toggle */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.3 }}
        className="flex gap-1 mb-8 bg-midnight-900/50 rounded-lg p-1 w-fit"
      >
        <button
          onClick={() => setPeriod("all")}
          className={`px-4 py-1.5 rounded-md text-sm font-body transition-colors ${
            period === "all"
              ? "bg-midnight-800 text-midnight-100"
              : "text-midnight-400 hover:text-midnight-200"
          }`}
        >
          All Time
        </button>
        <button
          onClick={() => setPeriod("week")}
          className={`px-4 py-1.5 rounded-md text-sm font-body transition-colors ${
            period === "week"
              ? "bg-midnight-800 text-midnight-100"
              : "text-midnight-400 hover:text-midnight-200"
          }`}
        >
          This Week
        </button>
      </motion.div>

      {/* Leaderboard */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {entries.length < 2 ? (
          <div className="py-16 text-center">
            <Users className="w-8 h-8 text-midnight-500 mx-auto mb-3" />
            <p className="font-display text-base font-semibold text-midnight-200 mb-1">
              Not enough members
            </p>
            <p className="text-midnight-400 text-sm font-body max-w-sm mx-auto">
              Invite at least 2 family members to see the leaderboard come to
              life.
            </p>
          </div>
        ) : (
          <div>
            {entries.map((entry) => {
              const initials = (entry.display_name || "U")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 py-4 border-b border-midnight-800/50 last:border-0"
                >
                  {/* Rank */}
                  <span
                    className={`font-display text-lg font-bold w-8 text-right shrink-0 ${rankColor(
                      entry.rank
                    )}`}
                  >
                    {entry.rank}
                  </span>

                  {/* Avatar */}
                  {entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt={entry.display_name || "Member"}
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gold-400/15 flex items-center justify-center text-gold-400 font-display font-bold text-xs shrink-0">
                      {initials}
                    </div>
                  )}

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-display font-semibold text-midnight-100 truncate">
                        {entry.display_name || "Member"}
                      </p>
                      {entry.rank === 1 && (
                        <Crown className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Score + streak */}
                  <div className="flex items-center gap-6 text-xs font-body shrink-0">
                    <span className="text-midnight-200">
                      <span className="font-medium text-sm">
                        {entry.lessons_completed}
                      </span>{" "}
                      <span className="text-midnight-400">lessons</span>
                    </span>
                    <span className="hidden sm:flex items-center gap-1 text-midnight-400">
                      <Flame className="w-3 h-3" />
                      {entry.current_streak}d
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
