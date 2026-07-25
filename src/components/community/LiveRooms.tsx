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
 * (ClubChatDrawer) shared across /community and /chart. The realtime engine now
 * lives in useChatRoom + shared ChatMessageList/ChatComposer, so this file is
 * just the drawer's header, room tabs, and gating. FIC Club + Free Lounge only —
 * the FTA Traders room moved OUT to its dedicated /fta/chat page (Lane 3).
 */

const FIC_ROOM_ID = "c0000000-0000-4000-a000-000000000001";
const FREE_LOUNGE_ROOM_ID = "c0000000-0000-4000-a000-000000000003";

interface Room {
  id: string;
  name: string;
}
const FIC_ROOM: Room = { id: FIC_ROOM_ID, name: "Members Club" };
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
      <div className="paper-card overflow-hidden flex flex-col max-h-[560px]">
        {/* Header + room tabs */}
        <div className="px-4 py-3 border-b border-sand">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500/60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <h3 className="font-display text-sm font-bold text-ink flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-gold-600" /> Club Chat
            </h3>
          </div>
          <p className="text-[11px] text-soft mt-0.5">
            {tier === "free"
              ? "Say hi in the Free Lounge — the whole club can see it."
              : "Always-on chat — hop in during class or anytime."}
          </p>
          {rooms.length + lockedRooms.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {rooms.map((r) => {
                const active = r.id === activeRoomId;
                return (
                  <button
                    key={r.id}
                    onClick={() => setActiveRoomId(r.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-display font-semibold border transition-colors ${
                      active ? "bg-chip-amber border-gold-300 text-gold-800" : "bg-white border-sand text-soft hover:text-ink"
                    }`}
                  >
                    <Hash className="w-3 h-3" />
                    {r.name}
                  </button>
                );
              })}
              {lockedRooms.map((r) => (
                <Link
                  key={r.id}
                  href="/upgrade"
                  title="Members chat — join the Club"
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-display font-semibold border border-sand bg-paper text-soft/80 hover:text-gold-700 hover:border-gold-300 transition-colors"
                >
                  <Lock className="w-3 h-3" />
                  {r.name}
                </Link>
              ))}
            </div>
          )}
          {tier === "free" && (
            <p className="text-[11px] text-soft/80 mt-1.5">
              <Lock className="inline w-3 h-3 -mt-0.5 mr-0.5" />
              Members Club is the members&apos; room —{" "}
              <Link href="/upgrade" className="text-gold-700 font-semibold">
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
