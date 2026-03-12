"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Clock,
  Flame,
  Users,
  Crown,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface MemberSummary {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  lessons_completed: number;
  current_streak: number;
  last_active: string | null;
  badges_count: number;
}

interface FamilyOverview {
  family_name: string;
  plan_tier: string;
  total_lessons_completed: number;
  total_hours: number;
  average_streak: number;
  active_members: number;
  members: MemberSummary[];
}

interface ActivityEntry {
  member_name: string | null;
  lesson_title: string;
  completed_at: string;
}

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

const tierBadge = (tier: string) => {
  const colors: Record<string, string> = {
    challenge: "bg-green-500/10 text-green-400",
    academy: "bg-gold-400/10 text-gold-400",
    free: "bg-midnight-800 text-midnight-300",
  };
  return colors[tier] || colors.free;
};

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

export default function FamilyOverviewPage() {
  const router = useRouter();
  const supabase = createClient();
  const [overview, setOverview] = useState<FamilyOverview | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      setError("No family found");
      setLoading(false);
      return;
    }

    try {
      // Get family
      const { data: family } = await supabase
        .from("families")
        .select("name, plan_tier")
        .eq("id", profile.family_id)
        .single();

      // Get family members
      const { data: members } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, role")
        .eq("family_id", profile.family_id);

      if (!family || !members) {
        setError("Failed to load family data");
        setLoading(false);
        return;
      }

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const memberIds = members.map((m) => m.id);

      // Get lesson progress for all members
      const { data: progress } = await supabase
        .from("lesson_progress")
        .select("user_id, status, completed_at, time_spent_sec")
        .in("user_id", memberIds);

      // Get badges count per member
      const { data: badges } = await supabase
        .from("user_badges")
        .select("user_id")
        .in("user_id", memberIds);

      const allProgress = progress || [];
      const allBadges = badges || [];

      let totalCompleted = 0;
      let totalSeconds = 0;
      const streaks: number[] = [];
      let activeCount = 0;

      const memberSummaries: MemberSummary[] = members.map((m) => {
        const memberProgress = allProgress.filter((p) => p.user_id === m.id);
        const completed = memberProgress.filter((p) => p.status === "completed");
        const completedCount = completed.length;
        const seconds = memberProgress.reduce((sum, p) => sum + (p.time_spent_sec || 0), 0);
        const completionDates = completed
          .filter((p) => p.completed_at)
          .map((p) => p.completed_at as string);
        const streak = calculateStreak(completionDates);
        const lastActive = completionDates.length > 0
          ? completionDates.sort().reverse()[0]
          : null;
        const badgesCount = allBadges.filter((b) => b.user_id === m.id).length;

        totalCompleted += completedCount;
        totalSeconds += seconds;
        streaks.push(streak);
        if (lastActive && new Date(lastActive) > weekAgo) activeCount++;

        return {
          id: m.id,
          display_name: m.display_name,
          avatar_url: m.avatar_url,
          role: m.role,
          lessons_completed: completedCount,
          current_streak: streak,
          last_active: lastActive,
          badges_count: badgesCount,
        };
      });

      const avgStreak = streaks.length > 0
        ? Math.round((streaks.reduce((a, b) => a + b, 0) / streaks.length) * 10) / 10
        : 0;

      setOverview({
        family_name: family.name,
        plan_tier: family.plan_tier,
        total_lessons_completed: totalCompleted,
        total_hours: Math.round((totalSeconds / 3600) * 10) / 10,
        average_streak: avgStreak,
        active_members: activeCount,
        members: memberSummaries,
      });

      // Get recent activities
      const { data: recentProgress } = await supabase
        .from("lesson_progress")
        .select("user_id, completed_at, lesson_id")
        .in("user_id", memberIds)
        .eq("status", "completed")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(20);

      if (recentProgress && recentProgress.length > 0) {
        const lessonIds = [...new Set(recentProgress.map((p) => p.lesson_id))];
        const { data: lessons } = await supabase
          .from("lessons")
          .select("id, title")
          .in("id", lessonIds);

        const lessonMap = new Map((lessons || []).map((l) => [l.id, l.title]));
        const memberMap = new Map(members.map((m) => [m.id, m.display_name]));

        const acts: ActivityEntry[] = recentProgress
          .filter((p) => new Date(p.completed_at) > weekAgo)
          .map((p) => ({
            member_name: memberMap.get(p.user_id) || null,
            lesson_title: lessonMap.get(p.lesson_id) || "Unknown",
            completed_at: p.completed_at,
          }));
        setActivities(acts);
      }
    } catch {
      setError("Failed to load family data");
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center">
        <p className="text-midnight-400 text-sm font-body">
          {error || "No data available"}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <h2 className="font-display text-2xl font-bold text-midnight-100">
            {overview.family_name}
          </h2>
          <span
            className={`text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded ${tierBadge(
              overview.plan_tier
            )}`}
          >
            {overview.plan_tier}
          </span>
        </div>
        <p className="text-midnight-400 text-sm font-body">
          Parent overview dashboard
        </p>
      </motion.div>

      {/* Stats row -- inline, no cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.3 }}
        className="flex flex-wrap items-center gap-x-0 gap-y-4 mb-10 py-5 border-y border-midnight-800"
      >
        <div className="flex items-center gap-3 pr-8">
          <BookOpen className="w-4 h-4 text-midnight-400" />
          <div>
            <p className="font-display text-2xl font-bold text-midnight-50 leading-none">
              {overview.total_lessons_completed}
            </p>
            <p className="text-xs text-midnight-400 font-body mt-0.5">
              Lessons completed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-8 border-l border-midnight-700/50">
          <Clock className="w-4 h-4 text-midnight-400" />
          <div>
            <p className="font-display text-2xl font-bold text-midnight-50 leading-none">
              {overview.total_hours}
              <span className="text-midnight-500 text-base font-normal">h</span>
            </p>
            <p className="text-xs text-midnight-400 font-body mt-0.5">
              Total hours
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-8 border-l border-midnight-700/50">
          <Flame className="w-4 h-4 text-midnight-400" />
          <div>
            <p className="font-display text-2xl font-bold text-midnight-50 leading-none">
              {overview.average_streak}
            </p>
            <p className="text-xs text-midnight-400 font-body mt-0.5">
              Avg streak
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 pl-8 border-l border-midnight-700/50">
          <Users className="w-4 h-4 text-midnight-400" />
          <div>
            <p className="font-display text-2xl font-bold text-midnight-50 leading-none">
              {overview.active_members}
            </p>
            <p className="text-xs text-midnight-400 font-body mt-0.5">
              Active this week
            </p>
          </div>
        </div>
      </motion.div>

      {/* Per-member progress */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="mb-10"
      >
        <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-4">
          Member Progress
        </h3>
        {overview.members.length === 0 ? (
          <p className="text-sm text-midnight-500 font-body py-4">
            No members in your family yet.
          </p>
        ) : (
          <div>
            {overview.members.map((member) => {
              const initials = (member.display_name || "U")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-4 py-4 border-b border-midnight-800/50 last:border-0"
                >
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.display_name || "Member"}
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gold-400/15 flex items-center justify-center text-gold-400 font-display font-bold text-xs shrink-0">
                      {initials}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-display font-semibold text-midnight-100 truncate">
                        {member.display_name || "Member"}
                      </p>
                      {member.role === "parent" && (
                        <Crown className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-midnight-400 font-body shrink-0">
                    <span>
                      <span className="text-midnight-200 font-medium">
                        {member.lessons_completed}
                      </span>{" "}
                      lessons
                    </span>
                    <span className="hidden sm:inline">
                      <span className="text-midnight-200 font-medium">
                        {member.current_streak}
                      </span>{" "}
                      day streak
                    </span>
                    <span className="hidden md:inline text-midnight-500">
                      {member.last_active
                        ? formatRelativeTime(member.last_active)
                        : "Not active"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* This Week activity */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="border-t border-midnight-800/50 pt-6"
      >
        <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-4">
          This Week
        </h3>
        {activities.length === 0 ? (
          <p className="text-sm text-midnight-500 font-body py-4">
            No activity this week yet.
          </p>
        ) : (
          <div>
            {activities.slice(0, 10).map((activity, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-3 border-b border-midnight-800/50 last:border-0"
              >
                <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-green-400" />
                </div>
                <p className="text-sm text-midnight-200 font-body flex-1 min-w-0 truncate">
                  <span className="text-midnight-400">
                    {activity.member_name || "Member"}
                  </span>{" "}
                  completed{" "}
                  <span className="text-midnight-100">
                    {activity.lesson_title}
                  </span>
                </p>
                <span className="text-xs text-midnight-500 font-body shrink-0">
                  {formatRelativeTime(activity.completed_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
