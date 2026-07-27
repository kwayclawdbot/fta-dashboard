"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { m } from "@/lib/motion";
import {
  ArrowRight, BookOpen, CheckCircle2, Lock, PlayCircle, Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFtaViewer } from "@/components/fta/useFtaViewer";
import FtaHubHeader from "@/components/fta/FtaHubHeader";
import LockedState from "@/components/dashboard/LockedState";

/**
 * /fta/courses — the FTA-scoped Course Library. It filters the catalog to the
 * FTA program only and presents it as premium gold cards, linking into the
 * EXISTING lesson experience (/courses/[slug]/…) — the lesson player is never
 * forked. The shared /courses page stays exactly as-is for FIC.
 */

interface LessonRow { id: string; title: string; sort_order: number }
interface ModuleRow { id: string; title: string; sort_order: number; track: string | null; lessons: LessonRow[] }
interface CourseRow {
  id: string; slug: string; title: string; description: string | null;
  program: "fic" | "fta"; sort_order: number; modules: ModuleRow[];
}
interface CourseCard {
  course: CourseRow; total: number; done: number;
  next: { moduleId: string; lessonId: string; title: string } | null;
  firstModuleId: string | null;
}

export default function FtaCoursesPage() {
  const { loading: viewerLoading, isFta, me } = useFtaViewer();
  const isChild = me?.role === "child";
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CourseCard[]>([]);

  useEffect(() => {
    if (viewerLoading || !isFta) return;
    let mounted = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: courses }, { data: prog }] = await Promise.all([
        supabase
          .from("courses")
          .select("id, slug, title, description, program, sort_order, modules(id, title, sort_order, track, lessons(id, title, sort_order, drip_week, is_free))")
          .eq("program", "fta")
          .eq("published", true)
          .order("sort_order"),
        supabase
          .from("lesson_progress")
          .select("lesson_id")
          .eq("user_id", user.id)
          .eq("status", "completed"),
      ]);
      const completed = new Set((prog || []).map((r) => r.lesson_id));

      const built: CourseCard[] = ((courses || []) as unknown as CourseRow[]).map((course) => {
        const modules = [...(course.modules || [])].sort((a, b) => a.sort_order - b.sort_order);
        let total = 0, done = 0;
        let next: CourseCard["next"] = null;
        const firstModuleId = modules[0]?.id ?? null;
        for (const mod of modules) {
          const lessons = [...(mod.lessons || [])].sort((a, b) => a.sort_order - b.sort_order);
          for (const l of lessons) {
            total += 1;
            if (completed.has(l.id)) done += 1;
            else if (!next) next = { moduleId: mod.id, lessonId: l.id, title: l.title };
          }
        }
        return { course, total, done, next, firstModuleId };
      });
      if (mounted) {
        setCards(built);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [viewerLoading, isFta]);

  if (viewerLoading) {
    return <FtaCoursesSkeleton />;
  }

  if (!isFta) {
    return (
      <LockedState
        icon={BookOpen}
        lockBadge
        eyebrow="FTA — Trading Academy"
        title="Unlock the Course Library"
        body={
          isChild
            ? "The full FTA program library is part of your family's Family Trading Academy. Ask a parent about joining the Academy — your own courses are on the Courses page."
            : "The full FTA program library — foundations to trade-ready — opens with the Family Trading Academy. Your FIC courses stay right where they are on the Courses page."
        }
        cta={isChild ? undefined : { label: "Unlock FTA", href: "/upgrade", icon: Lock }}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">
      <FtaHubHeader
        title="Course Library"
        subtitle="Your premium FTA program — pick up where your family left off."
      />

      {loading ? (
        <FtaCardsSkeleton />
      ) : cards.length === 0 ? (
        <div className="paper-card p-10 text-center">
          <Sparkles className="w-7 h-7 text-ftagold-500 mx-auto mb-3" />
          <p className="font-display text-base font-semibold text-ink mb-1">Your program is being prepared</p>
          <p className="text-sm text-soft max-w-sm mx-auto">
            Your FTA course modules will appear here as your coach publishes them.
          </p>
        </div>
      ) : (
        <>
        {/* R5 — dense metallic-gold stats strip over the FTA hub. */}
        <FtaStatStrip cards={cards} />
        <div className="grid md:grid-cols-2 gap-4">
          {cards.map(({ course, total, done, next, firstModuleId }, i) => {
            const href = next
              ? `/courses/${course.slug}/${next.moduleId}/${next.lessonId}`
              : firstModuleId
                ? `/courses/${course.slug}`
                : `/courses/${course.slug}`;
            const complete = total > 0 && done >= total;
            return (
              <m.div
                key={course.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.2) }}
              >
                <Link
                  href={href}
                  className="group relative block overflow-hidden rounded-2xl border border-ftagold-400/40 bg-gradient-to-br from-ftagold-400/[0.1] via-ftagold-400/[0.03] to-transparent hover:border-ftagold-400/70 transition-colors h-full"
                >
                  <div className="relative h-28">
                    <Image src="/art/fd-open.jpg" alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-night-950/70 to-transparent" />
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-b from-ftagold-400 to-ftagold-600 text-white text-[10px] font-display font-bold uppercase tracking-wider">
                      <Sparkles className="w-3 h-3" /> FTA
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-display text-base font-bold text-ink leading-snug">{course.title}</h3>
                    <p className="text-soft text-sm mt-1 leading-relaxed line-clamp-2">{course.description}</p>
                    <div className="flex items-center justify-between gap-3 mt-3">
                      {complete ? (
                        <span className="inline-flex items-center gap-1.5 text-green-600 text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4" /> Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ftagold-700 group-hover:text-ftagold-600">
                          {next && done > 0 ? <PlayCircle className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                          {done > 0 ? "Continue" : "Start"}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <ProgressPill done={done} total={total} />
                    </div>
                  </div>
                </Link>
              </m.div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}

// R5 — compact metallic-gold data strip: courses, lessons done, overall %.
function FtaStatStrip({ cards }: { cards: { total: number; done: number }[] }) {
  const courses = cards.length;
  const totalLessons = cards.reduce((s, c) => s + c.total, 0);
  const doneLessons = cards.reduce((s, c) => s + c.done, 0);
  const completeCourses = cards.filter((c) => c.total > 0 && c.done >= c.total).length;
  const pct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;
  const STATS: { label: string; value: string }[] = [
    { label: "Courses", value: String(courses) },
    { label: "Lessons done", value: `${doneLessons}/${totalLessons}` },
    { label: "Completed", value: `${completeCourses}/${courses}` },
    { label: "Overall", value: `${pct}%` },
  ];
  return (
    <div className="grid grid-cols-4 gap-px overflow-hidden rounded-xl border border-ftagold-400/40 bg-ftagold-400/25">
      {STATS.map((s) => (
        <div key={s.label} className="bg-paper px-3 py-2.5 text-center">
          <p className="font-mono text-lg font-bold leading-none text-ftagold-700">{s.value}</p>
          <p className="mt-1 text-[10px] font-display font-semibold uppercase tracking-wider text-soft">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function ProgressPill({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-sand overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-ftagold-400 to-ftagold-600" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-soft whitespace-nowrap">{done}/{total}</span>
    </div>
  );
}

function FtaCoursesSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-pulse">
      <div className="h-32 rounded-2xl bg-sand/40" />
      <FtaCardsSkeleton />
    </div>
  );
}
function FtaCardsSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-5">
      {[0, 1].map((i) => (
        <div key={i} className="h-56 rounded-2xl bg-sand/30 animate-pulse" />
      ))}
    </div>
  );
}
