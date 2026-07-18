import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * XP + gamification engine (Tier 1).
 * Deck-themed level ladder driven by lifetime XP; award helpers with the
 * de-dupe guards each action point needs (once-per-ref, once-per-day, daily cap).
 */

export type XpKind =
  | "lesson"
  | "quiz"
  | "flashcards"
  | "game"
  | "community"
  | "rsvp"
  | "bonus";

// Award amounts (single source of truth for every action point).
export const XP = {
  LESSON: 50,
  QUIZ_PASS: 30,
  QUIZ_PERFECT_BONUS: 20,
  FLASHCARDS: 20,
  GAME: 10,
  COMMUNITY: 5,
  RSVP: 5,
} as const;

// Game "round" XP only lands when the session clears this accuracy.
export const GAME_PASS_RATIO = 0.7;
// Community posts earn XP for the first N posts each day.
export const COMMUNITY_DAILY_CAP = 3;

export interface Level {
  level: number;
  name: string;
  min: number;
}

// Deck-voiced level names keyed to lifetime XP thresholds.
export const LEVELS: Level[] = [
  { level: 1, name: "Explorer", min: 0 },
  { level: 2, name: "Money Mapper", min: 150 },
  { level: 3, name: "Chart Reader", min: 400 },
  { level: 4, name: "Zone Hunter", min: 800 },
  { level: 5, name: "Sweep Spotter", min: 1400 },
  { level: 6, name: "Trade Ready", min: 2200 },
  { level: 7, name: "Playbook Pro", min: 3200 },
];

export function levelForXp(xp: number): Level {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.min) current = l;
    else break;
  }
  return current;
}

export function nextLevel(xp: number): Level | null {
  const current = levelForXp(xp);
  return LEVELS.find((l) => l.level === current.level + 1) ?? null;
}

export interface LevelProgress {
  current: Level;
  next: Level | null;
  into: number; // xp earned into the current level band
  span: number; // xp width of the current band (0 when maxed)
  pct: number; // 0-100 progress toward next level (100 when maxed)
  toNext: number; // xp remaining to next level (0 when maxed)
}

export function levelProgress(xp: number): LevelProgress {
  const current = levelForXp(xp);
  const next = nextLevel(xp);
  if (!next) {
    return { current, next: null, into: 0, span: 0, pct: 100, toNext: 0 };
  }
  const span = next.min - current.min;
  const into = xp - current.min;
  const pct = Math.max(0, Math.min(100, Math.round((into / span) * 100)));
  return { current, next, into, span, pct, toNext: Math.max(0, next.min - xp) };
}

/* ---------- data helpers (client-side, own-user RLS) ---------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

/** Lifetime XP for a user (sum of xp_events.amount). */
export async function getUserXp(supabase: DB, userId: string): Promise<number> {
  const { data } = await supabase
    .from("xp_events")
    .select("amount")
    .eq("user_id", userId);
  return (data || []).reduce(
    (sum: number, r: { amount: number }) => sum + (r.amount || 0),
    0
  );
}

/** Insert an XP event. Silently no-ops on error so UI never breaks. */
export async function awardXp(
  supabase: DB,
  userId: string,
  kind: XpKind,
  amount: number,
  refId?: string
): Promise<void> {
  try {
    await supabase
      .from("xp_events")
      .insert({ user_id: userId, kind, amount, ref_id: refId ?? null });
  } catch {
    /* non-fatal */
  }
}

/** True if this user already has an XP event of `kind` for `refId` (ever). */
export async function hasXpForRef(
  supabase: DB,
  userId: string,
  kind: XpKind,
  refId: string
): Promise<boolean> {
  const { count } = await supabase
    .from("xp_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("ref_id", refId);
  return (count || 0) > 0;
}

/** Count of `kind` XP events for this user since local midnight today. */
export async function countXpToday(
  supabase: DB,
  userId: string,
  kind: XpKind
): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("xp_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", start.toISOString());
  return count || 0;
}
