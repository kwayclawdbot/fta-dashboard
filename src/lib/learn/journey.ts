/**
 * Learning World — journey data layer (FIC-LEARNING-WORLD §3, §8).
 *
 * Builds the vertical world-path from the REAL curriculum (courses/modules/
 * lessons), the preserved completion record (lesson_progress), and the skill
 * mapping (lesson_skills, migration 165). Plus the habit-loop state: the daily
 * goal (1 Learn · 1 Practice · 1 Apply), the streak (any goal item per the
 * ratified rule), and the count of due reviews. Everything deterministic — zero
 * LLM, and XP is never derived from simulator returns.
 *
 * All reads are own-row / own-family RLS scoped and best-effort: a missing table
 * degrades to an empty/absent state rather than throwing into the UI.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WORLDS,
  worldForSkills,
  type Journey,
  type JourneyNode,
  type JourneyWorld,
  type NodeState,
} from "@/lib/learn/worlds";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

interface LessonRow {
  id: string;
  title: string;
  sort_order: number;
}
interface ModuleRow {
  id: string;
  track: string | null;
  sort_order: number;
  lessons: LessonRow[];
}
interface CourseRow {
  id: string;
  slug: string;
  sort_order: number;
  modules: ModuleRow[];
}

/** A lesson flattened out of the course, already tagged with its world. */
interface FlatLesson {
  id: string;
  title: string;
  moduleId: string;
  courseSlug: string;
  order: number; // curriculum order
  worldIndex: number;
}

function xpMeta(done: boolean): string {
  return done ? "Done · +50 XP" : "4 min · +50 XP";
}

/**
 * Build the member's 5-world journey for their own track (kids/teens/adults).
 * Groups the foundations lessons into worlds by primary skill, sequences them,
 * and derives done/current/locked node states from lesson_progress. Injects the
 * synthetic game/review/boss nodes the spec asks for (games-as-nodes, §7).
 */
