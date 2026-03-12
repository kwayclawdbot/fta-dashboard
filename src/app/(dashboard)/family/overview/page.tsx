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
import { apiFetch } from "@/lib/api";

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

export default function FamilyOverviewPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<FamilyOverview | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "parent") {
      router.replace("/family");
      return;
    }

    try {
      const [overviewData, activityData] = await Promise.all([
        apiFetch<FamilyOverview>("/api/v1/family-dashboard/overview"),
        apiFetch<{ activities: ActivityEntry[] }>(
          "/api/v1/family-dashboard/activity"
        ),
      ]);
      setOverview(overviewData);
      // Filter to this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      setActivities(
        activityData.activities.filter(
          (a) => new Date(a.completed_at) > weekAgo
        )
      );
    } catch (err) {
      setError("Failed to load family data");
    } finally {
      setLoading(false);
    }
  }, [router]);

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
