"use client";

/**
 * KID TODAY HERO — a kid always lands on something real to do.
 *
 * The defect this fixes: when `get_home_state` returns `program: null` (the
 * household has no enrollment row yet) the Home rendered an ADULT upsell block —
 * "Your family isn't enrolled yet · See programs" — at a child. Kids never see
 * upsell in this codebase, and a kid at 0 XP was left with no action at all. The
 * second path is the same kid on an enrolled family with no `today` lesson,
 * where Home congratulated them ("You did it! All caught up") before they had
 * done anything.
 *
 * This hero replaces BOTH for kids, and it never renders empty. It resolves, in
 * order, from content that already exists:
 *   1. the first FIC mission they haven't completed — `fic_missions` ordered by
 *      `sort` minus their own `mission_completions` (the same pair /missions and
 *      the Learn surface read). Playing it stays on /missions, which owns the
 *      evidence + XP flow.
 *   2. the next unfinished published FIC lesson on their track — `lessons`
 *      joined to published fic `courses`, minus their own completed
 *      `lesson_progress`, ordered the way `get_home_state` orders it
 *      (drip_week, course, module, lesson) so "next" means the same thing here
 *      as it does on an enrolled family's Home.
 *   3. KID_FIRST_ADVENTURE (register.ts) — the honest final fallback, and what
 *      renders instantly at 0 XP while 1 and 2 are still in flight, so first
 *      paint is never actionless.
 *
 * RLS: everything read here is the kid's own or public-to-members —
 * `fic_missions` is `select ... using (true)` for authenticated,
 * `mission_completions` is family-scoped read, `lesson_progress` is own-row, and
 * courses/modules/lessons are readable for any published course. No parent role
 * is involved on any path.
 *
 * KID-SAFE: no prices, no tickers, no dollar figures anywhere in this object —
 * it is lessons and missions only.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PlayCircle, Target, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, LOAD_TIMEOUT_MS } from "@/lib/async";
import { KID_FIRST_ADVENTURE } from "@/lib/register";

interface Action {
  eyebrow: string;
  title: string;
  body: string | null;
  cta: string;
  href: string;
  /** Swaps the eyebrow mark — a win is a trophy, a to-do is a target. */
  won?: boolean;
}

/** Shown at once, and kept if nothing better resolves. Both are real doors. */
function baseAction(xp: number): Action {
  if (xp <= 0) {
    return {
      eyebrow: "Today's adventure",
      title: KID_FIRST_ADVENTURE.title,
      body: KID_FIRST_ADVENTURE.body,
      cta: KID_FIRST_ADVENTURE.cta,
      href: KID_FIRST_ADVENTURE.href,
    };
  }
  return {
    eyebrow: "Today's adventure",
    title: "Your next adventure is waiting",
    body: "Pick up where you left off and keep the streak going.",
    cta: "Open my lessons",
    href: "/courses",
  };
}

/* PostgREST embeds: a to-one relation comes back as an OBJECT at runtime, but
   supabase-js types it as an array. Both shapes are accepted and narrowed by
   `one()` rather than trusting either one. */
type Rel<T> = T | T[] | null | undefined;

type CourseRel = {
  slug: string;
  program: string;
  published: boolean;
  sort_order: number | null;
};

type ModuleRel = {
  track: string | null;
  sort_order: number | null;
  courses: Rel<CourseRel>;
};

type LessonRow = {
  id: string;
  title: string;
  description: string | null;
  module_id: string;
  drip_week: number | null;
  sort_order: number | null;
  modules: Rel<ModuleRel>;
};

