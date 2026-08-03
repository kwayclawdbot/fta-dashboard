"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { m as mm } from "@/lib/motion";
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
import { deriveRegister } from "@/lib/register";
import { canSeeCourse, trackForRegister } from "@/lib/courseVisibility";
import UpsellCard from "@/components/dashboard/UpsellCard";

/* ══════════════════════════════════════════════════════════════════════════
   /courses — THE COURSE CATALOGUE.

   Restored from 652f731^ (the last commit before the Club redesign swapped
   this route for <LearnSurface/>, and before the LearnPath journey rail
   landed on top of it). The catalogue is the experience that belongs with a
   video curriculum: the live-program band, then a grid of course cards with
   cover art, a track chip, Continue/Start and a progress pill.

   Restored VERBATIM apart from three token adaptations forced by the shell
   the page now renders inside — see the `club-b-card` and `bg-ink` notes
   below. Data rules are today's, not 2026-07-27's: `published = true` stays
   on the query (it was already there) and `lessons.retired` needs no client
   filter because migration 202's RLS policy excludes retired rows in the
   database. No mock/fallback catalogue is used or reintroduced.
   ══════════════════════════════════════════════════════════════════════════ */

interface LessonRow {
  id: string;
  title: string;
  sort_order: number;
  drip_week: number;
  is_free: boolean;
}

interface FreeLessonRef {
  courseSlug: string;
  moduleId: string;
  lessonId: string;
  title: string;
  track: string;
}

interface LockedCourseCard {
  slug: string;
  title: string;
  description: string | null;
  track: string;
  lockedCount: number;
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
  const [freeLessons, setFreeLessons] = useState<FreeLessonRef[]>([]);
  const [lockedCourses, setLockedCourses] = useState<LockedCourseCard[]>([]);

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

      // THE REGISTER IS THE TRACK. This used to read `age_group || track ||
      // "adults"` straight off the row, which resolved a legacy `role='child'`
      // profile with no age band onto the ADULTS track — the very row
      // deriveRegister calls a kid. Register first, track derived from it, so
      // this page and the /courses/[slug] guard and /progress cannot disagree.
      const register = deriveRegister(profile);
      const viewer = { register, role: profile?.role ?? null };
      const userTrack = trackForRegister(register);
      setTrack(userTrack);
      // Register drives what a kid should NOT see (the advanced FTA ICT cohort
      // card + "Join the next cohort" upsell — audit #3).
      setIsKid(register === "kid");

      // Family membership tier drives program gating (central matrix in
      // src/lib/tier.ts). Kids inherit the family's tier.
      const familyTier = await getFamilyTier(supabase, profile?.family_id);
      setTier(familyTier);

