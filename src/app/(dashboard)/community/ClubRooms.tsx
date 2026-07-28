"use client";

import { useMemo } from "react";
import type { FamilyTier } from "@/lib/tier";
import { MentionProvider } from "@/lib/mentions";
import { useChatRoom, type ChatMe } from "@/lib/useChatRoom";
import ChatMessageList from "@/components/community/chat/ChatMessageList";
import ChatComposer from "@/components/community/chat/ChatComposer";
import { Pill, PillRow, RoomTile, SectionLabel } from "./board";
import {
  ROOM_TALKER_FLOOR,
  lockedRoomsFor,
  openRoomsFor,
  roomActivityLine,
  useRoomActivity,
  type RoomActivity,
  type TopicRoom,
} from "./rooms";

/* ══════════════════════════════════════════════════════════════════════════
   THE LOUNGE + ROOMS BY TOPIC — Club Screens 02 and 06, built as drawn.

   TWO OBJECTS, TWO SCREENS. The board separates them and so does this file:

     · ROOM GRID (board 02, "Rooms by topic") — the 2×2 of saturated tiles, with
       the room's own colour as its ground. It sits on the Discussions screen and
       hands the member into the Lounge on the room they picked.
     · THE LOUNGE (board 06) — a pill rail of rooms across the top, then the room
       itself as tailed speech bubbles on the warm ground with the round send
       field beneath. No frame around the chat: the room IS the screen.

   The one substitution the boards do not get: there is no Options desk. Club
   surfaces are equities-only, so the purple tile carries MAIN CIRCLE — see
   rooms.ts. Counts are the real 24h distinct-sender read, floored; below the
   floor a tile states what it is FOR instead of publishing how empty it is.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── board 02: the coloured grid ──────────────────────────────────────────── */

export function RoomGrid({
  tier,
  activeId,
  onSelect,
}: {
  tier: FamilyTier;
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  const open = useMemo(() => openRoomsFor(tier), [tier]);
  const locked = useMemo(() => lockedRoomsFor(tier), [tier]);
  const ids = useMemo(() => [...open, ...locked].map((r) => r.id), [open, locked]);
  const { activity, loading } = useRoomActivity(ids);

  return (
    <section aria-label="Rooms by topic">
      <SectionLabel>Rooms by topic</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5">
        {open.map((r) => (
          <RoomTile
            key={r.id}
            name={r.name}
            color={r.tile}
            active={r.id === activeId}
            meta={<TileMeta room={r} activity={activity[r.id]} loading={loading} />}
            onClick={() => onSelect(r.id)}
          />
        ))}
        {locked.map((r) => (
          <RoomTile
            key={r.id}
            name={r.name}
            color={r.tile}
            locked
            href="/upgrade"
            meta={<TileMeta room={r} activity={activity[r.id]} loading={loading} />}
          />
        ))}
      </div>
    </section>
  );
}

/** LOADING IS NOT EMPTY: a tile never flashes its founding line mid-fetch. */
function TileMeta({
  room,
  activity,
  loading,
}: {
  room: TopicRoom;
  activity: RoomActivity | undefined;
  loading: boolean;
}) {
  if (loading) {
    return <span className="inline-block h-2 w-16 rounded-full bg-white/35 motion-safe:animate-pulse" aria-hidden />;
  }
  return <>{roomActivityLine(room, activity)}</>;
}

/* ── board 06: the Lounge ─────────────────────────────────────────────────── */

export default function ClubRooms({
  me,
  tier,
  activeId,
  onSelect,
}: {
  me: ChatMe | null;
  tier: FamilyTier;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const rooms = useMemo(() => openRoomsFor(tier), [tier]);
  const ids = useMemo(() => rooms.map((r) => r.id), [rooms]);
  const { activity, loading: activityLoading } = useRoomActivity(ids);

  const active = rooms.find((r) => r.id === activeId) ?? rooms[0] ?? null;
  const roomId = active?.id ?? "";

  const { messages, loading, posting, uploading, mentions, tierOf, xpOf, send } =
    useChatRoom(roomId, me);

  return (
    <MentionProvider map={mentions}>
      <div className="space-y-4">
        {/* The room rail. Pills, exactly as board 06 draws them — the room you
            are standing in takes the orange field. */}
        <PillRow>
          {rooms.map((r) => (
            <Pill key={r.id} active={r.id === roomId} onClick={() => onSelect(r.id)}>
              {r.name}
            </Pill>
          ))}
        </PillRow>

        {active && (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2.5 text-[11.5px] text-soft">
              <span className="font-display text-[12px] font-bold text-ink">{active.brief}</span>
              {!activityLoading && (
                <span
                  className={
                    (activity[active.id]?.talkers24h ?? 0) >= ROOM_TALKER_FLOOR
                      ? "font-mono text-[10px] uppercase tracking-[0.12em] text-sentiment"
                      : "font-mono text-[10px] uppercase tracking-[0.12em] text-soft"
                  }
                >
                  {roomActivityLine(active, activity[active.id])}
                </span>
              )}
            </p>

            <section
              aria-label={`${active.name} room`}
              className="flex max-h-[560px] min-h-[300px] flex-col"
            >
              <ChatMessageList
                messages={messages}
                loading={loading}
                tierOf={tierOf}
                xpOf={xpOf}
                variant="bubbles"
                meId={me?.id ?? null}
                emptyText={`${active.founding} — say the first thing in ${active.name}.`}
              />
              <ChatComposer
                me={me}
                onSend={send}
                posting={posting}
                uploading={uploading}
                variant="lounge"
                placeholder={`Say something in ${active.name}…`}
              />
            </section>
          </>
        )}
      </div>
    </MentionProvider>
  );
}
