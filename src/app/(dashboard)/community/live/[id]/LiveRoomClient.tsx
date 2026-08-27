"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Hand, StickyNote, Share2, Video, Sparkles } from "lucide-react";

import CompanyLogo from "@/components/fic/CompanyLogo";
import { MentionProvider } from "@/lib/mentions";
import { useChatRoom, type ChatMe } from "@/lib/useChatRoom";
import ChatMessageList from "@/components/community/chat/ChatMessageList";
import ChatComposer from "@/components/community/chat/ChatComposer";
import { toast } from "@/components/ui/Toast";
import type { LiveEventCardData } from "@/lib/live/types";

/**
 * Live Room — board 13 rebuilt pixel-faithful to the "Live room" artboard.
 * A REAL room bound to a live_event. Composition, top → bottom:
 *
 *   · HERO           — cover (brand gradient) · LIVE badge + watcher count ·
 *                      title · host · "N min in"
 *   · ACTIONS        — Raise hand · Notes · Share  (+ Join on Zoom when join_url)
 *   · ON SCREEN NOW  — the room's primary covered ticker + its live quote
 *   · ROOM CHAT      — the EXISTING club chat machinery (useChatRoom + shared
 *                      ChatMessageList/ChatComposer) scoped to THIS event's id,
 *                      with the kai_summary pinned above it when present
 *   · COMPOSER       — "Say something…" → writes to chat_messages(room_id=event.id)
 *
 * Nothing is simulated: watcher/quote/chat are all real (or a calm empty state);
 * the cover degrades to a gradient because the card contract carries no artwork.
 */

function minutesIn(startsAt: string): number | null {
  const t = new Date(startsAt).getTime();
  if (!Number.isFinite(t)) return null;
  const mins = Math.floor((Date.now() - t) / 60000);
  return mins >= 0 ? mins : null;
}

