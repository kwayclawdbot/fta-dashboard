/**
 * THE STREAK — one definition, one implementation, every surface.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * THE DEFINITION (canonical, and the only one in this codebase)
 *
 *   A member's streak is the number of CONSECUTIVE LOCAL CALENDAR DAYS, walking
 *   backwards from today, on which they earned at least one XP event
 *   (`xp_events`, any kind, amount > 0).
 *
 *   • XP is the app's single record of "the member did something that counts".
 *     Lessons, quizzes, flashcards, games, Club posts, RSVPs and bonuses all
 *     write an `xp_events` row, so this one read covers every qualifying action
 *     without a surface having to enumerate them.
 *   • LOCAL days, not UTC. A member in UTC-8 acting at 6pm must not have it
 *     counted as tomorrow.
 *   • A day that is still young does not break a streak. The walk starts at
 *     today; if today is empty it starts at yesterday. So a 3-day streak stays
 *     3 all morning and becomes 4 the moment the member acts.
 *   • Zero is a real answer (nothing yet, or the last action was ≥2 days ago).
 *     `null` is reserved for a FAILED read and must render as an absence, never
 *     as a zero.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHAT THIS REPLACED
 *
 *   Two divergent computations shipped at once and disagreed on the same
 *   member's screen:
 *
 *     · /courses (LearnSurface) counted consecutive days with a `lesson_progress`
 *       COMPLETION. A member who ran flashcards, played a game and posted to the
 *       Club every day for a week saw 0.
 *     · /progress (ProfileSurface) counted consecutive days with an `xp_events`
 *       row — the wider, correct definition — but implemented it inline with its
 *       own day-key helper.
 *
 *   Both now call `computeStreak` here, over the same `xp_events` read, so the
 *   number is the same object on Home, /progress and /courses.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * NO CLOCK IN RENDER. Every function takes `nowMs` IN. Server callers pass
 * `Date.now()` at request time; client callers pass a value resolved in an
 * effect or from the hour-bucketed store — never a clock read during render.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

/** How far back the streak read looks. A streak longer than this is capped by
 *  the read, not by the definition — 400 days is well past any real run and
 *  keeps the query bounded. */
const LOOKBACK_DAYS = 400;
/** PostgREST caps rows; a year of activity for one member sits far inside this. */
const MAX_EVENTS = 2000;

export interface StreakResult {
  /** Consecutive local days ending today or yesterday. 0 = no streak. */
  days: number;
  /** Oldest→newest 7-day window ending TODAY, for the pip row. */
  window7: boolean[];
  /** True when the member has already acted today (drives "keep it alive" copy). */
  actedToday: boolean;
}

export const EMPTY_STREAK: StreakResult = {
  days: 0,
  window7: [false, false, false, false, false, false, false],
  actedToday: false,
};

/** Local-calendar day key — the unit the whole definition is written in. */
export function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function shiftDays(d: Date, n: number): Date {
  const t = new Date(d);
  t.setDate(t.getDate() + n);
  return t;
}

/**
 * THE computation. Pure: timestamps in, streak out, `nowMs` supplied by the
 * caller. Any ISO timestamp list works, but the canonical input is
 * `xp_events.created_at` — see `fetchStreak`.
 */
export function computeStreak(
  isoTimestamps: (string | null | undefined)[],
  nowMs: number
): StreakResult {
  const days = new Set<string>();
  for (const iso of isoTimestamps) {
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    days.add(dayKeyLocal(d));
  }

  // Noon anchor: shifting by whole days from midday can never be dragged across
  // a boundary by a DST hour.
  const today = new Date(nowMs);
  today.setHours(12, 0, 0, 0);

  const window7: boolean[] = [];
  for (let i = 6; i >= 0; i -= 1) window7.push(days.has(dayKeyLocal(shiftDays(today, -i))));

  const actedToday = days.has(dayKeyLocal(today));
  if (days.size === 0) return { days: 0, window7, actedToday: false };

  let cursor = actedToday ? today : shiftDays(today, -1);
  let count = 0;
  while (days.has(dayKeyLocal(cursor))) {
    count += 1;
    cursor = shiftDays(cursor, -1);
  }
  return { days: count, window7, actedToday };
}

/**
 * The canonical READ + computation for one member. Returns `null` only when the
 * query itself failed — callers must render that as an absence, not a zero.
 *
 * Works with any client (RSC, browser, service-role); RLS already scopes
 * `xp_events` to the owner, and the explicit `user_id` filter keeps it correct
 * under an admin client too.
 */
export async function fetchStreak(
  supabase: DB,
  userId: string,
  nowMs: number
): Promise<StreakResult | null> {
  const since = new Date(nowMs - LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("xp_events")
    .select("created_at, amount")
    .eq("user_id", userId)
    .gt("amount", 0)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_EVENTS);
  if (error) return null;
  return computeStreak(
    ((data ?? []) as { created_at: string }[]).map((r) => r.created_at),
    nowMs
  );
}
