"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Lock,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { canAccessCourse, getFamilyTier, type FamilyTier } from "@/lib/tier";

interface LessonRow {
  id: string;
  title: string;
  sort_order: number;
  drip_week: number;
}

interface ModuleRow {
  id: string;
  track: string | null;
  title: string;
  sort_order: number;
  lessons: LessonRow[];
}

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  program: "fic" | "fta";
  sort_order: number;
  modules: ModuleRow[];
}

interface CourseCard {
  course: CourseRow;
  total: number;
  done: number;
  next: { moduleId: string; lessonId: string; title: string } | null;
}

const TRACK_LABELS: Record<string, string> = {
  kids: "Kids Corner",
  teens: "Teens",
  adults: "Parents & Adults",
};

const TRACK_ART: Record<string, string> = {
  kids: "/art/tug-of-war.jpg",
  teens: "/art/levelup-story.jpg",
  adults: "/art/books-story.jpg",
};

export default function CoursesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState("adults");
  const [isKid, setIsKid] = useState(false);
  const [tier, setTier] = useState<FamilyTier>("fic");
  const [ficCards, setFicCards] = useState<CourseCard[]>([]);
  const [ftaCard, setFtaCard] = useState<CourseCard | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, age_group, track, family_id")
        .eq("id", user.id)
        .single();

      const userTrack = profile?.age_group || profile?.track || "adults";
      setTrack(userTrack);
      setIsKid(profile?.role === "child" && userTrack === "kids");

      // Family membership tier drives program gating (central matrix in
      // src/lib/tier.ts). Kids inherit the family's tier.
      const familyTier = await getFamilyTier(supabase, profile?.family_id);
      setTier(familyTier);

      const [{ data: courses }, { data: prog }] = await Promise.all([
        supabase
          .from("courses")
          .select(
            "id, slug, title, description, program, sort_order, modules(id, track, title, sort_order, lessons(id, title, sort_order, drip_week))"
          )
          .in("program", ["fic", "fta"])
          .eq("published", true)
          .order("sort_order"),
        supabase
          .from("lesson_progress")
          .select("lesson_id")
          .eq("user_id", user.id)
          .eq("status", "completed"),
      ]);

      const completed = new Set((prog || []).map((r) => r.lesson_id));

      function toCard(course: CourseRow): CourseCard {
        const modules = [...(course.modules || [])].sort(
          (a, b) => a.sort_order - b.sort_order
        );
        let total = 0;
        let done = 0;
        let next: CourseCard["next"] = null;
        for (const m of modules) {
          const lessons = [...(m.lessons || [])].sort(
            (a, b) => a.sort_order - b.sort_order
          );
          for (const l of lessons) {
            total += 1;
            if (completed.has(l.id)) done += 1;
            else if (!next)
              next = { moduleId: m.id, lessonId: l.id, title: l.title };
          }
        }
        return { course, total, done, next };
      }

      const all = (courses || []) as unknown as CourseRow[];

      const fic = all
        .filter((c) => c.program === "fic")
        .map((c) => ({
          ...c,
          modules: (c.modules || []).filter((m) => m.track),
        }))
        .filter((c) => c.modules.length > 0);

      // Own-track course first, then (parents only) the family library
      const mine = fic.filter((c) =>
        c.modules.some((m) => m.track === userTrack)
      );
      const others =
        profile?.role !== "child"
          ? fic.filter((c) => !c.modules.some((m) => m.track === userTrack))
          : [];
      setFicCards([...mine, ...others].map(toCard));

      const fta = all.find((c) => c.program === "fta");
      setFtaCard(fta ? toCard(fta) : null);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-56 rounded-lg bg-sand/60" />
        <div className="h-52 rounded-2xl bg-sand/40" />
        <div className="h-52 rounded-2xl bg-sand/40" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          {isKid ? "My Lessons" : "Courses"}
        </h1>
        <p className="text-soft mt-1">
          {isKid
            ? "Your adventures — one step at a time."
            : "Foundations at your pace, plus the 6-week live program."}
        </p>
      </div>

      {/* THE LIVE PROGRAM (FTA) */}
      {ftaCard && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-midnight-500 mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gold-600" />
            The Live Program
          </h2>
          <div className="paper-card overflow-hidden">
            <div className="grid md:grid-cols-5">
              <div className="relative md:col-span-2 min-h-[180px] md:min-h-full">
                <Image
                  src="/art/fd-open.jpg"
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <div className="md:col-span-3 p-6 lg:p-7">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-chip-amber text-gold-800 text-xs font-semibold">
                    6 weeks
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-chip-sky text-sky-800 text-xs font-semibold">
                    Whole family
                  </span>
                  {!canAccessCourse(tier, "fta") && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sand text-soft text-xs font-semibold">
                      <Lock className="w-3 h-3" /> Enrollment required
                    </span>
                  )}
                </div>
                <h3 className="font-display text-xl font-bold text-ink">
                  {ftaCard.course.title}
                </h3>
                <p className="text-soft text-sm mt-2 leading-relaxed">
                  {ftaCard.course.description}
                </p>
                <div className="flex items-center gap-4 mt-5 flex-wrap">
                  {canAccessCourse(tier, "fta") ? (
                    <>
                      {ftaCard.next ? (
                        <Link
                          href={`/courses/${ftaCard.course.slug}/${ftaCard.next.moduleId}/${ftaCard.next.lessonId}`}
                          className="cta-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
                        >
                          <PlayCircle className="w-4 h-4" />
                          Continue
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-green-600 font-medium text-sm">
                          <CheckCircle2 className="w-4 h-4" /> Complete
                        </span>
                      )}
                      <ProgressPill done={ftaCard.done} total={ftaCard.total} />
                    </>
                  ) : (
                    <Link
                      href="/upgrade"
                      className="cta-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      Join the next cohort
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* FOUNDATIONS (FIC) */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-midnight-500 mb-3 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-gold-600" />
          {isKid ? "My Adventures" : "Foundations"}
        </h2>
        <div className="grid md:grid-cols-2 gap-5">
          {ficCards.map(({ course, total, done, next }) => {
            const courseTrack = course.modules[0]?.track || "adults";
            const isOwn = courseTrack === track;
            return (
              <div
                key={course.id}
                className="paper-card overflow-hidden flex flex-col"
              >
                <div className="relative h-36">
                  <Image
                    src={TRACK_ART[courseTrack] || TRACK_ART.adults}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-white/90 text-ink text-xs font-semibold">
                    {TRACK_LABELS[courseTrack] || courseTrack}
                  </span>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-display text-base font-semibold text-ink">
                    {course.title}
                  </h3>
                  <p className="text-soft text-sm mt-1.5 leading-relaxed line-clamp-2 flex-1">
                    {course.description}
                  </p>
                  <div className="flex items-center justify-between gap-3 mt-4">
                    {next ? (
                      <Link
                        href={`/courses/${course.slug}/${next.moduleId}/${next.lessonId}`}
                        className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                          isOwn
                            ? "text-gold-700 hover:text-gold-800"
                            : "text-soft hover:text-ink"
                        }`}
                      >
                        <BookOpen className="w-4 h-4" />
                        {done > 0 ? "Continue" : "Start"}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-green-600 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Complete
                      </span>
                    )}
                    <ProgressPill done={done} total={total} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}

function ProgressPill({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-sand overflow-hidden">
        <div
          className="h-full rounded-full bg-gold-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-soft whitespace-nowrap">
        {done}/{total}
      </span>
    </div>
  );
}
