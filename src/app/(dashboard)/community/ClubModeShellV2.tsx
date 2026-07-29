"use client";

/**
 * THE CLUB — v2 canvas (board 04 "Club · Feed"). Rendered ONLY behind
 * designV2Enabled() (ClubModeShell branches into it on its first line). It is the
 * board-04 shell: a Kaushan "club" script mark, a real floored presence line, a
 * compose + search control pair, and the FEED · DISCUSSIONS · LOUNGE · LIVE
 * sub-tab row in the cc voice, with CHANGED MY MIND and CIRCLES riding beside it
 * as route link-chips (the board's middle tab is CIRCLES; our IA keeps Lounge in
 * the strip and hangs Circles off it as a link).
 *
 * WHAT'S RE-SKINNED vs REUSED:
 *   · Feed mode → the new cc CommunityClientV2 (fully re-skinned).
 *   · Discussions / Lounge / Live → the EXISTING ClubDiscussions / ClubRooms /
 *     ClubLiveTab, rendered unchanged. They carry v1 chrome inside the v2 shell
 *     (acceptable — a full cc re-skin of the realtime chat / live-room surfaces
 *     is its own lane; noted here as a visual follow-up). Their FUNCTIONALITY is
 *     preserved whole.
 *
 * PRESENCE is real (useClubPresence → GET /api/club/collective) and floored:
 * above the floor the line states the count, below it (the founding club) it
 * states what the room is. No branch prints "0 online".
 *
 * DEEP-LINKS: /community?mode=… and ?live={id} are preserved, and selectMode
 * keeps the URL in sync exactly as v1 does.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil, Search } from "lucide-react";
import { deriveRegister } from "@/lib/register";
import { openCommandSearch } from "@/components/search/CommandSearch";
import type { CommunityFeedSeed } from "@/lib/feed-seed";
import type { ChatMe } from "@/lib/useChatRoom";
import { useLiveEventsState, primaryLiveEvent, isEventUrgent } from "@/lib/clubhome/live-events";
import CommunityClientV2 from "./CommunityClientV2";
import ClubRooms from "./ClubRooms";
import ClubDiscussions from "./ClubDiscussions";
import ClubLiveTab from "./ClubLiveTab";
import CirclesSurfaceV2 from "@/components/circles/CirclesSurfaceV2";
import { FIC_ROOM_ID, FREE_LOUNGE_ROOM_ID } from "./rooms";
import { useClubPresence } from "./parts";
import V2Surface from "@/components/clubhome/v2/V2Surface";
import { ScriptTitle } from "@/components/cc/ui";
import { SubTabs } from "@/components/cc/interactive";

/**
 * IA (owner directive, 07-28): the visible tab row is FEED · CIRCLES only.
 *   · CIRCLES is a real tab now — it renders the board-16 grid (CirclesSurfaceV2)
 *     inline instead of routing away; /circles still resolves to the same view.
 *   · LIVE has no tab — the in-feed ON-AIR strip is the only live entry point,
 *     and clicking it still switches to the (tab-less) "live" mode.
 *   · DISCUSSIONS + LOUNGE are no longer tabs; the feed's quiet foot row
 *     ("Rooms & discussions ›") is their single entry point. Their routes /
 *     components are untouched — full consolidation is an owner call.
 *   · CHANGED MY MIND is no longer a tab-adjacent chip — it lives inline in the
 *     feed (CmmPreview) with its own "See all" link to /community/changed-my-mind.
 */
type Mode = "feed" | "circles" | "discussions" | "lounge" | "live";

/** The presence line per mode — below-floor copy, shown to everyone. */
const MODE_PRESENCE: Record<Mode, string> = {
  feed: "The founding floor — small on purpose",
  circles: "Breakout rooms on a 30-day clock",
  discussions: "Every name the club is arguing about",
  lounge: "Always on — the founding members are here",
  live: "Rooms open with the challenge",
};

