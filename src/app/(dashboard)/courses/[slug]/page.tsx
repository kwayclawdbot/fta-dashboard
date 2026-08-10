"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { m as mm, AnimatePresence } from "@/lib/motion";
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
import { createClient } from "@/lib/supabase/client";
import { useAppMode } from "@/lib/useAppMode";

/* ══════════════════════════════════════════════════════════════════════════
   /courses/[slug] — THE COURSE SYLLABUS.

   Restored from 652f731^: the course header with lesson count + progress bar
   + Continue/Start, then the modules as an expanding accordion of lessons
   with play / check / lock status marks and durations. This is the syllabus
   that goes with a video curriculum; the winding LearnPath strand that
   replaced it (553db9f, 06e4bd1) is gone from this route.

   TWO THINGS ARE DELIBERATELY *NOT* RESTORED, both post-dating the redesign:
     • MOCK_COURSES. The pre-redesign page fell back to an invented catalogue
       with dead links whenever the real query came back empty. 9ae61df killed
       that, and it stays dead — an unpublished course reads as unpublished.
       DEFAULT_COURSE carries the empty state.
     • `.eq("published", true)` and the retired-lesson gate. Publication stays
       on the query, and `lessons.retired` needs no client filter because
       migration 202's RLS policy excludes retired rows in the database.

   `LearnPath.tsx` / `LearnSurface.tsx` are left on disk untouched; this route
   was their only caller. The lesson viewer under [moduleId]/[lessonId] is not
   touched at all — it plays video today and keeps doing so.
   ══════════════════════════════════════════════════════════════════════════ */

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

interface CourseData {
  title: string;
  description: string;
  modules: Module[];
}

const DEFAULT_COURSE: CourseData = {
  title: "Course",
  description: "Course content is being prepared.",
  modules: [],
};

function formatDuration(sec: number | null) {
  if (!sec) return "";
  const m = Math.round(sec / 60);
  return `${m} min`;
}

const statusIcon = (status: Lesson["status"]) => {
  switch (status) {
    case "completed":
      return (
        <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center">
          <Check className="w-3 h-3 text-green-600" />
        </div>
      );
    case "available":
      return (
        <div className="w-6 h-6 rounded-full bg-gold-400/15 flex items-center justify-center group-hover:bg-gold-400/25 transition-colors">
          <Play className="w-3 h-3 text-gold-400" />
        </div>
      );
    case "locked":
      return (
        <div className="w-6 h-6 rounded-full bg-midnight-800 flex items-center justify-center">
          <Lock className="w-3 h-3 text-midnight-500" />
        </div>
      );
  }
};

