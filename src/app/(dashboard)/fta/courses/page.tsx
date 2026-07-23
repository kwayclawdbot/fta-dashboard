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
  const { loading: viewerLoading, isFta } = useFtaViewer();
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
        body="The full FTA program library — foundations to trade-ready — opens with the Family Trading Academy. Your FIC courses stay right where they are on the Courses page."
        cta={{ label: "Unlock FTA", href: "/upgrade", icon: Lock }}
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
          <Sparkles className="w-7 h-7 text-gold-500 mx-auto mb-3" />
          <p className="font-display text-base font-semibold text-ink mb-1">Your program is being prepared</p>
          <p className="text-sm text-soft max-w-sm mx-auto">
            Your FTA course modules will appear here as your coach publishes them.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
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
                  className="group relative block overflow-hidden rounded-2xl border border-gold-400/40 bg-gradient-to-br from-gold-400/[0.1] via-gold-400/[0.03] to-transparent hover:border-gold-400/70 transition-colors h-full"
                >
                  <div className="relative h-32">
                    <Image src="/art/fd-open.jpg" alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-night-950/70 to-transparent" />
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-b from-gold-400 to-gold-600 text-white text-[10px] font-display font-bold uppercase tracking-wider">
                      <Sparkles className="w-3 h-3" /> FTA
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-base font-bold text-ink leading-snug">{course.title}</h3>
                    <p className="text-soft text-sm mt-1.5 leading-relaxed line-clamp-2">{course.description}</p>
                    <div className="flex items-center justify-between gap-3 mt-4">
                      {complete ? (
                        <span className="inline-flex items-center gap-1.5 text-green-600 text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4" /> Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-700 group-hover:text-gold-800">
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
      )}
    </div>
  );
}

function ProgressPill({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-sand overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600" style={{ width: `${pct}%` }} />
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
