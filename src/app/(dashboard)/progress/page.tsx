"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Flame,
  BookOpen,
  Clock,
  Check,
  Star,
  Compass,
  CalendarCheck,
  ClipboardCheck,
  Eye,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserXp, levelProgress } from "@/lib/xp";
import { researchComplete } from "@/lib/watchlist";
import { getBadgeState, evaluateBadges, type BadgeRow } from "@/lib/badges";
import BadgeCaseView from "@/components/BadgeCaseView";
import StreakFlame from "@/components/games/StreakFlame";

interface Stats {
  totalLessons: number;
  completed: number;
  hoursWatched: number;
  currentStreak: number;
}

interface CourseProgress {
  slug: string;
  title: string;
  completed: number;
  total: number;
}

interface RecentItem {
  lessonId: string;
  title: string;
  completedAt: string;
}

// Family Investing Club contributions (guarded — tables ship in migration 032).
interface FicStats {
  missionsDone: number;
  missionsTotal: number;
  classesAttended: number;
  companiesChampioned: number;
  researchDone: number;
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

export default function ProgressPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalLessons: 0,
    completed: 0,
    hoursWatched: 0,
    currentStreak: 0,
  });
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentItem[]>([]);
  const [badges, setBadges] = useState<BadgeRow[] | null>(null);
  const [xp, setXp] = useState(0);
  const [fic, setFic] = useState<FicStats | null>(null);

  const loadProgress = useCallback(async () => {
    setLoadError(false);
    // Timeout guard: if any query hangs (the audit found the page stuck on an
    // async load that never resolved), stop the spinner and show a retry after
    // 10s rather than spinning forever.
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        setLoadError(true);
        setLoading(false);
      }
    }, 10000);

    try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      settled = true;
      clearTimeout(timeout);
      setLoading(false);
      return;
    }

    // Independent reads run together (was a long sequential chain — the N+1
    // course loop below alone fired ~2 queries per published course and pushed
    // the whole page past the spinner window; audit #1). Course structure now
    // arrives in ONE nested query instead of 2×N.
    const [
      xpVal,
      { count: totalLessons },
      { data: completedProgress },
      { data: courses },
    ] = await Promise.all([
      getUserXp(supabase, user.id),
      supabase.from("lessons").select("id", { count: "exact", head: true }),
      supabase
        .from("lesson_progress")
        .select("lesson_id, completed_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false }),
      supabase
        .from("courses")
        .select("slug, title, modules(lessons(id))")
        .eq("published", true)
        .order("sort_order"),
    ]);

    setXp(xpVal);
    const completedCount = completedProgress?.length ?? 0;

    // Calculate hours watched from completed lessons
    let hoursWatched = 0;
    if (completedProgress && completedProgress.length > 0) {
      const lessonIds = completedProgress.map(
        (p: { lesson_id: string }) => p.lesson_id
      );
      const { data: lessonDurations } = await supabase
        .from("lessons")
        .select("id, video_duration_sec")
        .in("id", lessonIds);

      if (lessonDurations) {
        const totalSec = lessonDurations.reduce(
          (sum: number, l: { video_duration_sec: number | null }) =>
            sum + (l.video_duration_sec || 0),
          0
        );
        hoursWatched = Math.round((totalSec / 3600) * 10) / 10;
      }
    }

    // Calculate streak (consecutive days with at least 1 completion)
    let streak = 0;
    if (completedProgress && completedProgress.length > 0) {
      const dates = [
        ...new Set(
          completedProgress
            .filter((p: { completed_at: string | null }) => p.completed_at)
            .map((p: { completed_at: string }) =>
              new Date(p.completed_at).toDateString()
            )
        ),
      ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      const today = new Date().toDateString();
      const yesterday = new Date(
        Date.now() - 86400000
      ).toDateString();

      if (dates[0] === today || dates[0] === yesterday) {
        streak = 1;
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i - 1]);
          const curr = new Date(dates[i]);
          const diffDays = Math.round(
            (prev.getTime() - curr.getTime()) / 86400000
          );
          if (diffDays === 1) {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    setStats({
      totalLessons: totalLessons ?? 0,
      completed: completedCount,
      hoursWatched,
      currentStreak: streak,
    });

    // Course progress — aggregated client-side from the single nested query.
    if (courses && courses.length > 0) {
      const completedLessonIds = new Set(
        (completedProgress || []).map(
          (p: { lesson_id: string }) => p.lesson_id
        )
      );

      type NestedCourse = {
        slug: string;
        title: string;
        modules: { lessons: { id: string }[] | null }[] | null;
      };
      const progress: CourseProgress[] = [];
      for (const course of courses as unknown as NestedCourse[]) {
        const lessons = (course.modules || []).flatMap(
          (m) => m.lessons || []
        );
        const total = lessons.length;
        if (total === 0) continue;
        const completed = lessons.filter((l) =>
          completedLessonIds.has(l.id)
        ).length;
        progress.push({ slug: course.slug, title: course.title, completed, total });
      }
      setCourseProgress(progress);
    }

    // Recent activity
    if (completedProgress && completedProgress.length > 0) {
      const recentIds = completedProgress
        .slice(0, 6)
        .map((p: { lesson_id: string }) => p.lesson_id);

      const { data: recentLessons } = await supabase
        .from("lessons")
        .select("id, title")
        .in("id", recentIds);

      const lessonMap = new Map(
        (recentLessons || []).map((l: { id: string; title: string }) => [
          l.id,
          l.title,
        ])
      );

      const recent: RecentItem[] = completedProgress
        .slice(0, 6)
        .map(
          (p: { lesson_id: string; completed_at: string }) => ({
            lessonId: p.lesson_id,
            title: lessonMap.get(p.lesson_id) || "Lesson",
            completedAt: p.completed_at,
          })
        );

      setRecentActivity(recent);
    }

    // Core content is in — paint now. The credential shelf renders its own
    // skeleton (rows=null) and the FIC strip fills in right after, so neither
    // blocks first paint and the page is fast every time.
    settled = true;
    clearTimeout(timeout);
    setLoading(false);

    // Credential shelf — the same BadgeCase / professional-title engine used on
    // community & profiles (audit #9). Self-award anything newly earned, then
    // read the full state (all six titles + awarded flags). Both calls are
    // guarded internally and never throw.
    await evaluateBadges(supabase, user.id);
    setBadges(await getBadgeState(supabase, user.id));

    // ── Family Investing Club contributions (guarded) ──────────────────────
    try {
      const [missionsTotalRes, missionsDoneRes, rsvpRes, championedRes] =
        await Promise.all([
          supabase
            .from("fic_missions")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("mission_completions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("session_rsvps")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("family_watchlist")
            .select("how_they_make_money, strength, risk, trend")
            .eq("champion_id", user.id),
        ]);

      const championedRows = championedRes.data || [];
      const researchDone = championedRows.filter((r) =>
        researchComplete(r as Record<string, string | null>)
      ).length;

      setFic({
        missionsDone: missionsDoneRes.count ?? 0,
        missionsTotal: missionsTotalRes.count ?? 0,
        classesAttended: rsvpRes.count ?? 0,
        companiesChampioned: championedRows.length,
        researchDone,
      });
    } catch {
      // Tables from a sibling migration may not exist yet — fail soft.
      setFic(null);
    }
    } catch (err) {
      // Root-cause fix for the infinite spinner: any rejecting/hanging query in
      // the chain above used to strand loading=true forever. Now we always
      // settle — render whatever loaded plus a retry, never an endless spinner.
      // Only surface the error screen if we never got to paint the core content.
      console.warn("[Progress] load error:", err);
      if (!settled) {
        setLoadError(true);
        setLoading(false);
      }
    } finally {
      settled = true;
      clearTimeout(timeout);
    }
  }, [supabase]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <Trophy className="w-8 h-8 text-gold-400/60 mx-auto mb-3" />
        <h2 className="font-display text-lg font-bold text-midnight-100 mb-1">
          Couldn&apos;t load your progress
        </h2>
        <p className="text-sm text-midnight-400 font-body mb-5">
          Something hiccuped on our end. Your achievements are safe — give it
          another try.
        </p>
        <button
          onClick={() => {
            setLoading(true);
            loadProgress();
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gold-400 text-midnight-950 text-sm font-display font-semibold hover:bg-gold-300 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Try again
        </button>
      </div>
    );
  }

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

      {/* Level progress */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="paper-card p-6"
      >
        {(() => {
          const lp = levelProgress(xp);
          return (
            <>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-chip-amber text-gold-700 flex items-center justify-center font-display font-bold">
                    {lp.current.level}
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold text-ink">
                      {lp.current.name}
                    </p>
                    <p className="text-xs text-soft">
                      {xp.toLocaleString()} XP earned
                    </p>
                  </div>
                </div>
                <Link
                  href="/leaderboard"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-700 hover:text-gold-800"
                >
                  <Trophy className="w-4 h-4" />
                  Family XP leaderboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="w-full h-2.5 rounded-full bg-sand overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${lp.pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                  className="h-full rounded-full bg-gold-500"
                />
              </div>
              <p className="text-xs text-soft mt-2">
                {lp.next
                  ? `${lp.toNext} XP to ${lp.next.name}`
                  : "Top level reached — Playbook Pro"}
              </p>
            </>
          );
        })()}
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap gap-x-10 gap-y-4 py-5 border-y border-midnight-800"
      >
        <div>
          <p className="text-2xl font-display font-bold text-midnight-100">
            {stats.completed}
            <span className="text-midnight-500 text-base font-normal">
              /{stats.totalLessons}
            </span>
          </p>
          <p className="text-xs text-midnight-500 font-body mt-0.5 flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            Lessons completed
          </p>
        </div>
        <div>
          <p className="text-2xl font-display font-bold text-midnight-100">
            {stats.hoursWatched}
            <span className="text-midnight-500 text-base font-normal">h</span>
          </p>
          <p className="text-xs text-midnight-500 font-body mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Hours watched
          </p>
        </div>
        <div>
          <p className="text-2xl font-display font-bold text-gold-400 flex items-center gap-1.5">
            {stats.currentStreak}
            <span className="text-midnight-500 text-base font-normal">days</span>
            <StreakFlame streak={stats.currentStreak} size={22} />
          </p>
          <p className="text-xs text-midnight-500 font-body mt-0.5 flex items-center gap-1">
            <Flame className="w-3 h-3" />
            Current streak
          </p>
        </div>
      </motion.div>

      {/* Family Investing Club contributions */}
      {fic && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
        >
          <div className="mb-4 flex items-center gap-2">
            <Compass className="h-5 w-5 text-gold-500" />
            <h2 className="font-display text-lg font-semibold text-midnight-100">
              Family Investing Club
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Link
              href="/missions"
              className="paper-card group p-4 transition-colors hover:border-gold-300"
            >
              <ClipboardCheck className="mb-2 h-4 w-4 text-gold-500" />
              <p className="font-display text-2xl font-bold text-ink">
                {fic.missionsDone}
                <span className="text-base font-normal text-midnight-500">
                  /{fic.missionsTotal}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-soft">Missions completed</p>
            </Link>
            <Link
              href="/live-sessions"
              className="paper-card group p-4 transition-colors hover:border-gold-300"
            >
              <CalendarCheck className="mb-2 h-4 w-4 text-gold-500" />
              <p className="font-display text-2xl font-bold text-ink">
                {fic.classesAttended}
              </p>
              <p className="mt-0.5 text-xs text-soft">Classes RSVP&apos;d</p>
            </Link>
            <Link
              href="/watchlist"
              className="paper-card group p-4 transition-colors hover:border-gold-300"
            >
              <Star className="mb-2 h-4 w-4 text-gold-500" />
              <p className="font-display text-2xl font-bold text-ink">
                {fic.companiesChampioned}
              </p>
              <p className="mt-0.5 text-xs text-soft">Companies championed</p>
            </Link>
            <Link
              href="/watchlist"
              className="paper-card group p-4 transition-colors hover:border-gold-300"
            >
              <Eye className="mb-2 h-4 w-4 text-gold-500" />
              <p className="font-display text-2xl font-bold text-ink">
                {fic.researchDone}
              </p>
              <p className="mt-0.5 text-xs text-soft">Research cards done</p>
            </Link>
          </div>
        </motion.section>
      )}

      {/* Course progress */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <h2 className="font-display text-lg font-semibold text-midnight-100 mb-4">
          Course Progress
        </h2>
        {courseProgress.length === 0 ? (
          <p className="text-sm text-midnight-500 font-body py-6">
            No course progress yet. Start a course to track your progress.
          </p>
        ) : (
          <div className="space-y-4">
            {courseProgress.map((course) => {
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
                      transition={{
                        duration: 0.8,
                        ease: "easeOut",
                        delay: 0.3,
                      }}
                      className="h-full rounded-full bg-gold-400"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
          {recentActivity.map((item) => (
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
        {recentActivity.length === 0 && (
          <p className="text-sm text-midnight-500 font-body py-6">
            No completed lessons yet. Start learning to see your activity here.
          </p>
        )}
      </motion.section>

      {/* Credentials — the shared BadgeCase shelf (community/profiles parity) */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <BadgeCaseView
          rows={badges}
          title="Credentials"
          emptyLine="Earn your first title by researching companies, joining classes, and finishing lessons — each one shows up here as an awarded credential."
        />
      </motion.section>
    </div>
  );
}