export default function ClubModeShellV2({
  initialData,
  demoEvents = false,
}: {
  initialData: CommunityFeedSeed | null;
  demoEvents?: boolean;
}) {
  const searchParams = useSearchParams();
  const liveParam = searchParams.get("live");
  const initialMode = ((): Mode => {
    const m = searchParams.get("mode");
    if (liveParam) return "live";
    return m === "lounge" || m === "live" || m === "discussions" || m === "circles"
      ? m
      : "feed";
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

  const presence = useClubPresence();

  const [roomId, setRoomId] = useState<string>(
    tier === "free" ? FREE_LOUNGE_ROOM_ID : FIC_ROOM_ID
  );

  const { events, loading: eventsLoading } = useLiveEventsState({ fixtures: demoEvents });
  const showLive = !isKid;
  const primaryLive = showLive ? primaryLiveEvent(events) : null;
  const liveNow = primaryLive && isEventUrgent(primaryLive) ? primaryLive : null;

  // FEED · CIRCLES only (owner directive). Live rides the in-feed on-air strip;
  // discussions/lounge ride the feed's foot row — none of them are tabs.
  const tabs = useMemo(
    () =>
      [
        { id: "feed" as const, label: "Feed" },
        { id: "circles" as const, label: "Circles" },
      ] satisfies { id: Mode; label: string }[],
    []
  );

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

  // Board 04's presence line: real counts above the floor, founding copy below.
  const presenceLine = useMemo(() => {
    if (presence?.floorMet) {
      const parts = [`${presence.connectedMinds} members`];
      if (presence.actionsToday > 0) parts.push(`${presence.actionsToday} moves today`);
      return parts.join(" · ");
    }
    return MODE_PRESENCE[mode];
  }, [presence, mode]);

  const title = mode === "lounge" ? "the lounge" : mode === "live" ? "live" : "club";

  return (
    <V2Surface className="min-h-screen">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        {/* Masthead — script mark + floored presence line + controls. */}
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <ScriptTitle>{title}</ScriptTitle>
            <p className="mt-2.5 flex items-center gap-2">
              <span className="relative inline-flex h-[7px] w-[7px] shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: "var(--cc-up)" }} />
                <span className="relative inline-flex h-[7px] w-[7px] rounded-full" style={{ background: "var(--cc-up)" }} />
              </span>
              <span className="min-w-0 truncate font-[family-name:var(--font-plex-mono)] text-[10.5px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-soft)" }}>
                {presenceLine}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5 pt-1">
            {!isKid && (
              <Link
                href="/community/compose"
                aria-label="Share your call"
                className="grid h-[34px] w-[34px] place-items-center rounded-full border transition-colors"
                style={{ borderColor: "var(--cc-line)", background: "var(--cc-card)", color: "var(--cc-ink)" }}
              >
                <Pencil className="h-[15px] w-[15px]" strokeWidth={2} />
              </Link>
            )}
            <button
              type="button"
              onClick={openCommandSearch}
              aria-label="Search the Club"
              className="grid h-[34px] w-[34px] place-items-center rounded-full border transition-colors"
              style={{ borderColor: "var(--cc-line)", background: "var(--cc-card)", color: "var(--cc-ink)" }}
            >
              <Search className="h-[15px] w-[15px]" strokeWidth={2} />
            </button>
          </div>
        </header>

        {/* FEED · CIRCLES — the only two tabs (owner directive). Changed-my-mind
            lives inline in the feed; discussions/lounge in the feed's foot row. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
          <SubTabs<Mode> tabs={tabs} value={mode} onChange={selectMode} />
        </div>

        {/* On-air rule strip — renders only when a room is genuinely on the air.
            orange live dot (live states are orange under the colour law) + Join. */}
        {liveNow && mode !== "live" && (
          <button
            type="button"
            onClick={() => selectMode("live")}
            className="mt-4 flex w-full items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left transition-opacity hover:opacity-90"
            style={{ background: "var(--cc-card)", borderColor: "var(--cc-line)" }}
          >
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 motion-reduce:hidden" style={{ background: "var(--cc-orange)" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--cc-orange)" }} />
            </span>
            <span className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[9.5px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--cc-orange-ink)" }}>
              {liveNow.status === "live" ? "On air" : "Starting"}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: "var(--cc-ink)" }}>
              {liveNow.title}
            </span>
            <span className="cc-halo shrink-0 rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: "var(--cc-orange)", color: "var(--cc-orange-deep)" }}>
              Join
            </span>
          </button>
        )}

        <div className="mt-5">
          {mode === "feed" && (
            <CommunityClientV2
              initialData={initialData}
              embedded
              onOpenDiscussions={() => selectMode("discussions")}
              onOpenLounge={() => selectMode("lounge")}
            />
          )}

          {/* CIRCLES — the board-16 grid, inline (no separate destination). The
              /circles route still renders the same CirclesSurfaceV2. */}
          {mode === "circles" && <CirclesSurfaceV2 embedded />}

          {/* Discussions / Lounge / Live reuse the existing components unchanged —
              full functionality preserved; v1 chrome inside the v2 shell is an
              accepted visual follow-up (do not rewrite the realtime surfaces). */}
          {mode === "discussions" && (
            <ClubDiscussions
              posts={initialData?.posts ?? []}
              meId={me?.id ?? null}
              tier={tier}
              roomId={roomId}
              onOpenRoom={(id) => {
                setRoomId(id);
                selectMode("lounge");
              }}
            />
          )}

          {mode === "lounge" && (
            <ClubRooms me={chatMe} tier={tier} activeId={roomId} onSelect={setRoomId} />
          )}

          {mode === "live" && showLive && (
            <ClubLiveTab
              events={events}
              loading={eventsLoading}
              focusId={liveParam}
              onGoToLounge={() => selectMode("lounge")}
            />
          )}
        </div>
      </div>
    </V2Surface>
  );
}
