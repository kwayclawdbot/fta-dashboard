"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { m } from "@/lib/motion";
import { ArrowRight, BookOpen, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFtaViewer } from "@/components/fta/useFtaViewer";
import FtaHubHeader from "@/components/fta/FtaHubHeader";
import LockedState from "@/components/dashboard/LockedState";
import { Meter } from "@/components/f0/parts";
import { BoardSection } from "@/components/clubhome/board";

/**
 * /fta/courses — the FTA Course Library, built from the reference board.
 *
 * WHAT CHANGED (board rebuild): the previous pass rendered the library as a
 * hairline LEDGER — `f0-ledger` rows under an `f0-section-rule`, with an
 * `f0 MeasureStrip` on top. That was the previous version's structure. The
 * board is card-based, so the library is now: a row of small white stat cards
 * (the board's measure tiles), a `BoardSection` mark, and one `.club-b-card` per
 * course led by the board's 34px identity tile carrying the course's index,
 * with a chip meta row and the shared `Meter` for progress.
 *
 * FTA IS THE PREMIUM TIER. The metal is the differentiator, not extra chrome:
 * DashboardShell stamps data-mode="fta" on this route and globals.css re-points
 * --accent-* to the metallic stop, so `bg-accent`, `text-accent` and the Meter
 * fill are metal here with no fork and no `metal-gold` override. Everything else
 * is the same card vocabulary the rest of the app speaks, which is what makes
 * the metal register as premium rather than as a different product.
 *
 * COLOUR LAW: completion is not a price, so it is never green. It reads as the
 * stated word plus weight, with the percentage in the mono numeral register.
 *
 * LOADING ≠ EMPTY: the measure tiles keep their labels and shimmer only the
 * numerals, and the list skeleton is shaped like the cards it becomes — so a
 * mid-fetch surface never renders a founding state and claims the desk is bare.
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
      // LOADING IS NOT EMPTY — but a signed-out session is not loading either.
      // This used to `return` before clearing the flag, which left the skeleton
      // spinning forever. Now the surface resolves to its founding state.
      if (!user) {
        setLoading(false);
        return;
      }

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
           A stated absence with the reason, not a decorative empty card. */
        <div className="club-b-card mt-11 px-4 py-5">
          <p className="font-display text-[18px] font-extrabold uppercase leading-[1.15] text-ink">
            Your program is being prepared
          </p>
          <p className="mt-1.5 max-w-[52ch] text-[13.5px] leading-relaxed text-soft">
            FTA course modules appear here the moment your coach publishes them.
            Nothing is hidden behind this screen — there is simply nothing on the
            desk yet.
          </p>
        </div>
      ) : (
        <>
          <FtaMeasures cards={cards} />

          <div className="mt-11">
            <BoardSection id="fta-program" label="The" mark="program">
              <div className="f0-stagger mt-3 flex flex-col gap-2.5">
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
                      style={{ ["--i" as string]: Math.min(i, 12) }}
                    >
                      <Link
                        href={href}
                        className="club-b-card f0-focus f0-press group flex items-start gap-3 px-4 py-4"
                      >
                        {/* The board's identity tile, carrying the course's
                            index. Same 34px / 10px-radius footprint every tile
                            in the app uses; the ground is the house neutral. */}
                        <span
                          aria-hidden
                          className="club-b-tile h-[34px] w-[34px] shrink-0 rounded-[10px] font-mono text-[12px] tabular-nums"
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>

                        {/* A div, not a span: `Meter` below renders a real
                            <div role="progressbar">, and an anchor's content
                            model is transparent, so flow content is correct
                            here where phrasing-only nesting was not. */}
                        <div className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 font-display text-[16px] font-extrabold leading-snug tracking-tight text-ink">
                              {course.title}
                            </span>
                            <span className="shrink-0 font-mono text-[14px] font-semibold tabular-nums text-ink">
                              {pct}%
                            </span>
                          </span>
                          {course.description && (
                            <span className="mt-1 block max-w-prose text-[13px] leading-relaxed text-soft">
                              {course.description}
                            </span>
                          )}

                          {/* Progress — a bar, a chip and a numeral. Meter's
                              default fill is bg-accent → metallic on the FTA
                              desk for free. barClassName is deliberately NOT
                              used: it is a belt escape hatch, not a tint hook. */}
                          <div className="mt-3 flex flex-wrap items-center gap-2.5">
                            <Meter pct={pct} className="w-24" />
                            <span className="f0-chip inline-flex px-2 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-soft">
                              {done}/{total} lessons
                            </span>
                            <span className="f0-chip inline-flex px-2 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-soft">
                              {complete ? "Done" : "Through"}
                            </span>
                          </div>

                          {/* COLOUR LAW: completion is not a price, so it is not
                              green. It is the stated word plus weight. */}
                          <span className="mt-2.5 flex items-center gap-1 font-display text-[13px] font-bold text-accent">
                            {complete ? "Complete · revisit" : done > 0 ? "Continue" : "Start"}
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                          </span>
                        </div>
                      </Link>
                    </m.div>
                  );
                })}
              </div>
            </BoardSection>
          </div>
        </>
      )}
    </div>
  );
}

/** The desk's measures — the board's small white stat cards. Loading keeps every
 *  label and shimmers only the numeral, so the swap is a fill, not a reflow. */
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
  const items = [
    { label: "Courses", value: String(courses) },
    { label: "Lessons done", value: `${doneLessons}/${totalLessons}` },
    { label: "Finished", value: `${completeCourses}/${courses}` },
    { label: "Overall", value: `${pct}%` },
  ];
  return (
    <div
      className="mt-9 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
      aria-busy={loading || undefined}
    >
      {items.map((m) => (
        <div key={m.label} className="club-b-card px-3 py-3 text-center">
          {loading ? (
            <div
              className="mx-auto h-[22px] w-12 rounded-full bg-ink/10 motion-safe:animate-pulse"
              aria-hidden
            />
          ) : (
            <p className="font-display text-[22px] font-extrabold leading-none tabular-nums text-ink">
              {m.value}
            </p>
          )}
          <p className="mt-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-soft">
            {m.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/* LOADING ≠ EMPTY (§0.4). Shaped like the cards it becomes, and it never
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
    <div className="mt-10 flex flex-col gap-2.5" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="club-b-card flex items-start gap-3 px-4 py-4">
          <div className="h-[34px] w-[34px] shrink-0 animate-pulse rounded-[10px] bg-sand/60" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="h-4 w-1/2 animate-pulse rounded bg-sand/60" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-sand/40" />
            <div className="h-1.5 w-24 animate-pulse rounded-full bg-sand/50" />
          </div>
        </div>
      ))}
    </div>
  );
}
