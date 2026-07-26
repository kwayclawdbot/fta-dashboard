/**
 * ClubHome v2 — the data contract the UI lane consumes and the DATA lane builds
 * under /api/club/*. These types mirror .planning/CLUBHOME-V2-PLAN.md §"DATA
 * CONTRACT" exactly. The UI renders against THESE shapes with a fixtures
 * fallback (see fixtures.ts) so design review sees the page fully alive in both
 * scale states before the endpoints land, and degrades gracefully (founding-era
 * framing, never a bare/embarrassing number) where an endpoint 404s or a metric
 * sits below its floor.
 *
 * NB: this lib lives in `src/lib/clubhome/` — deliberately DISTINCT from
 * `src/lib/club/**` which is the DATA lane's territory. UI never writes there.
 */

// ── §2 Live Pulse ────────────────────────────────────────────────────────────
export type PulseKind =
  | "researched"   // most-researched inside the Club
  | "watchers"     // new watchers today
  | "sentiment"    // bull/bear positioning shift
  | "pattern";     // Kai / alerts pattern

export interface PulseSignal {
  kind: PulseKind;
  ticker: string;
  company?: string | null;
  headline: string;         // e.g. "#1 most researched"
  detail: string;           // e.g. "38% more research vs yesterday"
  /** direction hint for the accent (up = volt, down = red, flat = neutral) */
  direction?: "up" | "down" | "flat";
  spark?: number[];         // optional inline sparkline series
}
export interface PulseResponse {
  signals: PulseSignal[];   // 3–4 strongest COMMUNITY signals
  updatedAt?: string;
}

// ── §3 The Collective ────────────────────────────────────────────────────────
export interface CollectiveAvatar {
  id: string;
  url?: string | null;
  name?: string | null;
}
export interface CollectiveBreakdown {
  watches: number;
  reactions: number;
  comments: number;
  saves: number;
  kaiQuestions: number;
}
export interface CollectiveResponse {
  connectedMinds: number;
  actionsToday: number;
  breakdown: CollectiveBreakdown;
  floorMet: boolean;        // below floor → render the growth-engine state
  avatars: CollectiveAvatar[]; // consented / adult only
}

// ── §4 Invite / Build-the-Club ───────────────────────────────────────────────
export interface InviteLeader {
  name: string;
  count: number;
  you?: boolean;
}
export interface InviteResponse {
  code: string;
  url: string;
  activatedCount: number;
  xpEarned: number;
  leaderboard: InviteLeader[];
  floorMet?: boolean;       // enough inviters to show a real competition ledger
}

// ── §5 Kai Brief ─────────────────────────────────────────────────────────────
export type BriefKind = "research" | "sentiment" | "watchers" | "pattern" | "news";
export interface BriefItem {
  ticker?: string | null;
  text: string;
  kind: BriefKind;
}
export interface BriefResponse {
  updatedAt: string;
  items: BriefItem[];       // 3–5 delta items
  source: "live" | "derived"; // "derived" = no-LLM fallback while credits are down
  available: boolean;       // false → "Kai is temporarily unavailable" pattern
}

// ── §6 Trending in the Club ──────────────────────────────────────────────────
export interface TrendingRow {
  rank: number;
  ticker: string;
  company?: string | null;
  score: number;            // weighted community-attention score
  change: number;           // rank/score delta vs prior window
}
export interface TrendingResponse {
  rows: TrendingRow[];
  updatedAt: string;
}

// ── §7 Today's Best Thinking ─────────────────────────────────────────────────
export interface ThinkingAuthor {
  name: string;
  badge?: string | null;    // credibility tag (e.g. "Top researcher", "Coach")
  verified?: boolean;
}
export interface ThinkingPost {
  id: string;
  ticker?: string | null;
  company?: string | null;
  title: string;
  author: ThinkingAuthor;
  saves: number;
  comments: number;
  votes: number;
  href: string;
  editorPick?: boolean;
}
export interface ThinkingResponse {
  lead: ThinkingPost | null;
  secondary: ThinkingPost[];
}

// ── §8 The Debate ────────────────────────────────────────────────────────────
export interface DebateResponse {
  id: string;
  question: string;
  counts: { yes: number; no: number };
  userVote: "yes" | "no" | null;
  floorMet: boolean;        // below floor → "be an early voice" framing
  participants: CollectiveAvatar[];
}

// ── §9 For You ───────────────────────────────────────────────────────────────
export interface ForYouItem {
  ticker: string;
  company?: string | null;
  price?: number | null;
  changePct?: number | null;
  /** the human "what changed on your ticker" line */
  delta: string;
  kind: BriefKind;
}
export interface ForYouResponse {
  items: ForYouItem[];
}

// ── §10 People worth following ───────────────────────────────────────────────
export interface PeopleMember {
  id: string;
  name: string;
  avatar?: string | null;
  tags: string[];           // style tags
  reason: string;           // why they're worth following
  href: string;
  /** compact follower count — fixtures/at-scale ONLY. Real endpoints never send
   *  this (no follow graph exists at our N); the UI hides it when absent. */
  followers?: number | null;
}
export interface PeopleResponse {
  members: PeopleMember[];
}

// ── endpoint registry (keeps client + fixtures in lockstep) ──────────────────
export interface ClubData {
  pulse: PulseResponse;
  collective: CollectiveResponse;
  invite: InviteResponse;
  brief: BriefResponse;
  trending: TrendingResponse;
  thinking: ThinkingResponse;
  debate: DebateResponse;
  foryou: ForYouResponse;
  people: PeopleResponse;
}
export type ClubEndpoint = keyof ClubData;

/** scale states used ONLY by fixtures/preview review — never inferred for real users */
export type ClubScale = "founding" | "scale";
