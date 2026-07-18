import type { SupabaseClient } from "@supabase/supabase-js";
import type { CardVisual, OHLC } from "@/lib/games/types";

/**
 * Flashcard SETS + "Daily 5" selection + spaced-repetition update.
 *
 * Cards are grouped into sets (foundations / candlestick-patterns /
 * chart-patterns). A SET SESSION runs the due+unseen cards of one set; the
 * "Daily 5" quick action pulls due cards across ALL sets. SR logic and daily
 * XP are identical in both modes.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

export const DAILY_LIMIT = 5;
export const SET_SESSION_LIMIT = 15;
export const MAX_INTERVAL_DAYS = 30;

export interface FlashcardRow {
  id: string;
  week: number | null;
  track: string | null;
  set_slug: string;
  front: string;
  back: string;
  source: string | null;
  visual: CardVisual | null;
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

const CARD_COLS = "id, week, track, set_slug, front, back, source, visual";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- set catalog (titles, blurbs, art, preview thumbnails) ---------- */

/** Clean, deterministic OHLC from a close series — used for set previews. */
function seriesFromCloses(closes: number[]): OHLC[] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const out: OHLC[] = [];
  let prev = closes[0] - (closes[1] - closes[0]) * 0.5;
  for (const cl of closes) {
    const o = prev;
    const c = cl;
    const top = Math.max(o, c);
    const bot = Math.min(o, c);
    const range = Math.max(Math.abs(c - o), 0.6);
    out.push({ o: r2(o), h: r2(top + range * 0.32), l: r2(bot - range * 0.32), c: r2(c) });
    prev = c;
  }
  return out;
}

export interface CardSet {
  slug: string;
  title: string;
  blurb: string;
  themeWeek: number; // drives the card/thumbnail art via weekTheme()
  preview: CardVisual | null; // mini render for the picker (null = use art photo)
}

export const CARD_SETS: CardSet[] = [
  {
    slug: "foundations",
    title: "Foundations",
    blurb: "Every concept from the program, week by week. The core deck.",
    themeWeek: 1,
    preview: null,
  },
  {
    slug: "candlestick-patterns",
    title: "Candlestick Patterns",
    blurb: "Read a single battle. Doji, hammer, engulfing, stars and more — drawn to spot on sight.",
    themeWeek: 3,
    preview: {
      name: "Three White Soldiers",
      candles: [
        { o: 98, h: 100.3, l: 97.8, c: 100 },
        { o: 99.3, h: 101.7, l: 99.1, c: 101.4 },
        { o: 100.6, h: 103.1, l: 100.4, c: 102.8 },
      ],
    },
  },
  {
    slug: "chart-patterns",
    title: "Chart Patterns",
    blurb: "Battles in a row. Double bottoms, flags, breakouts — with the support and resistance that matter.",
    themeWeek: 4,
    preview: {
      name: "Support Bounce",
      candles: seriesFromCloses([106, 102, 99.2, 99, 99.3, 103, 107]),
      levels: [{ price: 99, kind: "support", label: "Support" }],
    },
  },
];

export function cardSet(slug: string): CardSet {
  return CARD_SETS.find((s) => s.slug === slug) || CARD_SETS[0];
}

/** The theme week used to skin a card (visual cards borrow their set's theme). */
export function cardThemeWeek(card: {
  week: number | null;
  set_slug: string;
  visual: CardVisual | null;
}): number | null {
  if (card.visual) return cardSet(card.set_slug).themeWeek;
  return card.week;
}

export interface SetSummary extends CardSet {
  count: number;
  due: number;
}

/** Per-set card counts + how many are due today, for the set picker. */
export async function listSets(
  supabase: DB,
  userId: string,
  track: string
): Promise<{ sets: SetSummary[]; totalDue: number }> {
  const today = todayStr();
  const [{ data: cards }, { data: reviews }] = await Promise.all([
    supabase.from("flashcards").select("id, set_slug").eq("track", track),
    supabase
      .from("flashcard_reviews")
      .select("card_id, due_at")
      .eq("user_id", userId)
      .lte("due_at", today),
  ]);

  const dueSet = new Set<string>((reviews || []).map((r: { card_id: string }) => r.card_id));
  const bySlug = new Map<string, { count: number; due: number }>();
  for (const c of (cards || []) as { id: string; set_slug: string }[]) {
    const agg = bySlug.get(c.set_slug) || { count: 0, due: 0 };
    agg.count += 1;
    if (dueSet.has(c.id)) agg.due += 1;
    bySlug.set(c.set_slug, agg);
  }

  const sets: SetSummary[] = CARD_SETS.filter((s) => (bySlug.get(s.slug)?.count ?? 0) > 0).map(
    (s) => ({ ...s, count: bySlug.get(s.slug)!.count, due: bySlug.get(s.slug)!.due })
  );
  const totalDue = sets.reduce((n, s) => n + s.due, 0);
  return { sets, totalDue };
}

/** Build today's Daily 5 for a user's track (due first, then unseen), across ALL sets. */
export async function pickDailyFive(
  supabase: DB,
  userId: string,
  track: string
): Promise<DailyCard[]> {
  const today = todayStr();

  const [{ data: cards }, { data: reviews }] = await Promise.all([
    supabase
      .from("flashcards")
      .select(CARD_COLS)
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

/** Cards for one SET session (due first, then unseen), scoped to that set. */
export async function pickSetCards(
  supabase: DB,
  userId: string,
  track: string,
  setSlug: string,
  limit = SET_SESSION_LIMIT
): Promise<DailyCard[]> {
  const today = todayStr();

  const [{ data: cards }, { data: reviews }] = await Promise.all([
    supabase
      .from("flashcards")
      .select(CARD_COLS)
      .eq("track", track)
      .eq("set_slug", setSlug)
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

  return [...due, ...unseen].slice(0, limit);
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
