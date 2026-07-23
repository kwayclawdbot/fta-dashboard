"use client";

import { useEffect, useState, useCallback } from "react";
import { m as mm } from "@/lib/motion";
import {
  BookOpen,
  Clock,
  Flame,
  Users,
  Crown,
  Check,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTier, type FamilyTier } from "@/lib/tier";
import TierBadge from "@/components/TierBadge";
import Avatar from "@/components/Avatar";
import ReportCard from "@/components/dashboard/ReportCard";

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
  tier: FamilyTier;
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
      router.replace("/dashboard");
      return;
    }

    if (!profile.family_id) {
      setError("No family found");
      setLoading(false);
      return;
    }

    try {
      // Get family + membership tier (FIC/FTA)
      const [{ data: family }, familyTier] = await Promise.all([
        supabase
          .from("families")
          .select("name")
          .eq("id", profile.family_id)
          .single(),
        getFamilyTier(supabase, profile.family_id),
      ]);

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
        tier: familyTier,
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
      <mm.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <h2 className="font-display text-2xl font-bold text-midnight-100">
            {overview.family_name}
          </h2>
          <TierBadge tier={overview.tier} size="md" />
        </div>
        <p className="text-midnight-400 text-sm font-body">
          Parent overview dashboard
        </p>
      </mm.div>

      {/* First-week warm empty state — a brand-new family whose every stat is
          still zero gets a story-starts-here treatment instead of a stark row
          of "0 / 0h / 0 / 0" (audit #12). */}
      {overview.total_lessons_completed === 0 &&
      overview.total_hours === 0 &&
      overview.average_streak === 0 &&
      overview.active_members === 0 ? (
        <mm.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05, duration: 0.3 }}
          className="mb-10 rounded-2xl border border-gold-400/25 bg-gradient-to-br from-gold-400/[0.07] to-transparent p-6 sm:p-7"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-gold-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold text-midnight-50">
                Your family&apos;s story starts this week
              </h3>
              <p className="text-sm text-midnight-300 font-body leading-relaxed mt-1 max-w-xl">
                This is where you&apos;ll watch lessons stack up, streaks catch
                fire, and badges roll in. Kick it off together — start today&apos;s
                one thing on the home screen, and the numbers here fill in as
                your family learns.
              </p>
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <Link
                  href="/dashboard"
                  className="cta-button inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
                >
                  Start today&apos;s lesson
                </Link>
                <Link
                  href="/family/members"
                  className="text-sm font-display font-semibold text-gold-400 hover:text-gold-300"
                >
                  Invite the family →
                </Link>
              </div>
            </div>
          </div>
        </mm.div>
      ) : (
      /* Stats row -- inline, no cards */
      <mm.div
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
      </mm.div>
      )}

      {/* Per-member progress */}
      <mm.section
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
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-4 py-4 border-b border-midnight-800/50 last:border-0"
                >
                  <Avatar
                    name={member.display_name}
                    avatarUrl={member.avatar_url}
                    role={member.role}
                    tier={overview.tier}
                    size="md"
                  />

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
      </mm.section>

      {/* Per-child report cards */}
      {overview.members.filter((m) => m.role === "child").length > 0 && (
        <mm.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.3 }}
          className="mb-10"
        >
          <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-4">
            Report Cards
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {overview.members
              .filter((m) => m.role === "child")
              .map((m) => (
                <ReportCard
                  key={m.id}
                  childId={m.id}
                  childName={m.display_name || "Member"}
                />
              ))}
          </div>
        </mm.section>
      )}

      {/* This Week activity */}
      <mm.section
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
      </mm.section>

      {/* Referrals — compact card (full program lives at /referrals) */}
      <mm.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18, duration: 0.3 }}
        className="mt-10"
      >
        <Link
          href="/referrals"
          className="group flex items-center gap-4 rounded-2xl border border-gold-400/25 bg-gradient-to-br from-gold-400/[0.07] to-transparent p-5 transition-colors hover:border-gold-400/50"
        >
          <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-gold-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-midnight-50">
              Refer other families
            </p>
            <p className="text-sm text-midnight-400 font-body">
              Invite families you know to the club and earn rewards together.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-gold-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </mm.section>
    </div>
  );
}
