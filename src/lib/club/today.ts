import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchStreak } from "@/lib/streak";
import { getRequestHomeBoot, type HomeBoot } from "@/lib/supabase/rsc";

/**
 * TODAY — the adult Club home's daily loop payload.
 *
 * The Club home computed nine sections of "what the room is doing" and never
 * once answered the only question a returning member actually opens the app
 * with: WHAT DO I DO TODAY? The loop the teen home already had (one thing →
 * the small stuff that's due → proof you did it) had no adult twin, so the
 * member's own due work sat four taps deep behind /flashcards and three behind
 * /alerts and was, in practice, never done.
 *
 * This assembles the four reads that answer it, in ONE parallel batch:
 *
 *   · lesson  — the member's REAL next lesson, from `get_home_state` (the same
 *               RPC the home route already calls), plus the honest N-of-M for
 *               the course it belongs to (`lesson_progress` over `lessons`).
 *   · streak  — THE canonical streak (src/lib/streak.ts). One definition.
 *   · cardsDue— `flashcard_reviews` rows whose `due_at` has arrived. The real
 *               SRS queue, not "5".
 *   · watchTriggered — Kai Watches currently sitting in `triggered`, read off
 *               the `watch_current_state` view (latest transition per rule),
 *               scoped by RLS to this member's own rules.
 *
 * EVERY FIELD IS NULLABLE AND NULL MEANS "THE READ DID NOT LAND". Zero is a
 * real zero and renders as the honest empty state; null renders as nothing at
 * all. Loading is never drawn as empty — the caller has a skeleton.
 *
 * NO CLOCK IN RENDER: `nowMs` and the local day are resolved HERE, on the
 * server, at request time, and travel to the client as finished numbers.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

export interface TodayLesson {
  title: string;
  href: string;
  /** "Module · Course" — where this lesson sits. */
  context: string | null;
  courseTitle: string | null;
  /** Lessons completed in this lesson's COURSE. null = not resolvable. */
  done: number | null;
  /** Lessons in this lesson's course. null = not resolvable. */
  total: number | null;
}

export interface TodayLoop {
  lesson: TodayLesson | null;
  /** Canonical streak in days. null = the read failed (render nothing). */
  streakDays: number | null;
  /** Whether the member has already earned XP today (drives the copy). */
  actedToday: boolean;
  /** Flashcards whose SRS due date has arrived. null = read failed. */
  cardsDue: number | null;
  /** Kai Watches currently in the `triggered` state. null = read failed. */
  watchTriggered: number | null;
}

interface HomeStateRow {
  program: "fic" | "fta" | null;
  today: {
    lesson_id: string;
    title: string;
    module_id: string;
    module_title: string;
    course_slug: string;
    course_title: string;
  } | null;
}

