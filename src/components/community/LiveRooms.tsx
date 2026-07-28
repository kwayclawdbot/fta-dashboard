"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Hash, Lock, Radio } from "lucide-react";
import { type FamilyTier } from "@/lib/tier";
import { MentionProvider } from "@/lib/mentions";
import { useChatRoom, type ChatMe } from "@/lib/useChatRoom";
import ChatMessageList from "@/components/community/chat/ChatMessageList";
import ChatComposer from "@/components/community/chat/ChatComposer";

/**
 * Club Chat — the ALWAYS-ON realtime chat, presented as a collapsible drawer
 * (ClubChatDrawer) shared across /community and /chart. The realtime engine lives
 * in useChatRoom + shared ChatMessageList/ChatComposer, so this file is just the
 * drawer's header, room pills, and gating. FIC Club + Free Lounge only — the FTA
 * Traders room moved OUT to its dedicated /fta/chat page (Lane 3).
 *
 * BOARD LANGUAGE PASS. It was a `paper-card` — the previous version's default
 * container — with a hand-rolled bold-14px heading and its own bordered room
 * tabs. Now: the board's white card (`club-b-card`) on the paper ground, a
 * `BoardSection`-register mark ("MAIN CIRCLE · LIVE", tracked mono caps with one
 * trailing phrase in the accent), and the board's pill row for the rooms — active
 * = accent fill, resting = card + hairline, locked = the same pill with a lock.
 *
 * NOT BOARD 08. The board's near-black ROOM CHAT is the *in-a-live-room* surface;
 * this is the always-on club chat that opens over a paper page (board 04's
 * register), and inverting it to near-black inside a cream drawer would make the
 * drawer read as two different apps. The dark room chat belongs to the live room
 * itself, which this component is not.
 *
 * COLOUR LAW: the live dot was raw `bg-green-500` — green is PRICE. It now rides
 * --accent-solid like every other live/action signal in the system, so it is gold
 * in Family Mode, volt orange in Club and metallic on the FTA desk.
 */

const FIC_ROOM_ID = "c0000000-0000-4000-a000-000000000001";
const FREE_LOUNGE_ROOM_ID = "c0000000-0000-4000-a000-000000000003";

interface Room {
  id: string;
  name: string;
}
const FIC_ROOM: Room = { id: FIC_ROOM_ID, name: "Main Circle" };
const FREE_LOUNGE: Room = { id: FREE_LOUNGE_ROOM_ID, name: "Free Lounge" };

/**
 * Rooms a tier may OPEN + post in (app-layer gating, per migrations 016/033/086).
 * The FTA Traders room is intentionally absent — it lives on /fta/chat now.
 */
function openRoomsFor(tier: FamilyTier): Room[] {
  if (tier === "free") return [FREE_LOUNGE];
  return [FIC_ROOM, FREE_LOUNGE]; // fic + fta both get the club room + Free Lounge
}
/** Rooms shown but locked for this tier (a tasteful upsell chip). */
function lockedRoomsFor(tier: FamilyTier): Room[] {
  return tier === "free" ? [FIC_ROOM] : [];
}

export type LiveRoomsMe = ChatMe;
export type Me = ChatMe;

export default function LiveRooms({ me, tier }: { me: ChatMe | null; tier: FamilyTier }) {
  const rooms = useMemo(() => openRoomsFor(tier), [tier]);
  const lockedRooms = useMemo(() => lockedRoomsFor(tier), [tier]);
  const [activeRoomId, setActiveRoomId] = useState(
    tier === "free" ? FREE_LOUNGE_ROOM_ID : FIC_ROOM_ID
  );

  const { messages, loading, posting, uploading, mentions, tierOf, xpOf, send } = useChatRoom(
    activeRoomId,
    me
  );

  return (
    <MentionProvider map={mentions}>
      <div className="club-b-card flex max-h-[560px] flex-col overflow-hidden">
        {/* The board's section mark + room pills */}
        <div className="px-3.5 pb-3 pt-3.5">
          <div className="flex items-center gap-1.5">
            <Radio className="h-3 w-3 shrink-0 text-accent" aria-hidden />
            <h3 className="min-w-0 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
              Main Circle
              <span className="text-accent"> · Live</span>
            </h3>
            <span className="relative ml-0.5 flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
          </div>
          <p className="mt-[3px] text-[10.5px] leading-snug text-soft">
            {tier === "free"
              ? "Say hi in the Free Lounge — the whole club can see it."
              : "Always-on chat — hop in during class or anytime."}
          </p>

          {rooms.length + lockedRooms.length > 1 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {rooms.map((r) => {
                const active = r.id === activeRoomId;
                return (
                  <button
                    key={r.id}
                    onClick={() => setActiveRoomId(r.id)}
                    aria-pressed={active}
                    className={`f0-focus f0-press inline-flex items-center gap-1 rounded-[14px] px-2.5 py-1.5 font-display text-[11px] font-bold transition-colors ${
                      active
                        ? "bg-accent text-[color:var(--accent-on)]"
                        : "club-b-card text-soft hover:text-ink"
                    }`}
                  >
                    <Hash className="h-3 w-3" />
                    {r.name}
                  </button>
                );
              })}
              {lockedRooms.map((r) => (
                <Link
                  key={r.id}
                  href="/upgrade"
                  title="Members chat — join the Club"
                  className="club-b-card f0-focus f0-press inline-flex items-center gap-1 rounded-[14px] px-2.5 py-1.5 font-display text-[11px] font-bold text-soft transition-colors hover:text-accent"
                >
                  <Lock className="h-3 w-3" />
                  {r.name}
                </Link>
              ))}
            </div>
          )}

          {tier === "free" && (
            <p className="mt-2 text-[10.5px] leading-snug text-soft">
              <Lock className="mr-0.5 -mt-0.5 inline h-3 w-3" />
              Main Circle is the members&apos; room —{" "}
              <Link href="/upgrade" className="f0-focus font-semibold text-accent">
                join the Club
              </Link>{" "}
              to chat there.
            </p>
          )}
        </div>

        {/* Messages */}
        <ChatMessageList messages={messages} loading={loading} tierOf={tierOf} xpOf={xpOf} tone="paper" />

        {/* Composer */}
        <ChatComposer me={me} onSend={send} posting={posting} uploading={uploading} tone="paper" />
      </div>
    </MentionProvider>
  );
}
