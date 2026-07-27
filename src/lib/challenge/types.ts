/**
 * The challenge journey's shared TYPES — the contract between migration 199's
 * `challenge_state()` RPC and every surface that renders it (this lane's
 * pre-season screens AND the Sept 2–6 day-mission boards the next lane builds).
 *
 * Every timestamp here is an ISO string produced by Postgres `now()` or a stored
 * `timestamptz`. NOTHING in this file derives a moment from the device clock:
 * `ChallengeState.now` is the server's clock and is the only legitimate seed for
 * a countdown (see `src/lib/challenge/clock.ts`).
 */

/** Server-derived journey phase. Never computed from a client date. */
export type ChallengePhase =
  | "pre_open" // before the pre-season opens
  | "preseason" // Aug 1 → Aug 24 — the rhythm
  | "forming" // Aug 25 → kickoff — cohort forming
  | "live" // kickoff → final session ends
  | "aftermath" // after the final session, access still open
  | "closed"; // free access has expired

/**
 * Per-day state machine. `locked` and `missed` are DIFFERENT screens: locked is
 * "not yet", missed is "you can still catch this up" (see `late_ok`). A missed
 * day is never a dead end — defending a streak is the entire product.
 */
export type ChallengeDayState = "locked" | "open" | "live" | "complete" | "missed";

export type ChallengeStep = "brief" | "do" | "share";

export type ChallengeArtifactKind =
  | "first_pick"
  | "watchlist"
  | "research_card"
  | "vote"
  | "practice_trade"
  | "routine";

export interface ChallengeCohort {
  id: string;
  slug: string;
  name: string;
  /** Canonical wall clock. America/New_York — the sessions are 7:00 PM ET. */
  tz: string;
  preseason_opens_at: string;
  cohort_forming_at: string;
  kickoff_at: string;
  ends_at: string;
  access_ends_at: string;
}

export interface ChallengeMember {
  joined_at: string;
  sms_opt_in: boolean;
  sms_opt_in_at: string | null;
  calendar_added_at: string | null;
  intro_posted_at: string | null;
  day0_completed_at: string | null;
  preseason_badge_at: string | null;
  finisher_at: string | null;
}

export interface ChallengeDay {
  day_no: number;
  title: string;
  theme: string;
  tag: string | null;
  est_minutes: number;
  xp_award: number;
  artifact_kind: Exclude<ChallengeArtifactKind, "first_pick">;
  brief_headline: string;
  brief_body: string;
  do_headline: string;
  share_headline: string;
  /** The mission opens (midnight ET of the session day). */
  unlock_at: string;
  /** The live session (7:00 PM ET == 23:00 UTC in September, which is EDT). */
  session_at: string;
  session_minutes: number;
  /** The `live_events` row this session is (migration 171). */
  live_event_id: string | null;
  /** False ⇒ the day closes for good after its session window. */
  late_ok: boolean;
  brief_done: boolean;
  do_done: boolean;
  share_done: boolean;
  artifact_id: string | null;
  feed_post_id: string | null;
  state: ChallengeDayState;
}

export interface ChallengeBeat {
  key: string;
  week: number;
  kind: "lesson" | "community" | "simulator" | "live";
  label: string;
  sub: string | null;
  xp: number;
  href: string | null;
  est_minutes: number;
  opens_at: string;
  sort: number;
  completed_at: string | null;
  open: boolean;
}

/**
 * Real counts, never decorative. `below_floor` is TRUE until the cohort passes
 * `floor` members — the surfaces then render founding copy instead of a number,
 * per CHALLENGE-FUNNEL-REVIEW P1 item 3 (low counts read as failure).
 */
export interface ChallengeCohortCounts {
  members: number;
  preseason_badges: number;
  finishers: number;
  active_today: number;
  floor: number;
  below_floor: boolean;
}

export interface ChallengeAnswer {
  answer_key: string | null;
  answer_text: string | null;
}

export interface ChallengeState {
  ok: true;
  /** THE SERVER CLOCK. Seed every countdown from this, never from Date.now(). */
  now: string;
  phase: ChallengePhase;
  cohort: ChallengeCohort;
  member: ChallengeMember | null;
  days: ChallengeDay[];
  beats: ChallengeBeat[];
  answers: Record<string, ChallengeAnswer>;
  challenge_ready: { done: number; total: number };
  streak: number;
  xp: number;
  cohort_counts: ChallengeCohortCounts;
}

export interface ChallengeQuestionOption {
  key: string;
  label: string;
  emoji: string | null;
  sort: number;
}

export interface ChallengeQuestion {
  key: string;
  sort: number;
  prompt: string;
  helper: string | null;
  kind: "choice" | "text";
  required: boolean;
  options: ChallengeQuestionOption[];
}