/** Local (server) calendar date as `YYYY-MM-DD` — the `due_at` column's type. */
function todayDateStr(nowMs: number): string {
  const d = new Date(nowMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * How far through the course the next lesson sits. One nested read, matching
 * the shape /courses and /progress already use, so the number on Home is the
 * same number those surfaces show.
 */
async function courseProgress(
  supabase: DB,
  userId: string,
  courseSlug: string
): Promise<{ done: number; total: number } | null> {
  const [{ data: course }, { data: prog }] = await Promise.all([
    supabase
      .from("courses")
      .select("slug, modules(lessons(id))")
      .eq("slug", courseSlug)
      .maybeSingle(),
    supabase
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .eq("status", "completed"),
  ]);
  if (!course) return null;
  const nested = course as unknown as {
    modules: { lessons: { id: string }[] | null }[] | null;
  };
  const lessonIds = (nested.modules ?? []).flatMap((m) => (m.lessons ?? []).map((l) => l.id));
  if (lessonIds.length === 0) return null;
  const completed = new Set(((prog ?? []) as { lesson_id: string }[]).map((p) => p.lesson_id));
  return {
    done: lessonIds.filter((id) => completed.has(id)).length,
    total: lessonIds.length,
  };
}

/**
 * Build the whole loop payload for one member. NEVER throws — every read
 * degrades to null on its own, so a broken watch table can't take the hero
 * lesson down with it.
 */
export async function buildTodayLoop(
  supabase: DB,
  userId: string,
  nowMs: number = Date.now()
): Promise<TodayLoop> {
  const dueBy = todayDateStr(nowMs);

  const [stateRes, streakRes, cardsRes, watchRes] = await Promise.all([
    supabase.rpc("get_home_state", { p_user_id: userId }).then(
      (r: { data: unknown }) => r.data as HomeStateRow | null,
      () => null
    ),
    fetchStreak(supabase, userId, nowMs).catch(() => null),
    Promise.resolve(
      supabase
        .from("flashcard_reviews")
        .select("card_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .lte("due_at", dueBy)
    ).catch(() => null),
    // `watch_current_state` is security_invoker over watch_states, whose RLS
    // joins alert_rules.user_id — so this is already this member's watches only.
    Promise.resolve(
      supabase.from("watch_current_state").select("rule_id, state").eq("state", "triggered")
    ).catch(() => null),
  ]);

  let lesson: TodayLesson | null = null;
  if (stateRes?.today) {
    const t = stateRes.today;
    const prog = await courseProgress(supabase, userId, t.course_slug).catch(() => null);
    lesson = {
      title: t.title,
      href: `/courses/${t.course_slug}/${t.module_id}/${t.lesson_id}`,
      context: t.module_title ? `${t.module_title} · ${t.course_title}` : t.course_title ?? null,
      courseTitle: t.course_title ?? null,
      done: prog?.done ?? null,
      total: prog?.total ?? null,
    };
  }

  const cardsDue =
    cardsRes && !cardsRes.error && typeof cardsRes.count === "number" ? cardsRes.count : null;

  const watchTriggered =
    watchRes && !watchRes.error && Array.isArray(watchRes.data) ? watchRes.data.length : null;

  return {
    lesson,
    streakDays: streakRes?.days ?? null,
    actedToday: streakRes?.actedToday ?? false,
    cardsDue,
    watchTriggered,
  };
}

/**
 * THE SAME LOOP, READ OFF THE BOOT PAYLOAD.
 *
 * `buildTodayLoop` above is six round trips (get_home_state, a 400-day
 * xp_events scan for the streak, flashcard_reviews, watch_current_state, and
 * then a dependent two-query course-progress read) — every one of them for a
 * fact that `get_home_boot` (migration 217) already computed in the SAME
 * payload the layout and the home route are reading. On the RSC path it is
 * therefore free: the boot is request-scoped, so this shapes what is already in
 * hand and issues no query at all.
 *
 * NULL STILL MEANS "THE READ DID NOT LAND", per field, exactly as before: a
 * missing boot degrades the whole loop to the six-query path rather than
 * inventing zeros.
 */
export function todayLoopFromBoot(boot: HomeBoot): TodayLoop {
  const t = boot.home_state?.today ?? null;
  const prog =
    t && boot.course_progress?.slug === t.course_slug ? boot.course_progress : null;

  return {
    lesson: t
      ? {
          title: t.title,
          href: `/courses/${t.course_slug}/${t.module_id}/${t.lesson_id}`,
          context: t.module_title ? `${t.module_title} · ${t.course_title}` : t.course_title ?? null,
          courseTitle: t.course_title ?? null,
          done: prog?.done ?? null,
          total: prog?.total ?? null,
        }
      : null,
    streakDays: boot.streak?.days ?? null,
    actedToday: boot.streak?.acted_today ?? false,
    cardsDue: boot.cards_due ?? null,
    watchTriggered: boot.watch_triggered ?? null,
  };
}

/**
 * RSC entry point. NEVER rejects — the promise is handed straight to a client
 * component and awaited with `use()`, so a rejection would take the whole Home
 * surface down. `null` = no seed, and the client falls back to fetching
 * /api/club/today.
 *
 * Reads the request-scoped boot first (zero round trips — the layout has
 * already paid for it) and only falls back to the six-query assembly if the
 * boot did not land.
 */
export function buildTodaySeed(supabase: DB, userId: string): Promise<TodayLoop | null> {
  return (async () => {
    const boot = await getRequestHomeBoot();
    if (boot) return todayLoopFromBoot(boot);
    return await buildTodayLoop(supabase, userId);
  })().catch((err) => {
    console.error("[club/today] seed failed:", err);
    return null;
  });
}
