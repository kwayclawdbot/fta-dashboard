import type { SupabaseClient } from "@supabase/supabase-js";
import type { LiveEventCardData, LiveEventRow } from "./types.ts";

/**
 * Server-side reads for the live_event object (S2.5 slice). All reads go through
 * a Supabase client the caller provides — an RLS-scoped member client for the
 * member APIs (live_events is member-readable), or the admin client for the
 * cron / state route. Row → card mapping lives here so every surface renders the
 * SAME shape (the shared props contract in ./types).
 */

const CARD_COLS =
  "id,status,room_type,title,description,tickers,host_id,host_name,host_avatar_url," +
  "viewer_count,interested_count,starts_at,started_at,ended_at,duration_min," +
  "join_url,replay_url,kai_summary,top_questions";

/** How long an ended/replay event keeps showing in the member list. */
const REPLAY_WINDOW_DAYS = 30;

/**
 * Map a raw row → the shared card contract. `host` prefers the resolved profile
 * (display_name / avatar_url) when host_id is set; otherwise the denormalized
 * host_name / host_avatar_url (seeded events). `interested` is filled by the
 * caller (needs the viewer's id).
 */
export function toCardData(
  row: LiveEventRow,
  hostProfile?: { display_name: string | null; avatar_url: string | null } | null,
  interested?: boolean
): LiveEventCardData {
  const name =
    (hostProfile?.display_name || row.host_name || "Cheat Code Club").trim();
  const avatarUrl = hostProfile?.avatar_url ?? row.host_avatar_url ?? null;
  return {
    id: row.id,
    status: row.status,
    room_type: row.room_type,
    title: row.title,
    description: row.description,
    tickers: row.tickers ?? [],
    host: { name, avatarUrl },
    viewer_count: row.viewer_count ?? 0,
    interested_count: row.interested_count ?? 0,
    starts_at: row.starts_at,
    ended_at: row.ended_at,
    duration_min: row.duration_min,
    join_url: row.join_url,
    replay_url: row.replay_url,
    interested: interested ?? false,
    kai_summary: row.kai_summary,
    top_questions: row.top_questions ?? [],
  };
}

/**
 * The member list: everything worth showing right now — LIVE + starting_soon
 * first, then UPCOMING (scheduled) by soonest, then RECENT replays (ended /
 * replay_ready within the replay window) newest-first. Returns card-shaped data
 * with the viewer's own `interested` flag resolved in one extra query.
 */
export async function listLiveEvents(
  db: SupabaseClient,
  viewerId: string | null
): Promise<{ live: LiveEventCardData[]; upcoming: LiveEventCardData[]; replays: LiveEventCardData[] }> {
  const replayCutoff = new Date(Date.now() - REPLAY_WINDOW_DAYS * 864e5).toISOString();

  const { data: rows } = await db
    .from("live_events")
    .select(CARD_COLS)
    .or(
      `status.in.(scheduled,starting_soon,live),and(status.in.(ended,replay_ready),ended_at.gte.${replayCutoff})`
    )
    .order("starts_at", { ascending: true })
    .limit(200);

  const list = (rows ?? []) as unknown as LiveEventRow[];

  // Resolve hosts (profiles) + the viewer's interest set in bulk.
  const hostIds = [...new Set(list.map((r) => r.host_id).filter(Boolean))] as string[];
  const hostMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
  if (hostIds.length) {
    const { data: hosts } = await db
      .from("profiles")
      .select("id,display_name,avatar_url")
      .in("id", hostIds);
    for (const h of hosts ?? [])
      hostMap.set(h.id as string, { display_name: h.display_name, avatar_url: h.avatar_url });
  }

  const interestedSet = new Set<string>();
  if (viewerId && list.length) {
    const { data: mine } = await db
      .from("live_event_interest")
      .select("event_id")
      .eq("user_id", viewerId)
      .in(
        "event_id",
        list.map((r) => r.id)
      );
    for (const m of mine ?? []) interestedSet.add(m.event_id as string);
  }

  const cards = list.map((r) =>
    toCardData(r, r.host_id ? hostMap.get(r.host_id) : null, interestedSet.has(r.id))
  );

  return {
    live: cards.filter((c) => c.status === "live" || c.status === "starting_soon"),
    upcoming: cards
      .filter((c) => c.status === "scheduled")
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    replays: cards
      .filter((c) => c.status === "ended" || c.status === "replay_ready")
      .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? "")),
  };
}

/** A single event by id → card shape (host + viewer interest resolved). */
export async function getLiveEvent(
  db: SupabaseClient,
  id: string,
  viewerId: string | null
): Promise<LiveEventCardData | null> {
  const { data: row } = await db
    .from("live_events")
    .select(CARD_COLS)
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;
  const r = row as unknown as LiveEventRow;

  let host: { display_name: string | null; avatar_url: string | null } | null = null;
  if (r.host_id) {
    const { data: h } = await db
      .from("profiles")
      .select("display_name,avatar_url")
      .eq("id", r.host_id)
      .maybeSingle();
    host = h ?? null;
  }

  let interested = false;
  if (viewerId) {
    const { data: mine } = await db
      .from("live_event_interest")
      .select("event_id")
      .eq("event_id", id)
      .eq("user_id", viewerId)
      .maybeSingle();
    interested = Boolean(mine);
  }

  return toCardData(r, host, interested);
}
