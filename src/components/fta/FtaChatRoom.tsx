"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MentionProvider } from "@/lib/mentions";
import { useChatRoom, type ChatMe } from "@/lib/useChatRoom";
import ChatMessageList from "@/components/community/chat/ChatMessageList";
import ChatComposer from "@/components/community/chat/ChatComposer";
import FtaHubHeader from "@/components/fta/FtaHubHeader";

/**
 * FtaChatRoom — the FTA traders room, canvas v2 (Club Screens 08 "In the room").
 *
 * The canvas draws the in-room screen as a full dark field with the title in
 * display caps, an eyebrow-labelled section per block and the composer pinned to
 * a hairline at the foot. That is exactly what this is now: the room panel keeps
 * its true-dark ground (the one member surface allowed to lean dark in both
 * themes, per the admin-shell precedent) but the boxed "channel card" chrome is
 * gone — the room states itself with a hairline top rule, a mono channel line and
 * a display-scale ledger of messages.
 *
 * COLOUR LAW FIX: the live-presence dot was `bg-green-500`. Green is PRICE. A
 * room being live is a BRAND/ACTION signal, so the dot now rides the metallic
 * accent, the same signal the Live Classes on-air field uses.
 *
 * PRESENCE IS REAL: `online` comes from a Supabase presence channel, floored at
 * 1 (you). It is never inflated and it is labelled "in the room", not "members".
 *
 * WIRING UNTOUCHED: useChatRoom → chat_messages + the community-room realtime
 * channel, plus the shared message-list/composer, so @mentions and push
 * notifications ride the exact same pipes as the Club drawer.
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
      <div className="mx-auto w-full max-w-3xl pb-10">
        <FtaHubHeader
          title="Traders"
          mark="Chat"
          subtitle="The always-on room for the FTA cohort — setups, questions, and live-class talk."
        />

        {/* The room. A dark field with a hairline head, not a bordered card. */}
        <div className="mt-8 flex h-[62vh] min-h-[440px] flex-col overflow-hidden rounded-2xl bg-night-950">
          <div className="flex items-center justify-between gap-3 border-b border-night-800 px-4 py-3">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="font-mono text-[13px] font-semibold text-ftagold-500">#</span>
              <span className="truncate font-display text-[14px] font-extrabold uppercase tracking-[0.08em] text-night-50">
                traders
              </span>
              <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.14em] text-night-300 sm:inline">
                FTA members only
              </span>
            </div>
            {/* COLOUR LAW: live is an ACTION/brand signal, never green. */}
            <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-night-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              {online} in the room
            </div>
          </div>

          <ChatMessageList
            messages={messages}
            loading={loading}
            tierOf={tierOf}
            xpOf={xpOf}
            tone="dark"
            emptyText="Nobody has spoken yet — open the room."
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
