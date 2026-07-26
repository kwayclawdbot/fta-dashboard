/**
 * live_event — shared shapes for the CONVERGENCE PART II object (S2.5 slice).
 *
 * The DB row lives in migration 170. `LiveEventCardData` is the PROPS CONTRACT
 * shared with the S2 rendering lane — LiveEventCard takes `{ event }` of this
 * shape. Do NOT change the core field shapes without noting it to S2. The fields
 * marked "S2.5 addition" are optional enrichments (recap/replay + own-interest)
 * that the card reads when present; they never break the core contract.
 */

export type LiveEventStatus =
  | "scheduled"
  | "starting_soon"
  | "live"
  | "ended"
  | "replay_ready";

export type LiveRoomType = "audio" | "market" | "class";

/** The five lifecycle statuses, in forward order (mirrors advance_live_event). */
export const LIVE_STATUS_ORDER: LiveEventStatus[] = [
  "scheduled",
  "starting_soon",
  "live",
  "ended",
  "replay_ready",
];

/** SHARED PROPS CONTRACT with S2. LiveEventCard renders `{ event: LiveEventCardData }`. */
export interface LiveEventCardData {
  id: string;
  status: LiveEventStatus;
  room_type: LiveRoomType;
  title: string;
  description: string | null;
  tickers: string[];
  host: { name: string; avatarUrl: string | null };
  viewer_count: number;
  interested_count: number;
  starts_at: string; // ISO
  ended_at: string | null; // ISO
  duration_min: number | null;
  join_url: string | null;
  replay_url: string | null;

  // ── S2.5 additions (optional; card reads when present) ────────────────────
  /** Whether the CURRENT viewer has opted into Remind Me (drives the toggle). */
  interested?: boolean;
  /** Kai recap prose — null until LLM credits return (zero-LLM primary path). */
  kai_summary?: string | null;
  /** Top questions captured during the room — recap state. */
  top_questions?: { q: string; count?: number }[];
}

/** Raw live_events row as selected from Supabase (snake_case columns). */
export interface LiveEventRow {
  id: string;
  status: LiveEventStatus;
  room_type: LiveRoomType;
  title: string;
  description: string | null;
  tickers: string[] | null;
  thumbnail_url: string | null;
  host_id: string | null;
  host_name: string | null;
  host_avatar_url: string | null;
  cohosts: string[] | null;
  viewer_count: number;
  interested_count: number;
  starts_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_min: number | null;
  join_url: string | null;
  replay_url: string | null;
  kai_summary: string | null;
  top_questions: { q: string; count?: number }[] | null;
  created_at: string;
  updated_at: string;
}