export async function buildJourney(
  supabase: DB,
  opts: { userId: string; track: string; dueReviews: number }
): Promise<Journey> {
  const empty: Journey = {
    worlds: [],
    current: null,
    currentWorldIndex: 0,
    totalLessons: 0,
    doneLessons: 0,
    pct: 0,
    courseSlug: null,
  };

  try {
    const [{ data: courses }, { data: prog }] = await Promise.all([
      supabase
        .from("courses")
        .select(
          "id, slug, sort_order, modules(id, track, sort_order, lessons(id, title, sort_order))"
        )
        .eq("program", "fic")
        .eq("published", true)
        .order("sort_order"),
      supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", opts.userId)
        .eq("status", "completed"),
    ]);

    const all = (courses || []) as unknown as CourseRow[];
    // The member's own-track foundations course.
    const mine = all.find((c) =>
      (c.modules || []).some((m) => m.track === opts.track)
    );
    if (!mine) return empty;

    const completed = new Set((prog || []).map((r) => r.lesson_id));

    // Flatten lessons in curriculum order (module sort, then lesson sort).
    const flat: FlatLesson[] = [];
    const modules = [...(mine.modules || [])]
      .filter((m) => m.track === opts.track)
      .sort((a, b) => a.sort_order - b.sort_order);
    let order = 0;
    for (const m of modules) {
      const lessons = [...(m.lessons || [])].sort(
        (a, b) => a.sort_order - b.sort_order
      );
      for (const l of lessons) {
        flat.push({
          id: l.id,
          title: l.title,
          moduleId: m.id,
          courseSlug: mine.slug,
          order: order++,
          worldIndex: 0, // filled from skills below
        });
      }
    }
    if (flat.length === 0) return empty;

    // Tag each lesson with its world via lesson_skills (primary = highest weight).
    const lessonIds = flat.map((l) => l.id);
    const { data: skillRows } = await supabase
      .from("lesson_skills")
      .select("lesson_id, skill_id, weight")
      .in("lesson_id", lessonIds);
    const primarySkill = new Map<string, { skill: string; weight: number }>();
    for (const r of (skillRows || []) as {
      lesson_id: string;
      skill_id: string;
      weight: number;
    }[]) {
      const cur = primarySkill.get(r.lesson_id);
      if (!cur || r.weight > cur.weight)
        primarySkill.set(r.lesson_id, { skill: r.skill_id, weight: r.weight });
    }
    for (const l of flat) {
      const p = primarySkill.get(l.id);
      l.worldIndex = worldForSkills(p ? [p.skill] : null);
    }

    // Group by world, preserving curriculum order within a world; worlds render
    // in canonical order 0..4 (the consistent 5-world spine).
    const byWorld: FlatLesson[][] = WORLDS.map(() => []);
    for (const l of flat) byWorld[l.worldIndex].push(l);
    for (const arr of byWorld) arr.sort((a, b) => a.order - b.order);

    // World-flattened sequence → the single "current" (first incomplete) lesson.
    const sequence: FlatLesson[] = byWorld.flat();
    const doneLessons = sequence.filter((l) => completed.has(l.id)).length;
    const totalLessons = sequence.length;
    const currentLessonId =
      sequence.find((l) => !completed.has(l.id))?.id ?? null;

    const currentWorldIndex = currentLessonId
      ? (flat.find((l) => l.id === currentLessonId)?.worldIndex ?? 0)
      : WORLDS.length - 1;

    function lessonState(l: FlatLesson): NodeState {
      if (completed.has(l.id)) return "done";
      if (l.id === currentLessonId) return "current";
      return "locked";
    }

    let current: JourneyNode | null = null;

    const worlds: JourneyWorld[] = WORLDS.map((world, wi) => {
      const lessons = byWorld[wi];
      const doneHere = lessons.filter((l) => completed.has(l.id)).length;
      const totalHere = lessons.length;
      const containsCurrent = lessons.some((l) => l.id === currentLessonId);

      let wState: NodeState;
      if (totalHere === 0) wState = wi <= currentWorldIndex ? "available" : "locked";
      else if (doneHere === totalHere) wState = "done";
      else if (doneHere > 0 || containsCurrent) wState = "current";
      else wState = wi < currentWorldIndex ? "available" : "locked";

      const nodes: JourneyNode[] = [];

      // A review node opens the current world when concepts are due (non-gating).
      if (containsCurrent && opts.dueReviews > 0) {
        nodes.push({
          key: `review-${world.id}`,
          kind: "review",
          title: "Quick Review",
          state: "available",
          href: "/flashcards",
          meta: `${opts.dueReviews} concept${opts.dueReviews === 1 ? "" : "s"} due`,
          worldIndex: wi,
        });
      }

      for (const l of lessons) {
        const st = lessonState(l);
        const node: JourneyNode = {
          key: `lesson-${l.id}`,
          kind: "lesson",
          title: l.title,
          state: st,
          href:
            st === "locked"
              ? null
              : `/courses/${l.courseSlug}/${l.moduleId}/${l.id}`,
          meta: xpMeta(st === "done"),
          worldIndex: wi,
        };
        nodes.push(node);
        if (st === "current" && !current) current = node;
      }

      // Games live in "Think Like an Investor" (technical_analysis, world 4):
      // chart-reading practice as its own path nodes (games-as-nodes, §7).
      if (world.id === "mindset" && totalHere > 0) {
        const gameState: NodeState = wState === "locked" ? "locked" : "available";
        nodes.push(
          {
            key: "game-candle-battle",
            kind: "game",
            title: "Candle Battle",
            state: gameState,
            href: gameState === "locked" ? null : "/games",
            meta: "Read the chart",
            worldIndex: wi,
          },
          {
            key: "game-trend-or-trap",
            kind: "game",
            title: "Trend or Trap",
            state: gameState,
            href: gameState === "locked" ? null : "/games",
            meta: "Spot the setup",
            worldIndex: wi,
          }
        );
      }

      // A Boss Challenge caps every world with lessons — a locked teaser until the
      // world is finished (the mastery-challenge mechanic itself is P6).
      if (totalHere > 0) {
        nodes.push({
          key: `boss-${world.id}`,
          kind: "boss",
          title: `Boss: ${world.name}`,
          state: wState === "done" ? "available" : "locked",
          href: null, // teaser — grading is P6
          meta: wState === "done" ? "Ready soon" : "Boss Challenge",
          worldIndex: wi,
        });
      }

      return {
        index: wi,
        world,
        nodes,
        doneLessons: doneHere,
        totalLessons: totalHere,
        state: wState,
      };
    });

    return {
      worlds,
      current,
      currentWorldIndex,
      totalLessons,
      doneLessons,
      pct: totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0,
      courseSlug: mine.slug,
    };
  } catch {
    return empty;
  }
}

/* ── Habit loop: daily goal · streak · reviews ───────────────────────────── */

export interface DailyGoalItem {
  key: "learn" | "practice" | "apply";
  label: string;
  hint: string;
  done: boolean;
  href: string;
}

