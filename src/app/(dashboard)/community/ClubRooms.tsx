"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import type { FamilyTier } from "@/lib/tier";
import { MentionProvider } from "@/lib/mentions";
import { useChatRoom, type ChatMe } from "@/lib/useChatRoom";
import ChatMessageList from "@/components/community/chat/ChatMessageList";
import ChatComposer from "@/components/community/chat/ChatComposer";
import { SectionRule } from "@/components/f0/parts";
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
   THE LOUNGE, SPLIT BY TOPIC — canvas v2, Club Screens 02.

   Until now the Lounge was ONE undifferentiated room, which is why it reads as
   a chat widget rather than a place: there is nothing to choose, so there is
   nothing to belong to. The canvas splits it into topic rooms. What it does NOT
   get right is the drawing.

   ── WHY THIS IS A LEDGER, NOT FOUR TILES ─────────────────────────────────
   The canvas draws a 2×2 of saturated tiles — green / purple / orange / blue.
   Three problems, any one of them fatal:
     · green and blue are PRICE and KAI, and a green room tile inches from a
       green price delta makes the reader decode colour twice;
     · purple is dropped from the system;
     · four equal filled rectangles in a grid is the generic card container the
       brand register bans outright.
   So rooms are told apart the way everything else in this system is told
   apart — by TYPE WEIGHT and ONE accent. The room you are standing in takes the
   accent rule and the heavy line; the others are ink on the same hairline. It
   scales to eight rooms; a colour scheme does not.

   ── ROOM IDENTITY ────────────────────────────────────────────────────────
   Each room carries a BRIEF ("what belongs in here"). That is the difference
   between a channel list and a set of rooms: a name alone tells a new member
   nothing, and the first-100-days room exists precisely for people who do not
   yet know where their question goes.

   ── COUNTS ───────────────────────────────────────────────────────────────
   Real distinct senders in the last 24h, floored (see rooms.ts). Loading is a
   skeleton, NOT the founding line — otherwise every room flashes "open for your
   first question" before the count lands.
   ══════════════════════════════════════════════════════════════════════════ */

export default function ClubRooms({
  me,
  tier,
}: {
  me: ChatMe | null;
  tier: FamilyTier;
}) {
  const rooms = useMemo(() => openRoomsFor(tier), [tier]);
  const locked = useMemo(() => lockedRoomsFor(tier), [tier]);
  const [activeId, setActiveId] = useState(rooms[0]?.id ?? "");

  const ids = useMemo(() => [...rooms, ...locked].map((r) => r.id), [rooms, locked]);
  const { activity, loading: activityLoading } = useRoomActivity(ids);

  const { messages, loading, posting, uploading, mentions, tierOf, xpOf, send } =
    useChatRoom(activeId, me);

  const active = rooms.find((r) => r.id === activeId) ?? rooms[0] ?? null;

  return (
    <MentionProvider map={mentions}>
      <div className="space-y-5">
        <SectionRule>Rooms by topic</SectionRule>

        <div className="f0-ledger">
          {rooms.map((r) => (
            <RoomRow
              key={r.id}
              room={r}
              active={r.id === activeId}
              activity={activity[r.id]}
              loading={activityLoading}
              onSelect={() => setActiveId(r.id)}
            />
          ))}
          {locked.map((r) => (
            <RoomRow key={r.id} room={r} active={false} locked activity={activity[r.id]} loading={activityLoading} />
          ))}
        </div>

        {/* The room itself. A hairline-framed column, not a paper card — the
            room is the surface's content, not an object floating on it. */}
        {active && (
          <section aria-label={`${active.name} room`} className="f0-frame flex max-h-[520px] flex-col overflow-hidden rounded-2xl">
            <header className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2">
              <h3 className="min-w-0 truncate font-display text-[15px] font-extrabold text-ink">
                {active.name}
              </h3>
              <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
                {activityLoading ? " " : roomActivityLine(active, activity[active.id])}
              </p>
            </header>
            <ChatMessageList
              messages={messages}
              loading={loading}
              tierOf={tierOf}
              xpOf={xpOf}
              tone="paper"
              emptyText={`${active.founding} — say the first thing in ${active.name}.`}
            />
            <ChatComposer
              me={me}
              onSend={send}
              posting={posting}
              uploading={uploading}
              tone="paper"
              placeholder={`Say something in ${active.name}…`}
            />
          </section>
        )}
      </div>
    </MentionProvider>
  );
}

/* ── one room ─────────────────────────────────────────────────────────────
   A ledger row, so a room reads as an entry in the club's index rather than a
   button in a widget. `f0-ledger-row` beats Tailwind utilities (globals.css has
   no @layer), so alignment is set with self-* on the children, never items-* on
   the row. */
function RoomRow({
  room,
  active,
  activity,
  loading,
  locked = false,
  onSelect,
}: {
  room: TopicRoom;
  active: boolean;
  activity: RoomActivity | undefined;
  loading: boolean;
  locked?: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      {/* The accent tick. ONE accent across every room — the mark says "you are
          here", not "this room is the orange one". bg-accent resolves to club
          orange / family gold / FTA metallic rather than hardcoding volt. */}
      <span
        aria-hidden
        className={`mt-[3px] h-4 w-[3px] shrink-0 self-start rounded-full transition-colors ${
          active ? "bg-accent" : "bg-sand"
        }`}
      />
      <span className="min-w-0 flex-1 self-start">
        <span
          className={`flex items-center gap-1.5 font-display text-[15px] ${
            active ? "font-extrabold text-ink" : "font-bold text-ink/85"
          }`}
        >
          {locked && <Lock className="h-3 w-3 shrink-0 text-soft" aria-hidden />}
          {room.name}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-soft">{room.brief}</span>
      </span>
      <span className="shrink-0 self-start pt-[3px] text-right">
        {loading ? (
          <span
            className="inline-block h-2.5 w-16 rounded-full bg-sand motion-safe:animate-pulse"
            aria-hidden
          />
        ) : (
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
              (activity?.talkers24h ?? 0) >= ROOM_TALKER_FLOOR ? "text-sentiment" : "text-soft"
            }`}
          >
            {roomActivityLine(room, activity)}
          </span>
        )}
      </span>
    </>
  );

  if (locked) {
    return (
      <Link
        href="/upgrade"
        className="f0-ledger-row f0-focus gap-3 text-left transition-colors hover:bg-volt-500/[0.05]"
        title="Members' room — join the Club"
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="f0-ledger-row f0-focus f0-press w-full gap-3 text-left transition-colors hover:bg-volt-500/[0.05]"
    >
      {body}
    </button>
  );
}
