import type { SupabaseClient } from "@supabase/supabase-js";
import type { LiveRoomType } from "./types.ts";

/**
 * Go-live push fan-out (S2.5). When a live_event transitions → 'live', we notify
 * the members who opted into Remind Me (live_event_interest) through the EXISTING
 * dispatch machinery: one row per member in `notifications` (type 'live_starting')
 * → the 028 pg_net trigger → /api/push/dispatch → web-push + email fallback +
 * the notification_prefs `push_lives` gate. In-feed visibility is S2's job.
 *
 * Cadence-respectful: ONE push per event per member, max. We dedupe on
 * (ref_id = event_id, type = 'live_starting') — if any row already exists for
 * this event, we no-op (a retried / double go-live never re-pushes).
 *
 * Quiet hours: the class webinars fire at 7:00 PM ET (never a quiet window); the
 * market-hours `quiet_hours` concept is alert-specific (125). Push here is gated
 * only by the member's `push_lives` toggle — an opt-out (absent/true = send).
 *
 * Copy is CONTEXTUAL per room type and sells the reason to enter (plan PART II) —
 * never a generic "X is live." The body carries the full line; the dispatch route
 * gives it the "Cheat Code Club" title.
 */

const ROOM_COPY: Record<LiveRoomType, { emoji: string; word: string }> = {
  class: { emoji: "🎓", word: "class" },
  audio: { emoji: "🎙", word: "room" },
  market: { emoji: "📈", word: "room" },
};

export function liveStartingBody(
  roomType: LiveRoomType,
  title: string,
  viewerCount: number
): string {
  const { emoji, word } = ROOM_COPY[roomType] ?? ROOM_COPY.class;
  // Scale floor — never fabricate a crowd. Only surface a count once it's real.
  const crowd = viewerCount >= 5 ? ` · ${viewerCount} watching now` : "";
  return `${emoji} Live ${word} starting now · ${title}${crowd}`.slice(0, 160);
}

export interface FanoutResult {
  notified: number;
  skipped: boolean; // already pushed for this event
  reason?: string;
}

/**
 * Insert the go-live notifications for every interested member. Uses the ADMIN
 * client (service role) — notifications has no member INSERT policy. Returns how
 * many rows were created (each becomes a push via the pg_net trigger).
 */
export async function fanoutLiveStarting(
  admin: SupabaseClient,
  event: {
    id: string;
    room_type: LiveRoomType;
    title: string;
    viewer_count: number;
    host_id: string | null;
  }
): Promise<FanoutResult> {
  // Dedupe: already pushed for this event?
  const { data: existing } = await admin
    .from("notifications")
    .select("id")
    .eq("ref_id", event.id)
    .eq("type", "live_starting")
    .limit(1);
  if (existing && existing.length > 0) {
    return { notified: 0, skipped: true, reason: "already_pushed" };
  }

  // Audience: members who opted into Remind Me. (The broader plan hierarchy —
  // host followers, registrants, family-class families — layers on when the
  // follow graph lands post-challenge; this slice ships the consent-based core.)
  const { data: interested } = await admin
    .from("live_event_interest")
    .select("user_id")
    .eq("event_id", event.id);

  const recipients = [...new Set((interested ?? []).map((r) => r.user_id as string))]
    // Never notify the host about their own go-live.
    .filter((uid) => uid !== event.host_id);

  if (recipients.length === 0) return { notified: 0, skipped: false, reason: "no_audience" };

  const body = liveStartingBody(event.room_type, event.title, event.viewer_count);
  const link = `/club?live=${event.id}`;

  const rows = recipients.map((user_id) => ({
    user_id,
    actor_id: event.host_id,
    type: "live_starting" as const,
    body,
    link,
    ref_id: event.id,
  }));

  const { error, count } = await admin
    .from("notifications")
    .insert(rows, { count: "exact" });
  if (error) return { notified: 0, skipped: false, reason: error.message };

  return { notified: count ?? rows.length, skipped: false };
}
