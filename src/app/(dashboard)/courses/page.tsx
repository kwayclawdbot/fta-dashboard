"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Lock, BookOpen } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  min_tier: string | null;
  sort_order: number;
  lessonCount: number;
  progress: number;
}

export default function CoursesPage() {
  const supabase = createClient();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const userTier: string = "academy";

  const loadCourses = useCallback(async () => {
    const { data: rawCourses } = await supabase
      .from("courses")
      .select("*")
      .eq("published", true)
      .order("sort_order");

    if (!rawCourses || rawCourses.length === 0) {
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const enriched: Course[] = [];

    for (const c of rawCourses) {
      // Get lesson count through modules
      const { data: mods } = await supabase
        .from("modules")
        .select("id")
        .eq("course_id", c.id);

      let lessonCount = 0;
      let completedCount = 0;

      if (mods && mods.length > 0) {
        const modIds = mods.map((m: { id: string }) => m.id);
        const { data: lessons } = await supabase
          .from("lessons")
          .select("id")
          .in("module_id", modIds);

        lessonCount = lessons?.length ?? 0;

        // Get user progress
        if (user && lessons && lessons.length > 0) {
          const lessonIds = lessons.map((l: { id: string }) => l.id);
          const { count } = await supabase
            .from("lesson_progress")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .in("lesson_id", lessonIds)
            .eq("status", "completed");
          completedCount = count ?? 0;
        }
      }

      const progress =
        lessonCount > 0 ? Math.round((completedCount / lessonCount) * 100) : 0;

      enriched.push({
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        min_tier: c.min_tier,
        sort_order: c.sort_order,
        lessonCount,
        progress,
      });
    }

    setCourses(enriched);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20">
        <BookOpen className="w-10 h-10 text-midnight-500 mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold text-midnight-100 mb-2">
          No courses available yet
        </h2>
        <p className="text-sm text-midnight-400 font-body">
          Check back soon for new courses.
        </p>
      </div>
    );
  }

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
        const isLocked =
          featured.min_tier === "academy" && userTier === "challenge";

        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="mb-6"
          >
            <Link
              href={`/courses/${featured.slug}`}
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
                        featured.min_tier === "challenge"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-gold-400/10 text-gold-400"
                      }`}
                    >
                      {featured.min_tier || "challenge"}
                    </span>
                    <span className="text-xs text-midnight-500">
                      {featured.lessonCount} lessons
                    </span>
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
                  <p className="text-xs text-midnight-500 mt-1.5">
                    {featured.progress}% complete
                  </p>
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
          const isLocked =
            course.min_tier === "academy" && userTier === "challenge";

          return (
            <motion.div
              key={course.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
            >
              <Link
                href={`/courses/${course.slug}`}
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
                      course.min_tier === "challenge"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-gold-400/10 text-gold-400"
                    }`}
                  >
                    {course.min_tier || "challenge"}
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
                    <span>{course.lessonCount} lessons</span>
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