function OnScreenNow({ ticker }: { ticker: string }) {
  const [q, setQ] = useState<{ price: number; changePct: number } | null>(null);
  useEffect(() => {
    let on = true;
    fetch(`/api/market/quote?symbol=${encodeURIComponent(ticker)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!on) return;
        const quote = d?.quote;
        if (quote && typeof quote.price === "number") {
          setQ({ price: quote.price, changePct: Number(quote.changePercent) || 0 });
        }
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [ticker]);
  const up = (q?.changePct ?? 0) >= 0;
  return (
    <Link
      href={`/research/${encodeURIComponent(ticker)}`}
      className="flex items-center gap-3 rounded-2xl border border-sand bg-card p-3.5 shadow-soft transition-colors hover:border-volt-400"
    >
      <CompanyLogo symbol={ticker} name={ticker} size={44} rounded="rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[16px] font-extrabold tracking-tight text-ink">{ticker}</p>
        <p className="truncate text-[13px] text-soft">Covered live in this room</p>
      </div>
      {q && (
        <span className={`shrink-0 font-mono text-[15px] font-extrabold tabular-nums ${up ? "text-green-600" : "text-red-600"}`}>
          {up ? "▲" : "▼"}{Math.abs(q.changePct).toFixed(2)}%
        </span>
      )}
    </Link>
  );
}

export default function LiveRoomClient({ event, me }: { event: LiveEventCardData; me: ChatMe | null }) {
  // Scope the club chat machinery to THIS event — messages persist to
  // chat_messages(room_id = event.id) and stream back over the same realtime
  // channel every other room uses. Real, not simulated.
  const { messages, loading, posting, uploading, mentions, tierOf, xpOf, send } = useChatRoom(event.id, me);
  const [handRaised, setHandRaised] = useState(false);

  const mins = useMemo(() => minutesIn(event.starts_at), [event.starts_at]);
  const live = event.status === "live";
  const watchers = event.viewer_count;
  const primaryTicker = event.tickers[0] ?? null;
  const otherTickers = event.tickers.slice(1);

  function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      navigator.share({ title: event.title, url }).catch(() => {});
    } else if (url && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => toast("Room link copied", "info")).catch(() => {});
    }
  }

  return (
    <MentionProvider map={mentions}>
      <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col">
        {/* Hero cover — brand gradient (contract carries no artwork) */}
        <div
          className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-soft"
          style={{ background: "linear-gradient(150deg,#0B1220 0%,#13233d 55%,#0A2320 100%)" }}
        >
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 backdrop-blur">
              {live && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
              )}
              <span className="font-display text-[12px] font-extrabold uppercase tracking-wider text-white">
                {live ? "Live" : event.status === "starting_soon" ? "Starting soon" : "Room"}
              </span>
              {watchers > 0 && (
                <span className="font-mono text-[12px] text-white/80">
                  {watchers.toLocaleString()} watching
                </span>
              )}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-white">
              {event.title}
            </h1>
            <p className="mt-0.5 text-[15px] text-white/80">
              {event.host.name}
              {mins != null && <span> · {mins} min in</span>}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setHandRaised((v) => !v);
              toast(handRaised ? "Hand lowered" : "Hand raised", "info");
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 font-display text-[15px] font-bold transition-colors ${
              handRaised ? "bg-volt-600 text-white" : "bg-volt-500 text-white hover:bg-volt-600"
            }`}
          >
            <Hand className="h-4 w-4" /> {handRaised ? "Hand up" : "Raise hand"}
          </button>
          <button
            type="button"
            onClick={() => toast("Room notes open after the session", "info")}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-sand bg-card px-4 py-3 font-display text-[15px] font-bold text-ink shadow-soft hover:border-volt-400"
          >
            <StickyNote className="h-4 w-4" /> Notes
          </button>
          <button
            type="button"
            onClick={share}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-sand bg-card px-4 py-3 font-display text-[15px] font-bold text-ink shadow-soft hover:border-volt-400"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        {/* Zoom join affordance — only when the host has posted a join link */}
        {event.join_url && (
          <a
            href={event.join_url}
            target={event.join_url.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="mt-2.5 flex items-center justify-center gap-2 rounded-full bg-kai-500 px-4 py-3 font-display text-[15px] font-bold text-white transition-colors hover:bg-kai-600"
          >
            <Video className="h-4 w-4" /> Join on Zoom
          </a>
        )}

        {/* On screen now — the primary covered ticker + live quote */}
        {primaryTicker && (
          <div className="mt-5">
            <p className="mb-2 font-display text-[12px] font-extrabold uppercase tracking-[0.14em] text-volt-700">
              On screen now
            </p>
            <OnScreenNow ticker={primaryTicker} />
          </div>
        )}

        {/* Covered tickers */}
        {otherTickers.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-soft">Also covered</span>
            {otherTickers.map((t) => (
              <Link
                key={t}
                href={`/research/${encodeURIComponent(t)}`}
                className="inline-flex items-center rounded-full border border-sand bg-card px-3 py-1 font-mono text-[13px] font-bold text-ink shadow-soft hover:border-volt-400"
              >
                {t}
              </Link>
            ))}
          </div>
        )}

        {/* Room chat */}
        <div className="mt-5 flex min-h-[280px] flex-1 flex-col">
          <p className="mb-2 font-display text-[18px] font-extrabold uppercase tracking-tight text-ink">
            Room chat
          </p>

          {/* Kai recap pin — only when a summary exists (zero-LLM safe) */}
          {event.kai_summary && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-kai-300/60 bg-kai-500/8 px-3 py-2.5">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-kai-500/15 text-kai-600">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <p className="text-[14px] leading-snug text-ink">
                <span className="font-display font-bold text-kai-600">Kai</span>{" "}
                <span className="text-soft">{event.kai_summary}</span>
              </p>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col">
            <ChatMessageList
              messages={messages}
              loading={loading}
              tierOf={tierOf}
              xpOf={xpOf}
              tone="paper"
              emptyText="Be the first to say something in the room 👋"
              className="!px-0"
            />
          </div>

          <div className="mt-2">
            <ChatComposer
              me={me}
              onSend={send}
              posting={posting}
              uploading={uploading}
              tone="paper"
              placeholder="Say something…"
            />
          </div>
        </div>
      </div>
    </MentionProvider>
  );
}