export default function CourseDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const supabase = createClient();
  // CLUB TERMINAL SKIN (.planning/CLUB-TERMINAL-STYLE.md, 2026-08-09): club
  // members get the syllabus as a terminal lesson ledger — caps masthead, one
  // dark card, hairline-separated modules, mono durations, orange CTA. Same
  // reads, same accordion state, same drip/lock logic, same links. The
  // family/teen/kid render below is byte-identical.
  const isClub = useAppMode() === "club";

  const [course, setCourse] = useState<CourseData>(DEFAULT_COURSE);
  const [loading, setLoading] = useState(true);

  const loadCourse = useCallback(async () => {
    // Try Supabase first
    const { data: dbCourse } = await supabase
      .from("courses")
      .select("id, title, description")
      .eq("slug", slug)
      .eq("published", true)
      .single();

    if (dbCourse) {
      const { data: mods } = await supabase
        .from("modules")
        .select("id, title, sort_order")
        .eq("course_id", dbCourse.id)
        .order("sort_order");

      if (mods && mods.length > 0) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Get all completed lesson IDs for this user
        let completedSet = new Set<string>();
        if (user) {
          const allModIds = mods.map((m: { id: string }) => m.id);
          const { data: allLessonsForIds } = await supabase
            .from("lessons")
            .select("id")
            .in("module_id", allModIds);

          if (allLessonsForIds && allLessonsForIds.length > 0) {
            const lessonIds = allLessonsForIds.map(
              (l: { id: string }) => l.id
            );
            const { data: progressRows } = await supabase
              .from("lesson_progress")
              .select("lesson_id")
              .eq("user_id", user.id)
              .in("lesson_id", lessonIds)
              .eq("status", "completed");

            if (progressRows) {
              completedSet = new Set(
                progressRows.map((r: { lesson_id: string }) => r.lesson_id)
              );
            }
          }
        }

        const modules: Module[] = [];
        for (const mod of mods) {
          const { data: lessons } = await supabase
            .from("lessons")
            .select(
              "id, title, video_duration_sec, drip_week, sort_order"
            )
            .eq("module_id", mod.id)
            .order("sort_order");

          const moduleLessons: Lesson[] = (lessons || []).map(
            (l: {
              id: string;
              title: string;
              video_duration_sec: number | null;
              drip_week: number | null;
              sort_order: number;
            }) => {
              // Determine status
              let status: "completed" | "available" | "locked" = "available";
              if (completedSet.has(l.id)) {
                status = "completed";
              } else if (l.drip_week && l.drip_week > 1) {
                // Simple drip logic: if drip_week > 1, treat as locked for now
                // A full implementation would check family join date
                status = "locked";
              }

              return {
                id: l.id,
                title: l.title,
                duration: formatDuration(l.video_duration_sec),
                status,
                dripDays: l.drip_week ? l.drip_week * 7 : undefined,
              };
            }
          );

          modules.push({
            id: mod.id,
            title: mod.title,
            lessons: moduleLessons,
          });
        }

        setCourse({
          title: dbCourse.title,
          description: dbCourse.description || "",
          modules,
        });
        setLoading(false);
        return;
      }
    }

    // No published course under this slug. The pre-redesign behaviour fell
    // back to MOCK_COURSES and shipped a fabricated lesson list — invented
    // units with dead links, indistinguishable from real content. 9ae61df
    // removed that and it is NOT restored: an unpublished course must read as
    // "not published", never as a catalogue we do not have. DEFAULT_COURSE
    // carries the designed empty state.
    setCourse(DEFAULT_COURSE);
    setLoading(false);
  }, [supabase, slug]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const totalLessons = course.modules.reduce(
    (sum, m) => sum + m.lessons.length,
    0
  );
  const completedLessons = course.modules.reduce(
    (sum, m) => sum + m.lessons.filter((l) => l.status === "completed").length,
    0
  );
  const progress =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const allLessons = course.modules.flatMap((m) =>
    m.lessons.map((l) => ({ ...l, moduleId: m.id }))
  );
  const nextUp = allLessons.find((l) => l.status === "available");

  // Module 1 opens by itself; every other unit is collapsed until asked for.
  //
  // The pre-redesign page re-seeded this from an effect once `course` landed,
  // which today trips `react-hooks/set-state-in-effect` (a rule that did not
  // exist when this shipped). Same behaviour without the cascading render:
  // `null` means "the member hasn't touched the accordion yet", so the open
  // set is DERIVED from the course rather than written back into state, and
  // the first real toggle takes ownership.
  const [openedByUser, setOpenedByUser] = useState<Set<string> | null>(null);
  const expandedModules =
    openedByUser ??
    new Set(course.modules.length > 0 ? [course.modules[0].id] : []);

  function toggleModule(id: string) {
    setOpenedByUser((prev) => {
      const next = new Set(
        prev ?? (course.modules.length > 0 ? [course.modules[0].id] : [])
      );
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (isClub) {
    return (
      <div className="mx-auto max-w-3xl pb-16">
        <mm.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <Link
            href="/courses"
            className="inline-flex items-center gap-1.5 font-mono text-[12px] text-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Courses
          </Link>
        </mm.div>

        {/* Terminal masthead — real counts only. */}
        <mm.header initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="mt-5">
          <h1 className="font-display text-[clamp(24px,6vw,30px)] font-black uppercase leading-[0.95] tracking-[-0.03em] text-ink">
            {course.title}
          </h1>
          {course.description && (
            <p className="mt-2.5 max-w-[62ch] text-[13px] leading-relaxed text-soft">
              {course.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px] tabular-nums text-soft">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {totalLessons} lessons
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {completedLessons}/{totalLessons} completed
            </span>
          </div>
          <div className="mt-3 h-1 w-full max-w-sm overflow-hidden rounded-full bg-sand">
            <mm.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: "var(--accent-solid)" }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[11px] tabular-nums text-soft">
            {progress}% complete
          </p>
          {nextUp && (
            <Link
              href={`/courses/${slug}/${nextUp.moduleId}/${nextUp.id}`}
              className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-display text-[13px] font-bold transition-transform active:scale-[0.98]"
              style={{ background: "var(--accent-solid)", color: "var(--accent-on)" }}
            >
              <Play className="h-4 w-4" />
              {completedLessons > 0 ? "Continue Learning" : "Start Course"}
            </Link>
          )}
        </mm.header>

        {/* THE LEDGER — modules as hairline-separated sections in one dark
            card; lessons as ledger rows with mono durations. */}
        {course.modules.length > 0 && (
          <section className="mt-7">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
              Syllabus
            </h2>
            <div className="mt-3 divide-y divide-sand rounded-[16px] border border-sand bg-card px-4">
              {course.modules.map((module, mi) => {
                const isExpanded = expandedModules.has(module.id);
                const moduleCompleted = module.lessons.every(
                  (l) => l.status === "completed"
                );
                const moduleProgress = module.lessons.filter(
                  (l) => l.status === "completed"
                ).length;
                return (
                  <mm.div
                    key={module.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: mi * 0.05, duration: 0.3 }}
                  >
                    <button
                      onClick={() => toggleModule(module.id)}
                      className="flex w-full items-center justify-between gap-3 py-4"
                    >
                      <span className="flex min-w-0 items-center gap-3 text-left">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold tabular-nums ${
                            moduleCompleted ? "text-ink" : "text-soft"
                          } bg-sand`}
                        >
                          {moduleCompleted ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            String(mi + 1).padStart(2, "0")
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-display text-[14px] font-bold text-ink">
                            {module.title}
                          </span>
                          <span className="mt-0.5 block font-mono text-[10.5px] tabular-nums text-soft">
                            {moduleProgress}/{module.lessons.length} lessons
                          </span>
                        </span>
                      </span>
                      <mm.span
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.15 }}
                        className="shrink-0"
                      >
                        <ChevronDown className="h-4 w-4 text-soft" />
                      </mm.span>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <mm.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="pb-3 pl-10">
                            {module.lessons.map((lesson) => {
                              if (lesson.status === "locked") {
                                return (
                                  <div
                                    key={lesson.id}
                                    className="flex items-center gap-3 py-2.5 opacity-50"
                                  >
                                    <Lock className="h-3.5 w-3.5 shrink-0 text-soft" />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-[13px] text-soft">
                                        {lesson.title}
                                      </p>
                                      {lesson.dripDays && (
                                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                                          Available in {lesson.dripDays} days
                                        </p>
                                      )}
                                    </div>
                                    {lesson.duration && (
                                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-soft">
                                        {lesson.duration}
                                      </span>
                                    )}
                                  </div>
                                );
                              }
                              const done = lesson.status === "completed";
                              return (
                                <Link
                                  key={lesson.id}
                                  href={`/courses/${slug}/${module.id}/${lesson.id}`}
                                  className="group flex items-center gap-3 py-2.5 transition-opacity hover:opacity-80"
                                >
                                  {done ? (
                                    <Check className="h-3.5 w-3.5 shrink-0 text-ink" />
                                  ) : (
                                    <Play className="h-3.5 w-3.5 shrink-0 text-accent" />
                                  )}
                                  <p
                                    className={`min-w-0 flex-1 truncate text-[13px] ${
                                      done ? "text-soft line-through" : "text-ink"
                                    }`}
                                  >
                                    {lesson.title}
                                  </p>
                                  {lesson.duration && (
                                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-soft">
                                      {lesson.duration}
                                    </span>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        </mm.div>
                      )}
                    </AnimatePresence>
                  </mm.div>
                );
              })}
            </div>
          </section>
        )}

        {course.modules.length === 0 && (
          <mm.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-7 rounded-[16px] border border-dashed border-sand bg-card p-8 text-center"
          >
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-soft" />
            <h3 className="font-display text-[15px] font-bold text-ink">
              Course Coming Soon
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-soft">
              We&apos;re putting the finishing touches on this course. Check
              back soon!
            </p>
          </mm.div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <mm.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="mb-6"
      >
        <Link
          href="/courses"
          className="inline-flex items-center gap-1.5 text-sm text-midnight-400 hover:text-midnight-200 transition-colors font-body"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to courses
        </Link>
      </mm.div>

      {/* Course Header */}
      <mm.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h2 className="font-display text-2xl font-bold text-midnight-100 mb-2">
          {course.title}
        </h2>
        <p className="text-sm text-midnight-400 font-body mb-4 max-w-xl">
          {course.description}
        </p>
        <div className="flex items-center gap-4 text-xs text-midnight-400 mb-4">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            {totalLessons} lessons
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {completedLessons}/{totalLessons} completed
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-sm h-1.5 rounded-full bg-midnight-800 overflow-hidden">
          <mm.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full bg-gold-400"
          />
        </div>
        <p className="text-xs text-midnight-500 mt-1.5">{progress}% complete</p>

        {/* Continue / Start button */}
        {nextUp && (
          <Link
            href={`/courses/${slug}/${nextUp.moduleId}/${nextUp.id}`}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-400 text-midnight-950 text-sm font-display font-semibold hover:bg-gold-300 transition-colors"
          >
            <Play className="w-4 h-4" />
            {completedLessons > 0 ? "Continue Learning" : "Start Course"}
          </Link>
        )}
      </mm.div>

      {/* Modules */}
      <div className="border-t border-midnight-800/50">
        {course.modules.map((module, mi) => {
          const isExpanded = expandedModules.has(module.id);
          const moduleCompleted = module.lessons.every(
            (l) => l.status === "completed"
          );
          const moduleProgress = module.lessons.filter(
            (l) => l.status === "completed"
          ).length;

          return (
            <mm.div
              key={module.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: mi * 0.05, duration: 0.3 }}
              className="border-b border-midnight-800/50"
            >
              {/* Module header */}
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center justify-between py-4 hover:bg-midnight-900/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-display font-bold ${
                      moduleCompleted
                        ? "bg-green-500/15 text-green-600"
                        : "bg-midnight-800 text-midnight-300"
                    }`}
                  >
                    {moduleCompleted ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      mi + 1
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-display text-sm font-medium text-midnight-100">
                      {module.title}
                    </p>
                    <p className="text-xs text-midnight-500 font-body">
                      {moduleProgress}/{module.lessons.length} lessons
                    </p>
                  </div>
                </div>
                <mm.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <ChevronDown className="w-4 h-4 text-midnight-400" />
                </mm.div>
              </button>

              {/* Lessons */}
              <AnimatePresence>
                {isExpanded && (
                  <mm.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pl-10 pb-3">
                      {module.lessons.map((lesson) => {
                        const isLocked = lesson.status === "locked";

                        if (isLocked) {
                          return (
                            <div
                              key={lesson.id}
                              className="flex items-center gap-3 py-2.5 opacity-40"
                            >
                              {statusIcon(lesson.status)}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-body text-midnight-500">
                                  {lesson.title}
                                </p>
                                {lesson.dripDays && (
                                  <p className="text-[11px] text-midnight-600 mt-0.5 flex items-center gap-1">
                                    <Lock className="w-2.5 h-2.5" />
                                    Available in {lesson.dripDays} days
                                  </p>
                                )}
                              </div>
                              <span className="text-[11px] text-midnight-500 font-body flex items-center gap-1 shrink-0">
                                <Clock className="w-3 h-3" />
                                {lesson.duration}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <Link
                            key={lesson.id}
                            href={`/courses/${slug}/${module.id}/${lesson.id}`}
                            className="flex items-center gap-3 py-2.5 cursor-pointer hover:opacity-80 transition-opacity group"
                          >
                            {statusIcon(lesson.status)}
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-body ${
                                  lesson.status === "completed"
                                    ? "text-midnight-400 line-through"
                                    : "text-midnight-100 group-hover:text-gold-400 transition-colors"
                                }`}
                              >
                                {lesson.title}
                              </p>
                            </div>
                            <span className="text-[11px] text-midnight-500 font-body flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3" />
                              {lesson.duration}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </mm.div>
                )}
              </AnimatePresence>
            </mm.div>
          );
        })}
      </div>

      {/* Empty state */}
      {course.modules.length === 0 && (
        <mm.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-16 text-center"
        >
          <BookOpen className="w-8 h-8 text-midnight-500 mx-auto mb-3" />
          <h3 className="font-display text-lg font-semibold text-midnight-200 mb-1">
            Course Coming Soon
          </h3>
          <p className="text-midnight-400 text-sm font-body max-w-sm mx-auto">
            We&apos;re putting the finishing touches on this course. Check back
            soon!
          </p>
        </mm.div>
      )}
    </div>
  );
}
