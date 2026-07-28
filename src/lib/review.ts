import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * TODAY'S REVIEW — the first consumer of the spaced-repetition scheduler.
 *
 * `skill_mastery` (migration 166) has been writing a real SM-lite schedule for
 * every lesson interaction since it shipped: correct answers double the
 * interval and push `next_review_at` out, wrong ones pull it back inside a day.
 * NOTHING HAS EVER READ `next_review_at`. The scheduler has been running into a
 * void — the app knew exactly which concepts a member was about to forget and
 * never once told them.
 *
 * This is the read side. Two due queues, both real:
 *
 *   · CARDS   — `flashcard_reviews.due_at <= today`. The existing flashcard SRS,
 *               which already had a UI but no "what's due" surface outside the
 *               Daily 5 picker.
 *   · SKILLS  — `skill_mastery.next_review_at <= now`. The concepts the lesson
 *               engine has been scheduling, joined to `skills` for the name and
 *               to `lesson_skills` → `lessons` for the lesson that teaches it.
 *
 * And the write side is the EXISTING mastery path, not a new one:
 * `recordSkillReview` calls `bump_skill_mastery(p_skill_id, p_correct)` — the
 * same SECURITY DEFINER RPC the LessonEngine calls — so a review answered here
 * moves mastery and reschedules `next_review_at` by exactly the same rules as
 * an answer inside a lesson. No parallel scheduler, no second definition of
 * "due".
 *
 * NO CLOCK IN RENDER: the caller resolves `nowMs` in its load effect and passes
 * it in.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

export interface DueSkill {
  skillId: string;
  name: string;
  domain: string | null;
  /** 0–100. The member's current mastery of this concept. */
  mastery: number;
  /** When the scheduler wanted it back. */
  dueAt: string;
  /** The lesson that teaches it, when one is mapped. null = no link, say so. */
  lessonHref: string | null;
  lessonTitle: string | null;
}

export interface DueReview {
  /** Flashcards whose SRS date has arrived. */
  cardsDue: number;
  /** Concepts the scheduler has queued, soonest-overdue first. */
  skills: DueSkill[];
}

export const EMPTY_REVIEW: DueReview = { cardsDue: 0, skills: [] };

const MAX_SKILLS = 8;

function dateStr(nowMs: number): string {
  const d = new Date(nowMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Everything due for one member right now. Never throws: a failed leg returns
 * its empty value, so a missing lesson mapping can't take the card count down.
 */
export async function loadDueReview(
  supabase: DB,
  userId: string,
  nowMs: number
): Promise<DueReview> {
  const nowIso = new Date(nowMs).toISOString();

  const [cardsRes, masteryRes] = await Promise.all([
    Promise.resolve(
      supabase
        .from("flashcard_reviews")
        .select("card_id", { count: "exact", head: true })
        .eq("user_id", userId)
        .lte("due_at", dateStr(nowMs))
    ).catch(() => null),
    Promise.resolve(
      supabase
        .from("skill_mastery")
        .select("skill_id, mastery_score, next_review_at")
        .eq("user_id", userId)
        .not("next_review_at", "is", null)
        .lte("next_review_at", nowIso)
        .order("next_review_at", { ascending: true })
        .limit(MAX_SKILLS)
    ).catch(() => null),
  ]);

  const cardsDue =
    cardsRes && !cardsRes.error && typeof cardsRes.count === "number" ? cardsRes.count : 0;

  const rows = (masteryRes && !masteryRes.error ? masteryRes.data : null) as
    | { skill_id: string; mastery_score: number; next_review_at: string }[]
    | null;
  if (!rows || rows.length === 0) return { cardsDue, skills: [] };

  const ids = rows.map((r) => r.skill_id);

  // Names, and the lesson that teaches each concept. Both are best-effort: a
  // skill with no lesson mapping still renders, it just has nowhere to send you
  // and says so rather than linking into a guess.
  const [skillsRes, mapRes] = await Promise.all([
    Promise.resolve(supabase.from("skills").select("id, name, domain").in("id", ids)).catch(
      () => null
    ),
    Promise.resolve(
      supabase
        .from("lesson_skills")
        .select("skill_id, weight, lessons(id, title, module_id, modules(courses(slug)))")
        .in("skill_id", ids)
        .order("weight", { ascending: false })
    ).catch(() => null),
  ]);

  const nameById = new Map<string, { name: string; domain: string | null }>();
  for (const s of ((skillsRes?.data ?? []) as { id: string; name: string; domain: string | null }[])) {
    nameById.set(s.id, { name: s.name, domain: s.domain });
  }

  // PostgREST returns embedded relations as an object OR an array depending on
  // cardinality inference, so both shapes are unwrapped defensively.
  const one = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

  const lessonBySkill = new Map<string, { href: string; title: string }>();
  type MapRow = {
    skill_id: string;
    lessons:
      | {
          id: string;
          title: string | null;
          module_id: string | null;
          modules: { courses: { slug: string } | { slug: string }[] | null } | null | Array<{
            courses: { slug: string } | { slug: string }[] | null;
          }>;
        }
      | null
      | Array<unknown>;
  };
  for (const raw of ((mapRes?.data ?? []) as unknown as MapRow[])) {
    if (lessonBySkill.has(raw.skill_id)) continue; // highest weight wins
    const lesson = one(raw.lessons as never) as {
      id: string;
      title: string | null;
      module_id: string | null;
      modules: unknown;
    } | null;
    if (!lesson?.id || !lesson.module_id) continue;
    const mod = one(lesson.modules as never) as { courses: unknown } | null;
    const course = one(mod?.courses as never) as { slug: string } | null;
    if (!course?.slug) continue;
    lessonBySkill.set(raw.skill_id, {
      href: `/courses/${course.slug}/${lesson.module_id}/${lesson.id}`,
      title: lesson.title || "the lesson",
    });
  }

  const skills: DueSkill[] = rows.map((r) => {
    const meta = nameById.get(r.skill_id);
    const lesson = lessonBySkill.get(r.skill_id) ?? null;
    return {
      skillId: r.skill_id,
      // A skill with no `skills` row is a schedule for something unnamed — show
      // the id rather than dropping the member's own due work on the floor.
      name: meta?.name ?? r.skill_id,
      domain: meta?.domain ?? null,
      mastery: Math.max(0, Math.min(100, Number(r.mastery_score) || 0)),
      dueAt: r.next_review_at,
      lessonHref: lesson?.href ?? null,
      lessonTitle: lesson?.title ?? null,
    };
  });

  return { cardsDue, skills };
}

/**
 * Record a review answer. THE EXISTING PATH: `bump_skill_mastery` is the same
 * RPC the lesson engine calls, so mastery moves and `next_review_at` is
 * rescheduled by the one set of rules. Returns false when the write failed, so
 * the caller can leave the row where it is instead of pretending.
 */
export async function recordSkillReview(
  supabase: DB,
  skillId: string,
  correct: boolean
): Promise<boolean> {
  const { error } = await supabase.rpc("bump_skill_mastery", {
    p_skill_id: skillId,
    p_correct: correct,
  });
  return !error;
}
