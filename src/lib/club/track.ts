import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * club_events instrumentation helper (server-side, best-effort).
 *
 * Logs the three event kinds that have no other durable home — search,
 * research_view, kai_question, save — into club_events, so the Club Score
 * pipeline (migration 140) can factor them in. Insert-own RLS means the passed
 * client must be the member-scoped one (auth.uid() = member_id) OR service role
 * with an explicit member_id. Silent on failure — instrumentation must NEVER
 * break the action it is observing.
 */

export type ClubEventKind = "search" | "research_view" | "kai_question" | "save";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

export async function logClubEvent(
  db: DB,
  memberId: string,
  kind: ClubEventKind,
  ticker?: string | null,
  meta?: Record<string, unknown> | null
): Promise<void> {
  try {
    await db.from("club_events").insert({
      member_id: memberId,
      kind,
      ticker: ticker ? ticker.toUpperCase() : null,
      meta: meta ?? null,
    });
  } catch {
    /* non-fatal */
  }
}