      const [{ data: courses }, { data: prog }] = await Promise.all([
        supabase
          .from("courses")
          .select(
            "id, slug, title, description, program, sort_order, modules(id, track, title, sort_order, lessons(id, title, sort_order, drip_week, is_free))"
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

      // ── FREE tier: a three-lesson sampler + the rest of the catalog as locked
      //    cards with counts. Short-circuit the member layout entirely. ──
      if (familyTier === "free") {
        const samplers: FreeLessonRef[] = [];
        const locked: LockedCourseCard[] = [];
        for (const c of all.filter((c) => c.program === "fic")) {
          const tracked = (c.modules || []).filter((m) => m.track);
          if (tracked.length === 0) continue;
          const courseTrack = tracked[0]?.track || "adults";
          let lockedCount = 0;
          for (const m of tracked) {
            for (const l of m.lessons || []) {
              if (l.is_free) {
                samplers.push({
                  courseSlug: c.slug,
                  moduleId: m.id,
                  lessonId: l.id,
                  title: l.title,
                  track: m.track || courseTrack,
                });
              } else {
                lockedCount += 1;
              }
            }
          }
          if (lockedCount > 0) {
            locked.push({
              slug: c.slug,
              title: c.title,
              description: c.description,
              track: courseTrack,
              lockedCount,
            });
          }
        }
        setFreeLessons(samplers);
        setLockedCourses(locked);
        setLoading(false);
        return;
      }

      const fic = all
        .filter((c) => c.program === "fic")
        .map((c) => ({
          ...c,
          modules: (c.modules || []).filter((m) => m.track),
        }))
        .filter((c) => c.modules.length > 0);

      // WHICH COURSES THIS REGISTER MAY SEE — the one shared rule
      // (src/lib/courseVisibility.ts), which the course/lesson guard and
      // /progress call with the same viewer. Ordering stays as it was: own-track
      // course first, then the rest of the family library for whoever gets it.
      const visible = fic.filter((c) =>
        canSeeCourse(viewer, {
          program: "fic",
          tracks: c.modules.map((m) => m.track),
        })
      );
      const mine = visible.filter((c) =>
        c.modules.some((m) => m.track === userTrack)
      );
      const others = visible.filter(
        (c) => !c.modules.some((m) => m.track === userTrack)
      );
      setFicCards([...mine, ...others].map(toCard));

      const fta = all.find((c) => c.program === "fta");
      setFtaCard(
        fta && canSeeCourse(viewer, { program: "fta", tracks: [] })
          ? toCard(fta)
          : null
      );
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

  if (tier === "free") {
    return (
      <FreeCoursesView freeLessons={freeLessons} lockedCourses={lockedCourses} />
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

      {/* THE LIVE PROGRAM (FTA) — never shown to kids; the ICT day-trading
          cohort is age-inappropriate above a young kid's own content (audit #3). */}
      {ftaCard && !isKid && (
        <mm.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-midnight-500 mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gold-600" />
            The Live Program
          </h2>
          <div className="club-b-card overflow-hidden">
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
        </mm.section>
      )}

      {/* FOUNDATIONS (FIC) */}
      <mm.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-midnight-500 mb-3 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-gold-600" />
          {isKid ? "My Adventures" : "Foundations"}
        </h2>
        {ficCards.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-dashed border-sand bg-midnight-900 p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-chip-amber text-gold-600">
              <Sparkles className="h-8 w-8" />
            </div>
            <h3 className="font-display text-lg font-bold text-ink">
              {isKid ? "Your first adventure is on the way!" : "New lessons are coming"}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-soft">
              {isKid
                ? "We're putting the finishing touches on your very first lessons. Check back super soon — there's a whole world of money to explore."
                : "Your foundation lessons will appear here as soon as they're published."}
            </p>
          </div>
        ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {ficCards.map(({ course, total, done, next }) => {
            const courseTrack = course.modules[0]?.track || "adults";
            const isOwn = courseTrack === track;
            return (
              <div
                key={course.id}
                className="club-b-card overflow-hidden flex flex-col"
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
        )}
      </mm.section>
    </div>
  );
}

// ── FREE tier courses: the sampler + the locked catalog ─────────────────────
function FreeCoursesView({
  freeLessons,
  lockedCourses,
}: {
  freeLessons: FreeLessonRef[];
  lockedCourses: LockedCourseCard[];
}) {
  const totalLocked = lockedCourses.reduce((n, c) => n + c.lockedCount, 0);
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-[11px] font-display font-bold uppercase tracking-[0.14em]">
          <Sparkles className="w-3 h-3" /> Free sampler
        </span>
        <h1 className="font-display text-2xl font-bold text-ink mt-3">Courses</h1>
        <p className="text-soft mt-1">
          Three full lessons to try — free, and yours to keep. Play them start to
          finish, take the quiz, earn XP. The rest of the library opens when you
          join.
        </p>
      </div>

      {/* Free sampler — fully playable */}
      <section>
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-midnight-500 mb-3 flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-gold-600" />
          Free lessons — start here
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {freeLessons.map((l, i) => (
            <mm.div
              key={l.lessonId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link
                href={`/courses/${l.courseSlug}/${l.moduleId}/${l.lessonId}`}
                className="club-b-card overflow-hidden flex flex-col h-full group hover:border-gold-300 transition-colors"
              >
                <div className="relative h-28">
                  <Image
                    src={TRACK_ART[l.track] || TRACK_ART.adults}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
                  <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-white/90 text-ink text-xs font-semibold">
                    {TRACK_LABELS[l.track] || l.track}
                  </span>
                  <span className="absolute bottom-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-green-500/90 px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider text-white">
                    Free
                  </span>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-display text-base font-semibold text-ink leading-snug">
                    {l.title}
                  </h3>
                  <div className="flex items-center justify-between mt-3 pt-1">
                    <span className="text-xs text-soft inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Quiz +
                      XP
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-gold-700 group-hover:text-gold-800">
                      <PlayCircle className="w-4 h-4" /> Play
                    </span>
                  </div>
                </div>
              </Link>
            </mm.div>
          ))}
        </div>
      </section>

      {/* The full library — locked */}
      {lockedCourses.length > 0 && (
        <section>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-midnight-500 mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gold-600" />
            The full library
            {totalLocked > 0 && (
              <span className="text-soft normal-case font-body">
                · {totalLocked} more lessons
              </span>
            )}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {lockedCourses.map((c, i) => (
              <mm.div
                key={c.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href="/upgrade"
                  className="club-b-card overflow-hidden flex h-full group hover:border-gold-300 transition-colors"
                >
                  <div className="relative w-28 shrink-0">
                    <Image
                      src={TRACK_ART[c.track] || TRACK_ART.adults}
                      alt=""
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-ink/45" />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-white" />
                    </span>
                  </div>
                  <div className="p-4 flex flex-col flex-1 min-w-0">
                    <span className="text-[11px] font-display font-semibold uppercase tracking-wider text-soft">
                      {TRACK_LABELS[c.track] || c.track}
                    </span>
                    <h3 className="font-display text-base font-semibold text-ink leading-snug mt-0.5 truncate">
                      {c.title}
                    </h3>
                    <p className="text-xs text-soft mt-1 line-clamp-2 flex-1">
                      {c.description}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-700 mt-2">
                      <Lock className="w-3.5 h-3.5" />
                      {c.lockedCount} more lesson{c.lockedCount === 1 ? "" : "s"} in
                      the Club
                    </span>
                  </div>
                </Link>
              </mm.div>
            ))}
          </div>
        </section>
      )}

      {/* Upsell */}
      <UpsellCard context="courses" variant="band" />
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
