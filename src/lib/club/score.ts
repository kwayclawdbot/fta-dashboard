/**
 * ClubHome v2 — Club Score weights + scale-aware floors (single source of truth).
 *
 * The authoritative Club Score computation lives in SQL (refresh_club_metrics,
 * migration 140) because it must scan the whole community cheaply and cache the
 * result. These constants MIRROR that SQL so the formula is documented in one
 * readable place and the API layer can reason about it. If you change a weight
 * here, change it in the migration too.
 *
 * CLUB SCORE (per ticker, 14-day window):
 *   score = Σ(action_weight) + PARTICIPANT_BONUS × distinct_participants
 * change = score(last 14d) − score(prior 14d)
 */

export const SCORE_WEIGHTS = {
  watchlist_add: 4,
  research_view: 3,
  comment: 3,
  post: 3,
  sentiment: 2,
  kai_question: 2,
  save: 2,
  reaction: 1,
  search: 1,
} as const;

/** Distinct members touching a ticker matter most — breadth over volume. */
export const PARTICIPANT_BONUS = 5;

/**
 * Scale-aware floors. Any metric below its floor renders as founding-era copy /
 * a non-numeric treatment in the UI — never an embarrassing raw count. Default
 * 50 per the plan; override per metric here.
 */
export const FLOORS = {
  connectedMinds: 50,
  actionsToday: 50,
  debateVotes: 50,
  tickerParticipants: 50, // "N members watching NVDA" only above this
  trendingScore: 50, // a trending row's score is only "hot" above this
} as const;

export function floorMet(value: number | null | undefined, floor: number): boolean {
  return (value ?? 0) >= floor;
}

/** Verbatim compliance line the Trending UI must render (attention ≠ advice). */
export const TRENDING_DISCLAIMER =
  "Attention inside the Club — not a recommendation.";
