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

/**
 * SNAPSHOT SIGNAL FLOORS (Kai Intelligence Layer §2c) — MIRROR of the constants
 * in migration 141's refresh_club_metrics(). The `unusual_activity` composite on
 * a ticker_intel_snapshot only trips when a 24h spike clears BOTH an absolute
 * event floor AND a relative multiple over the prior-24h baseline, so one extra
 * comment on a cold ticker can never read as "unusual". If you change a value
 * here, change it in the migration too.
 */
export const SNAPSHOT_FLOORS = {
  /** Minimum events in the last 24h before "unusual activity" can be true. */
  unusualMinEvents24h: 8,
  /** 24h event count must be ≥ this × the prior-24h baseline. */
  unusualSpikeMult: 2.0,
  /**
   * Distinct members who must have FLIPPED their stance on a ticker (stance_events,
   * mig 151) before the "N changed their mind" stat surfaces on /api/club/intel.
   * MIRRORS v_mind_change_floor in migration 160's refresh_club_metrics().
   */
  mindChangeMinMembers: 5,
} as const;

/**
 * Verbatim compliance line the intel "why?" surface must render. Kai and the
 * Club describe ATTENTION and ACTIVITY, never advice (KAI-INTELLIGENCE-LAYER §6).
 */
export const INTEL_DISCLAIMER =
  "This is a snapshot of Club attention and activity — not investment advice or a recommendation.";