function one<T>(v: Rel<T>): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default function KidTodayHero({
  xp,
  track,
  art,
}: {
  xp: number;
  /** The kid's content track, from get_home_state. Defaults to "kids". */
  track?: string | null;
  /** Hero art, chosen by the caller so the surface keeps one art vocabulary. */
  art: string;
}) {
  const [action, setAction] = useState<Action>(() => baseAction(xp));

  useEffect(() => {
    let live = true;
    const supabase = createClient();
    const band = track || "kids";

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId || !live) return;

      // ── 1. first unfinished mission ────────────────────────────────────
      const [missions, mine] = await Promise.all([
        withTimeout<{
          data: { id: string; title: string; kid_prompt: string | null; description: string | null }[] | null;
        }>(
          supabase
            .from("fic_missions")
            .select("id, title, kid_prompt, description, sort")
            .order("sort", { ascending: true }),
          LOAD_TIMEOUT_MS,
          { data: null }
        ),
        withTimeout<{ data: { mission_id: string }[] | null }>(
          supabase.from("mission_completions").select("mission_id").eq("user_id", userId),
          LOAD_TIMEOUT_MS,
          { data: null }
        ),
      ]);
      if (!live) return;

      const done = new Set((mine.data ?? []).map((r) => r.mission_id));
      const nextMission = (missions.data ?? []).find((m) => !done.has(m.id));
      if (nextMission) {
        setAction({
          eyebrow: "Today's adventure",
          title: nextMission.title,
          body: nextMission.kid_prompt || nextMission.description,
          cta: "Start the adventure",
          href: "/missions",
        });
        return;
      }

      // ── 2. next unfinished published FIC lesson on this track ──────────
      const [lessons, progress] = await Promise.all([
        withTimeout<{ data: LessonRow[] | null }>(
          supabase
            .from("lessons")
            .select(
              "id, title, description, module_id, drip_week, sort_order, modules!inner(track, sort_order, courses!inner(slug, program, published, sort_order))"
            )
            .limit(200) as unknown as PromiseLike<{ data: LessonRow[] | null }>,
          LOAD_TIMEOUT_MS,
          { data: null }
        ),
        withTimeout<{ data: { lesson_id: string }[] | null }>(
          supabase
            .from("lesson_progress")
            .select("lesson_id")
            .eq("user_id", userId)
            .eq("status", "completed"),
          LOAD_TIMEOUT_MS,
          { data: null }
        ),
      ]);
      if (!live) return;

      const finished = new Set((progress.data ?? []).map((r) => r.lesson_id));
      const open = (lessons.data ?? [])
        .filter((l) => {
          const mod = one(l.modules);
          const course = one(mod?.courses);
          if (!course?.published || course.program !== "fic") return false;
          if (mod?.track && mod.track !== band) return false;
          return !finished.has(l.id);
        })
        .sort(
          (a, b) =>
            (a.drip_week ?? 0) - (b.drip_week ?? 0) ||
            (one(one(a.modules)?.courses)?.sort_order ?? 0) -
              (one(one(b.modules)?.courses)?.sort_order ?? 0) ||
            (one(a.modules)?.sort_order ?? 0) - (one(b.modules)?.sort_order ?? 0) ||
            (a.sort_order ?? 0) - (b.sort_order ?? 0)
        );

      const nextLesson = open[0];
      const slug = one(one(nextLesson?.modules)?.courses)?.slug;
      if (nextLesson && slug) {
        setAction({
          eyebrow: "Today's adventure",
          title: nextLesson.title,
          body: nextLesson.description,
          cta: "Start the lesson",
          href: `/courses/${slug}/${nextLesson.module_id}/${nextLesson.id}`,
        });
        return;
      }

      // ── 3. genuinely nothing left. Only a kid who has ALREADY done work has
      //       earned the win screen — at 0 XP the first-adventure door stands,
      //       because "you did it" at zero is the exact lie the audit flagged.
      if (xp > 0) {
        setAction({
          eyebrow: "All caught up",
          title: "You did it — everything's done",
          body: "Every lesson and adventure is finished. Practice your skills, or show a grown-up what you learned.",
          cta: "Practice patterns",
          href: "/simulator/lessons",
          won: true,
        });
      }
    })().catch(() => {
      /* base action stands */
    });

    return () => {
      live = false;
    };
    // xp only decides the FALLBACK copy; it must not refire the resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  return (
    <section className="f0-hero-field relative">
      <Image
        src={art}
        alt=""
        fill
        sizes="(max-width: 1024px) 100vw, 60vw"
        className="object-cover"
        priority
      />
      <div className="f0-hero-scrim" />
      <div className="relative px-6 py-8 lg:px-9 lg:py-11">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
          {action.won ? (
            <Trophy className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Target className="h-3.5 w-3.5" aria-hidden />
          )}
          {action.eyebrow}
        </span>
        <h2 className="mt-4 max-w-xl font-display text-display-2 font-extrabold leading-tight text-white">
          {action.title}
        </h2>
        {action.body && (
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">
            {action.body}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href={action.href}
            className="cta-button f0-focus inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm"
          >
            <PlayCircle className="h-4 w-4" />
            {action.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}
