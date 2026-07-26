"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Users, Radio } from "lucide-react";
import Avatar from "@/components/Avatar";
import { EditorialSection } from "@/components/grammar";
import { deriveRegister } from "@/lib/register";
import type { CommunityFeedSeed } from "@/lib/feed-seed";
import type { ChatMe } from "@/lib/useChatRoom";
import { useLiveEvents, primaryLiveEvent, isEventUrgent } from "@/lib/clubhome/live-events";
import { LiveEventCard, LiveNowStrip } from "@/components/live";
import CommunityClient from "./CommunityClient";
import LiveRooms from "@/components/community/LiveRooms";
import ClubLiveTab from "./ClubLiveTab";

/**
 * THE CLUB — the biggest single lift of the convergence (amendment #1 is LAW):
 * NO landing layer above Feed / Lounge / Live. The Club opens DIRECTLY into the
 * three MODES OF HUMAN COMMUNICATION via a quiet strip. There is no parallel
 * social taxonomy — all the richness (live_events, and the rich objects the Feed
 * already mixes in) lives INSIDE the modes, never as sibling sections.
 *
 *   Feed   — one intelligently-ranked, persistent stream; rich objects
 *            (live_event cards) lead so it reads with rhythm, composer accessible
 *            but not the front door. (= the existing community feed, embedded.)
 *   Lounge — the always-on Main Circle chat, reframed with presence.
 *   Live   — the room list: on-air, scheduled, recent replays.
 *
 * Amendment #2: when a room is live, a prominent LIVE NOW strip renders ABOVE the
 * mode strip. Kid register keeps the safe subset (Feed read-only posture + Lounge;
 * adult Live rooms deferred to the kid safety framework).
 */

type Mode = "feed" | "lounge" | "live";

export default function ClubModeShell({
  initialData,
  demoEvents = false,
}: {
  initialData: CommunityFeedSeed | null;
  /** preview/dev only — surface fixture live_events so the Live mode + LIVE NOW
   *  strip are reviewable before the S2.5 backend lands. */
  demoEvents?: boolean;
}) {
  const searchParams = useSearchParams();
  // Go-live deep-link (/club?live={id} → /community?mode=live&live={id}): the
  // push lands here and opens the Live tab focused on that room.
  const liveParam = searchParams.get("live");
  const initialMode = ((): Mode => {
    const m = searchParams.get("mode");
    if (liveParam) return "live";
    return m === "lounge" || m === "live" ? m : "feed";
  })();
  const [mode, setMode] = useState<Mode>(initialMode);

  const me = initialData?.me ?? null;
  const tier = initialData?.myTier ?? "fic";
  const register = deriveRegister(me);
  const isKid = register === "kid";
  const chatMe: ChatMe | null = me
    ? {
        id: me.id,
        display_name: me.display_name,
        role: me.role,
        age_group: me.age_group ?? null,
        family_id: me.family_id ?? null,
        avatar_url: me.avatar_url ?? null,
        username: me.username ?? null,
      }
    : null;

  // Real member faces for the Lounge presence strip (never fabricated) — the
  // most recent distinct post authors from the seed.
  const loungeFaces = useMemo(() => {
    const seen = new Set<string>();
    const faces: { name: string; avatar_url: string | null }[] = [];
    for (const p of initialData?.posts ?? []) {
      const a = p.author;
      if (!a || !a.id || seen.has(a.id)) continue;
      seen.add(a.id);
      faces.push({ name: a.display_name || "Member", avatar_url: a.avatar_url ?? null });
      if (faces.length >= 6) break;
    }
    return faces;
  }, [initialData]);

  const events = useLiveEvents({ fixtures: demoEvents });
  const showLive = !isKid;
  const primaryLive = showLive ? primaryLiveEvent(events) : null;
  const liveNow = primaryLive && isEventUrgent(primaryLive) ? primaryLive : null;
  const liveCount = showLive
    ? events.filter((e) => e.status === "live" || e.status === "starting_soon").length
    : 0;

  const modes: { id: Mode; label: string; icon: React.ElementType; hidden?: boolean }[] = [
    { id: "feed", label: "Feed", icon: MessageSquare },
    { id: "lounge", label: "Lounge", icon: Users },
    { id: "live", label: "Live", icon: Radio, hidden: !showLive },
  ];

  function selectMode(next: Mode) {
    setMode(next);
    try {
      const url = new URL(window.location.href);
      if (next === "feed") url.searchParams.delete("mode");
      else url.searchParams.set("mode", next);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  }

  // The Club feed lead: live_event rich objects give the stream rhythm.
  const feedLead =
    showLive && events.length > 0 ? (
      <EditorialSection title="Live in the Club">
        <div className="space-y-3">
          {[...events]
            .sort((a, b) => (a.status === "live" ? -1 : 1) - (b.status === "live" ? -1 : 1))
            .slice(0, 2)
            .map((e) => (
              <LiveEventCard key={e.id} event={e} />
            ))}
        </div>
      </EditorialSection>
    ) : null;

  return (
    <div className="mx-auto max-w-2xl px-0">
      {/* Amendment #2 — LIVE NOW above the mode strip */}
      {liveNow && (
        <div className="mb-4">
          <LiveNowStrip event={liveNow} />
        </div>
      )}

      {/* The quiet mode strip — the ONLY navigation The Club exposes */}
      <div className="mb-5 flex items-center gap-1 border-b border-sand">
        {modes
          .filter((m) => !m.hidden)
          .map((m) => {
            const active = mode === m.id;
            const isLive = m.id === "live";
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMode(m.id)}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 font-display text-[15px] font-bold transition-colors ${
                  active
                    ? "border-volt-500 text-ink"
                    : "border-transparent text-soft hover:text-ink"
                }`}
              >
                {isLive && liveCount > 0 ? (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt-500 opacity-70 motion-reduce:hidden" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-volt-500" />
                  </span>
                ) : (
                  <m.icon className="h-4 w-4" />
                )}
                {m.label}
                {isLive && liveCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-volt-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                    {liveCount}
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {mode === "feed" && (
        <CommunityClient initialData={initialData} embedded leadSlot={feedLead} />
      )}

      {mode === "lounge" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-[20px] font-bold tracking-tight text-ink">
                The Lounge
              </h2>
              <p className="mt-0.5 flex items-center gap-2 text-sm text-soft">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-70 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
                </span>
                {loungeFaces.length > 0
                  ? "Members are around — say hi"
                  : "Always-on chat — be the first voice today"}
              </p>
            </div>
            {loungeFaces.length > 0 && (
              <div className="flex -space-x-2">
                {loungeFaces.map((f, i) => (
                  <Avatar
                    key={i}
                    name={f.name}
                    avatarUrl={f.avatar_url ?? undefined}
                    size="sm"
                    className="ring-2 ring-paper"
                  />
                ))}
              </div>
            )}
          </div>
          <LiveRooms me={chatMe} tier={tier} />
        </div>
      )}

      {mode === "live" && showLive && <ClubLiveTab events={events} focusId={liveParam} />}
    </div>
  );
}
