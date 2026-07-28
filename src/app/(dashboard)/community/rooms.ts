"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FamilyTier } from "@/lib/tier";

/* ══════════════════════════════════════════════════════════════════════════
   ROOMS BY TOPIC — Club Screens 02.
   Registry + real activity, kept out of the view so the view stays a view.

   ── THE GRID SHIPS AS DRAWN ──────────────────────────────────────────────
   The board draws a 2×2 of saturated tiles — green "Semis & AI infra", purple
   "Options desk", orange "Macro & rates", blue "First 100 days" — and that is
   what ships: coloured tiles, one colour per room, carried on `tile` below. The
   colour is the room's IDENTITY, which is why it is registry data rather than a
   view decision: a member should navigate this grid by shape and colour instead
   of re-reading four labels every time.

   ONE substitution, and only one. Club surfaces are equities-only, so there is
   no Options desk — it is not created, not hidden, it does not exist (migration
   190). The purple tile in that slot carries MAIN CIRCLE, the room the club
   actually has and the one a member walks into first.

   ── THE COUNTS ARE REAL ──────────────────────────────────────────────────
   The board prints "418 talking" under every tile. We count DISTINCT senders in
   the room over the last 24h (get_room_activity, migration 190) and floor it: a
   tile that says "1 talking" publishes how small the room is on every render,
   which is worse than saying nothing. Below the floor the tile states its
   founding line instead. No branch prints a fabricated number.
   ══════════════════════════════════════════════════════════════════════════ */

export interface TopicRoom {
  id: string;
  /** The room's own name — short, so it survives a narrow column. */
  name: string;
  /** What belongs in here. One line, in the member's language. */
  brief: string;
  /** The founding line: what this room is FOR before it has traffic. */
  founding: string;
  /** Members-only rooms are visible to free members but not open to them. */
  membersOnly: boolean;
  /** The tile ground from Club Screens 02. Stable per room — it is identity. */
  tile: string;
}

/** Fixed ids continue the 016/033/086/190 scheme. */
export const FIC_ROOM_ID = "c0000000-0000-4000-a000-000000000001";
export const FREE_LOUNGE_ROOM_ID = "c0000000-0000-4000-a000-000000000003";

/**
 * The Lounge, split. "Main Circle" stays first and stays the default — an
 * always-on general room is the thing a member walks into, and topic rooms are
 * the reason to stay. Order is deliberate and is NOT sorted by traffic: a room
 * that reorders itself under the member's finger is a room they stop trusting.
 */
export const TOPIC_ROOMS: TopicRoom[] = [
  {
    id: FIC_ROOM_ID,
    name: "Main Circle",
    brief: "The whole club, one room. Anything that does not have a room of its own.",
    founding: "The room the club started in",
    membersOnly: true,
    tile: "#7C4DFF",
  },
  {
    id: "c0000000-0000-4000-a000-000000000004",
    name: "Semis & AI infra",
    brief: "Chips, data centres, power and the companies selling picks and shovels.",
    founding: "Open for the names the club watches hardest",
    membersOnly: true,
    tile: "#1BA94C",
  },
  {
    id: "c0000000-0000-4000-a000-000000000005",
    name: "Macro & rates",
    brief: "Rates, inflation prints and the weather every position sits in.",
    founding: "Open for the weather, not the forecast",
    membersOnly: true,
    tile: "#F05A28",
  },
  {
    id: "c0000000-0000-4000-a000-000000000006",
    name: "First 100 days",
    brief: "New members, first questions. Nothing here is too basic.",
    founding: "Open for your first question",
    membersOnly: false,
    tile: "#2F6BFF",
  },
  {
    id: FREE_LOUNGE_ROOM_ID,
    name: "Free Lounge",
    brief: "Open to everyone, members included. Say hi.",
    founding: "Open to everyone",
    membersOnly: false,
    tile: "#00A38C",
  },
];

export const ROOM_BY_ID: Record<string, TopicRoom> = Object.fromEntries(
  TOPIC_ROOMS.map((r) => [r.id, r])
);

/** Rooms a tier may OPEN and post in (app-layer gating, per 016/033/086/190). */
export function openRoomsFor(tier: FamilyTier): TopicRoom[] {
  if (tier === "free") return TOPIC_ROOMS.filter((r) => !r.membersOnly);
  return TOPIC_ROOMS;
}

/** Rooms shown but locked for this tier. */
export function lockedRoomsFor(tier: FamilyTier): TopicRoom[] {
  return tier === "free" ? TOPIC_ROOMS.filter((r) => r.membersOnly) : [];
}

/**
 * A room states a talker count only once enough distinct people have spoken in
 * it today. Same discipline as SOCIAL_FLOORS: the number is honest OR it is
 * withheld — it is never rounded up and never invented.
 */
export const ROOM_TALKER_FLOOR = 3;

export interface RoomActivity {
  talkers24h: number;
  messages24h: number;
  lastAt: string | null;
}

export type RoomActivityMap = Record<string, RoomActivity>;

/**
 * Real per-room activity. LOADING IS NOT EMPTY: `loading` stays true until the
 * RPC answers, so a room never paints its founding line during the fetch and
 * then swaps to a count — the original defect this rule was written for.
 */
export function useRoomActivity(roomIds: string[]): {
  activity: RoomActivityMap;
  loading: boolean;
} {
  const key = roomIds.join(",");
  // The answer is STAMPED with the request it answers. That is what makes
  // `loading` derivable instead of set-in-an-effect: a result whose stamp does
  // not match the current room set is, by definition, still in flight — and the
  // room list never renders a stale count under a new set of rooms.
  const [answer, setAnswer] = useState<{ key: string; map: RoomActivityMap }>({
    key: "",
    map: {},
  });

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) return;
    let live = true;
    createClient()
      .rpc("get_room_activity", { p_room_ids: ids })
      .then(({ data }) => {
        if (!live) return;
        const map: RoomActivityMap = {};
        for (const row of (data ?? []) as {
          room_id: string;
          talkers_24h: number | null;
          messages_24h: number | null;
          last_at: string | null;
        }[]) {
          map[row.room_id] = {
            talkers24h: row.talkers_24h ?? 0,
            messages24h: row.messages_24h ?? 0,
            lastAt: row.last_at,
          };
        }
        setAnswer({ key, map });
      });
    return () => {
      live = false;
    };
  }, [key]);

  const fresh = answer.key === key;
  return { activity: fresh ? answer.map : {}, loading: key !== "" && !fresh };
}

/**
 * The one line a room says about itself. Above the floor it states the count it
 * counted; below it, the room's founding line. Never "0 talking", never
 * "1 talking".
 */
export function roomActivityLine(room: TopicRoom, a: RoomActivity | undefined): string {
  const n = a?.talkers24h ?? 0;
  if (n >= ROOM_TALKER_FLOOR) return `${n.toLocaleString()} talking today`;
  return room.founding;
}
