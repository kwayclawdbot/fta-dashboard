"use client";

import { useEffect, useState } from "react";
import { Hash, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MentionProvider } from "@/lib/mentions";
import { useChatRoom, type ChatMe } from "@/lib/useChatRoom";
import ChatMessageList from "@/components/community/chat/ChatMessageList";
import ChatComposer from "@/components/community/chat/ChatComposer";
import FtaHubHeader from "@/components/fta/FtaHubHeader";

/**
 * FtaChatRoom — the dedicated FTA Traders room, moved out of the Club Chat
 * drawer into a Discord-vibe full page. It reuses the exact same realtime
 * engine (useChatRoom → chat_messages + community-room channel) and shared
 * message-list/composer as the drawer, so @mentions + push notifications ride
 * the same pipes. This is the one member surface allowed to lean dark in both
 * themes (true-dark night-* tokens), like the admin-shell precedent. Live
 * presence count comes free from a lightweight realtime presence channel.
 */

const FTA_ROOM_ID = "c0000000-0000-4000-a000-000000000002";

export default function FtaChatRoom({ me }: { me: ChatMe }) {
  const { messages, loading, posting, uploading, mentions, tierOf, xpOf, send } = useChatRoom(
    FTA_ROOM_ID,
    me
  );
  const [online, setOnline] = useState(1);

  // Cheap live presence — how many FTA traders are in the room right now.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        try { await supabase.realtime.setAuth(token); } catch { /* noop */ }
      }
      if (cancelled) return;
      channel = supabase.channel("fta-traders-presence", {
        config: { presence: { key: me.id } },
      });
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState();
          setOnline(Math.max(1, Object.keys(state).length));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel!.track({ online_at: new Date().toISOString() });
          }
        });
    })();
    return () => {
      cancelled = true;
      if (channel) channel.unsubscribe();
    };
  }, [me.id]);

  return (
    <MentionProvider map={mentions}>
      <div className="max-w-4xl mx-auto space-y-4">
        <FtaHubHeader
          title="Traders Chat"
          subtitle="Your always-on room for the FTA cohort — setups, questions, and live-class talk."
          tone="dark"
        />

        {/* Channel panel — dark, Discord-vibe */}
        <div className="rounded-2xl border border-night-700/70 bg-night-950 overflow-hidden flex flex-col h-[62vh] min-h-[440px]">
          {/* Room header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-night-700/70 bg-night-900">
            <div className="flex items-center gap-2 min-w-0">
              <Hash className="w-4 h-4 text-gold-500 shrink-0" />
              <span className="font-display text-sm font-bold text-night-50 truncate">traders</span>
              <span className="hidden sm:inline text-[11px] text-night-300 truncate">
                · FTA members only
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-night-300 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500/60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <Users className="w-3.5 h-3.5" />
              {online} online
            </div>
          </div>

          <ChatMessageList
            messages={messages}
            loading={loading}
            tierOf={tierOf}
            xpOf={xpOf}
            tone="dark"
            emptyText="No messages yet — kick off the conversation 📈"
          />

          <ChatComposer
            me={me}
            onSend={send}
            posting={posting}
            uploading={uploading}
            tone="dark"
            placeholder="Message #traders…"
          />
        </div>
      </div>
    </MentionProvider>
  );
}
