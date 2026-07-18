import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Daily 5" flashcard selection + spaced-repetition update.
 * Selection: first cards whose review is due today, then unseen cards ordered
 * by week (all weeks available — no drip gate), capped at 5.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

export const DAILY_LIMIT = 5;
export const MAX_INTERVAL_DAYS = 30;

export interface FlashcardRow {
  id: string;
  week: number | null;
  track: string | null;
  front: string;
  back: string;
  source: string | null;
}

export interface ReviewRow {
  card_id: string;
  due_at: string;
  interval_days: number;
  streak: number;
  last_result: string | null;
}

export interface DailyCard extends FlashcardRow {
  review: ReviewRow | null;
  isDue: boolean;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Build today's Daily 5 for a user's track. */
export async function pickDailyFive(
  supabase: DB,
  userId: string,
  track: string
): Promise<DailyCard[]> {
  const today = todayStr();

  const [{ data: cards }, { data: reviews }] = await Promise.all([
    supabase
      .from("flashcards")
      .select("id, week, track, front, back, source")
      .eq("track", track)
      .order("week", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("flashcard_reviews")
      .select("card_id, due_at, interval_days, streak, last_result")
      .eq("user_id", userId),
  ]);

  const byCard = new Map<string, ReviewRow>();
  (reviews || []).forEach((r: ReviewRow) => byCard.set(r.card_id, r));

  const due: DailyCard[] = [];
  const unseen: DailyCard[] = [];
  for (const c of (cards || []) as FlashcardRow[]) {
    const review = byCard.get(c.id) || null;
    if (!review) {
      unseen.push({ ...c, review: null, isDue: false });
    } else if (review.due_at <= today) {
      due.push({ ...c, review, isDue: true });
    }
  }
  due.sort((a, b) => (a.review!.due_at < b.review!.due_at ? -1 : 1));

  return [...due, ...unseen].slice(0, DAILY_LIMIT);
}

/** Count of cards waiting in today's Daily 5 (0-5). */
export async function dailyFiveCount(
  supabase: DB,
  userId: string,
  track: string
): Promise<number> {
  const cards = await pickDailyFive(supabase, userId, track);
  return cards.length;
}

export interface ReviewOutcome {
  interval: number;
  streak: number;
}

/** Apply an SR outcome for one card. Got it → grow interval; Again → reset. */
export async function reviewCard(
  supabase: DB,
  userId: string,
  card: DailyCard,
  gotIt: boolean
): Promise<ReviewOutcome> {
  const prevInterval = card.review?.interval_days ?? 1;
  const prevStreak = card.review?.streak ?? 0;

  const interval = gotIt ? Math.min(prevInterval * 2, MAX_INTERVAL_DAYS) : 1;
  const streak = gotIt ? prevStreak + 1 : 0;

  const due = new Date();
  due.setDate(due.getDate() + interval); // Again → interval 1 → due tomorrow
  const due_at = due.toISOString().slice(0, 10);

  await supabase.from("flashcard_reviews").upsert(
    {
      user_id: userId,
      card_id: card.id,
      due_at,
      interval_days: interval,
      streak,
      last_result: gotIt ? "got_it" : "again",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,card_id" }
  );

  return { interval, streak };
}