export interface DailyState {
  items: DailyGoalItem[];
  completedCount: number; // 0–3
  allDone: boolean;
  streakDays: number;
  /** The stable ref for the once-per-day 3/3 bonus (dedupe via xp_events). */
  bonusRef: string;
}

function midnightISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Resolve the daily goal (1 Learn · 1 Practice · 1 Apply) + the streak, from
 * real state. Learn = a lesson XP event today; Practice = a flashcards/game XP
 * event today; Apply = a real-world action today (community XP, or a ticker
 * added to the family watchlist). Streak = consecutive days with ANY goal item
 * (the ratified rule), computed from the xp_events ledger (no new table).
 */
export async function loadDailyState(
  supabase: DB,
  userId: string,
  opts: { familyId: string | null; nextLessonHref: string | null }
): Promise<DailyState> {
  const start = midnightISO();
  const today = localDateKey(new Date());

  let learn = false;
  let practice = false;
  let apply = false;
  let streakDays = 0;

  try {
    // Pull the recent ledger once — powers both today's goal and the streak.
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const { data: rows } = await supabase
      .from("xp_events")
      .select("kind, created_at")
      .eq("user_id", userId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });

    const events = (rows || []) as { kind: string; created_at: string }[];

    for (const e of events) {
      if (e.created_at >= start) {
        if (e.kind === "lesson") learn = true;
        else if (e.kind === "flashcards" || e.kind === "game") practice = true;
        else if (e.kind === "community") apply = true;
      }
    }

    // Streak: walk back day-by-day over days that have ANY xp event.
    const daysWithActivity = new Set(
      events.map((e) => localDateKey(new Date(e.created_at)))
    );
    const cursor = new Date();
    // Allow the streak to still count if nothing yet today but yesterday was active.
    if (!daysWithActivity.has(today)) cursor.setDate(cursor.getDate() - 1);
    while (daysWithActivity.has(localDateKey(cursor))) {
      streakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  } catch {
    /* ledger unavailable — goal defaults to not-done, streak 0 */
  }

  // Apply also counts a real watchlist add today (the signature real-world action).
  if (!apply && opts.familyId) {
    try {
      const { count } = await supabase
        .from("family_watchlist")
        .select("id", { count: "exact", head: true })
        .eq("family_id", opts.familyId)
        .gte("created_at", start);
      if ((count || 0) > 0) apply = true;
    } catch {
      /* table shape differs — ignore, community XP already covers Apply */
    }
  }

  const items: DailyGoalItem[] = [
    {
      key: "learn",
      label: "Learn",
      hint: "One lesson",
      done: learn,
      href: opts.nextLessonHref ?? "/learn",
    },
    {
      key: "practice",
      label: "Practice",
      hint: "A review or a game",
      done: practice,
      href: "/flashcards",
    },
    {
      key: "apply",
      label: "Apply",
      hint: "Research a real company",
      done: apply,
      href: "/discover",
    },
  ];

  const completedCount = items.filter((i) => i.done).length;

  return {
    items,
    completedCount,
    allDone: completedCount === 3,
    streakDays,
    bonusRef: `daily-goal-${today}`,
  };
}

/* ── Investor Brain: skill mastery bars ──────────────────────────────────── */

export interface BrainSkill {
  id: string;
  name: string;
  domain: string;
  mastery: number; // 0–100
  attempts: number;
}

/** Load the "YOUR INVESTOR BRAIN" bars — every skill, mastery from skill_mastery. */
export async function loadInvestorBrain(
  supabase: DB,
  userId: string
): Promise<BrainSkill[]> {
  try {
    const [{ data: skills }, { data: mastery }] = await Promise.all([
      supabase.from("skills").select("id, name, domain, sort").order("sort"),
      supabase
        .from("skill_mastery")
        .select("skill_id, mastery_score, attempts")
        .eq("user_id", userId),
    ]);
    const m = new Map(
      ((mastery || []) as {
        skill_id: string;
        mastery_score: number;
        attempts: number;
      }[]).map((r) => [r.skill_id, r])
    );
    return ((skills || []) as {
      id: string;
      name: string;
      domain: string;
    }[]).map((s) => {
      const row = m.get(s.id);
      return {
        id: s.id,
        name: s.name,
        domain: s.domain,
        mastery: row?.mastery_score ?? 0,
        attempts: row?.attempts ?? 0,
      };
    });
  } catch {
    return [];
  }
}
