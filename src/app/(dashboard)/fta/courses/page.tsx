"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { m } from "@/lib/motion";
import { ArrowRight, BookOpen, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFtaViewer } from "@/components/fta/useFtaViewer";
import FtaHubHeader from "@/components/fta/FtaHubHeader";
import LockedState from "@/components/dashboard/LockedState";
import { MeasureStrip, Meter } from "@/components/f0/parts";

/**
 * /fta/courses — the FTA Course Library, canvas v2.
 *
 * WHAT CHANGED: this was a `md:grid-cols-2` grid of gradient-bordered picture
 * cards with a `paper-card` empty state and a GREEN "Complete" tick. Three
 * separate violations — the banned equal-column content grid, a generic card
 * container, and green used for something that is not a price. It is now the
 * canvas ledger: a metallic hard-split masthead, a hairline measure row, and one
 * ruled row per course carrying its own progress meter. Completion reads by TYPE
 * WEIGHT and a stated word, never by hue.
 *
 * FTA IS THE PREMIUM TIER. The metal is the differentiator, not extra chrome:
 * the desk rule, the ftagold measures and the metal progress fills. Everything
 * else is the same vocabulary the rest of the app speaks, which is what makes the
 * metal register as premium rather than as a different product.
 *
 * SHARED PRIMITIVES (M1): the progress bars are `f0 Meter` and the measure row is
 * `f0 MeasureStrip`, both hand-rolled here before M1 landed. Meter's fill is now
 * `bg-accent`, which on an /fta route resolves through data-mode="fta" to the
 * metallic stop — so the desk paints its OWN accent with no `metal-gold`
 * override and no fork. MeasureStrip's `loading` variant replaces the bespoke
 * skeleton: it keeps the columns and labels and shimmers only the numerals, so a
 * mid-fetch strip never renders an em-dash and claims a number is absent when it
 * has merely not arrived.
 *
 * WIRING UNTOUCHED: the FTA gate (`useFtaViewer`), the courses+lesson_progress
 * reads, and the deep link into the EXISTING lesson player
 * (/courses/[slug]/[module]/[lesson]) — the player is never forked, so every
 * lesson-progress and XP write stays exactly where it was.
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

  if (viewerLoading) return <FtaCoursesSkeleton />;

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
    <div className="mx-auto w-full max-w-3xl pb-16">
      <FtaHubHeader
        title="Course"
        mark="Library"
        subtitle="Your premium program — pick up exactly where your family left off."
      />

      {loading ? (
        <>
          <FtaMeasures cards={[]} loading />
          <FtaListSkeleton />
        </>
      ) : cards.length === 0 ? (
        /* FOUNDING STATE (§0.5) — a desk with nothing published on it yet.
           A stated absence, not a decorative empty card. */
        <div className="mt-12 border-l-2 border-sand py-1 pl-4">
          <p className="font-display text-display-3 font-extrabold text-ink">
            Your program is being prepared
          </p>
          <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-soft">
            FTA course modules appear here the moment your coach publishes them.
            Nothing is hidden behind this screen — there is simply nothing on the
            desk yet.
          </p>
        </div>
      ) : (
        <>
          <FtaMeasures cards={cards} />

          <section className="mt-11">
            <h2 className="f0-section-rule mb-1">
              <span className="text-eyebrow font-display font-bold uppercase text-soft">
                The program
              </span>
            </h2>

            <div className="f0-ledger f0-stagger">
              {cards.map(({ course, total, done, next, firstModuleId }, i) => {
                const href = next
                  ? `/courses/${course.slug}/${next.moduleId}/${next.lessonId}`
                  : firstModuleId
                    ? `/courses/${course.slug}`
                    : `/courses/${course.slug}`;
                const complete = total > 0 && done >= total;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <m.div
                    key={course.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.05, 0.2) }}
                  >
                    <Link href={href} className="f0-ledger-row f0-focus group">
                      {/* The index numeral is the course's identity object —
                          a mark with a position, not a picture in a frame. */}
                      <span
                        aria-hidden
                        className="w-9 shrink-0 self-start pt-0.5 text-right font-display text-display-3 font-extrabold tabular-nums text-ftagold-700 sm:w-11"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[17px] font-extrabold leading-snug tracking-tight text-ink">
                          {course.title}
                        </span>
                        {course.description && (
                          <span className="mt-1 block max-w-prose text-[13.5px] leading-relaxed text-soft">
                            {course.description}
                          </span>
                        )}

                        {/* Progress — a bar and a numeral. No ring: a single
                            number reads more legibly on a bar (plan §1.5). */}
                        <span className="mt-3 flex items-center gap-3">
                          {/* Default fill: bg-accent → metallic on the FTA desk
                              for free. barClassName is deliberately NOT used —
                              it is a belt escape hatch, not a tint hook. */}
                          <Meter pct={pct} className="w-28" />
                          <span className="font-mono text-[11px] font-semibold tabular-nums text-soft">
                            {done}/{total} lessons
                          </span>
                        </span>

                        {/* COLOUR LAW: completion is not a price, so it is not
                            green. It is the stated word plus weight. */}
                        <span className="mt-2.5 flex items-center gap-1 font-display text-[13px] font-bold text-ftagold-700">
                          {complete ? "Complete · revisit" : done > 0 ? "Continue" : "Start"}
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                        </span>
                      </span>

                      <span className="shrink-0 self-start pt-1 text-right">
                        <span className="block font-mono text-[15px] font-semibold tabular-nums text-ink">
                          {pct}%
                        </span>
                        <span className="mt-0.5 block text-eyebrow font-display font-bold uppercase text-soft">
                          {complete ? "Done" : "Through"}
                        </span>
                      </span>
                    </Link>
                  </m.div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** The desk's measures — the shared strip, so the columns and the loading
 *  behaviour match every other measure row in the app. */
function FtaMeasures({
  cards,
  loading = false,
}: {
  cards: { total: number; done: number }[];
  loading?: boolean;
}) {
  const courses = cards.length;
  const totalLessons = cards.reduce((s, c) => s + c.total, 0);
  const doneLessons = cards.reduce((s, c) => s + c.done, 0);
  const completeCourses = cards.filter((c) => c.total > 0 && c.done >= c.total).length;
  const pct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;
  return (
    <div className="mt-10">
      <MeasureStrip
        loading={loading}
        items={[
          { label: "Courses", value: String(courses) },
          { label: "Lessons done", value: `${doneLessons}/${totalLessons}` },
          { label: "Finished", value: `${completeCourses}/${courses}` },
          { label: "Overall", value: `${pct}%` },
        ]}
      />
    </div>
  );
}

/* LOADING ≠ EMPTY (§0.4). Shaped like the ledger it becomes, and it never
   borrows the founding state's words. */
function FtaCoursesSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl pb-16" aria-busy="true">
      <div className="metal-gold h-[3px] w-full rounded-full opacity-40" />
      <div className="mt-5 h-3 w-44 animate-pulse rounded bg-sand" />
      <div className="mt-3 h-11 w-72 animate-pulse rounded bg-sand" />
      <div className="mt-7 h-8 w-full animate-pulse rounded bg-sand/50" />
      <FtaListSkeleton />
    </div>
  );
}

function FtaListSkeleton() {
  return (
    <div className="f0-ledger mt-10 border-t border-sand/70" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="f0-ledger-row">
          <div className="h-7 w-9 shrink-0 animate-pulse rounded bg-sand/60" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="h-4 w-1/2 animate-pulse rounded bg-sand/60" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-sand/40" />
            <div className="h-1.5 w-28 animate-pulse rounded-full bg-sand/50" />
          </div>
        </div>
      ))}
    </div>
  );
}
