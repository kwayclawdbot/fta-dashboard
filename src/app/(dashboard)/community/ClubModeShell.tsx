"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Pencil, Search } from "lucide-react";
import { deriveRegister } from "@/lib/register";
import { openCommandSearch } from "@/components/search/CommandSearch";
import type { CommunityFeedSeed } from "@/lib/feed-seed";
import type { ChatMe } from "@/lib/useChatRoom";
import { useLiveEventsState, primaryLiveEvent, isEventUrgent } from "@/lib/clubhome/live-events";
import { designV2Enabled } from "@/lib/design-flag";
import ClubModeShellV2 from "./ClubModeShellV2";
import CommunityClient from "./CommunityClient";
import ClubRooms from "./ClubRooms";
import ClubDiscussions from "./ClubDiscussions";
import ClubLiveTab from "./ClubLiveTab";
import { FIC_ROOM_ID, FREE_LOUNGE_ROOM_ID } from "./rooms";
import { BoardMasthead, BoardTabs, PresenceLine, type BoardTab } from "./board";
import { useClubPresence } from "./parts";

/**
 * THE CLUB — Club Screens 01/02/06/07, built as drawn.
 *
 * Every one of those boards opens the same way and this shell IS that opening: a
 * black uppercase THE CLUB set at the top-left, the live presence line under it,
 * search + compose on the right, and the FEED · DISCUSSIONS · CHANGED MY MIND
 * tab strip with the orange rule under the active label.
 *
 * The boards reach the Lounge and the Live rooms from the phone's bottom bar. On
 * this surface there is no bottom bar to reach them from, so LOUNGE and LIVE ride
 * the same strip — one navigation, in the drawn grammar, rather than a second
 * control competing with it. CHANGED MY MIND is a route (it is server-seeded), so
 * it is a link wearing a tab.
 *
 * PRESENCE is real (GET /api/club/collective) and floored: above the floor the
 * line states the count, below it (the founding club) it states what the room is.
 * No branch prints "0 online".
 */

type Mode = "feed" | "discussions" | "lounge" | "live";

/** The presence line per mode — below-floor copy, shown to everyone. */
const MODE_PRESENCE: Record<Mode, string> = {
  feed: "The founding floor — small on purpose",
  discussions: "Every name the club is arguing about",
  lounge: "Always on — the founding members are here",
  live: "Rooms open with the challenge",
};

interface ClubModeShellProps {
  initialData: CommunityFeedSeed | null;
  /** preview/dev only — surface fixture live_events so the Live mode + on-air
   *  rule are reviewable before the S2.5 backend lands. */
  demoEvents?: boolean;
}

/**
 * v2 dispatch — pure branch, NO hooks (so the early return can't trip
 * rules-of-hooks; the same split /discover uses). OFF (default) runs the
 * original v1 body below, byte-identical to production.
 */
export default function ClubModeShell(props: ClubModeShellProps) {
  if (designV2Enabled()) return <ClubModeShellV2 initialData={props.initialData} demoEvents={props.demoEvents} />;
  return <ClubModeShellV1 {...props} />;
}

function ClubModeShellV1({ initialData, demoEvents = false }: ClubModeShellProps) {
  const searchParams = useSearchParams();
  // Go-live deep-link (/club?live={id} → /community?mode=live&live={id}): the
  // push lands here and opens the Live tab focused on that room.
  const liveParam = searchParams.get("live");
  const initialMode = ((): Mode => {
    const m = searchParams.get("mode");
    if (liveParam) return "live";
    return m === "lounge" || m === "live" || m === "discussions" ? m : "feed";
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

  // The room the member is standing in. Lifted here so the coloured grid on
  // Discussions and the pill rail in the Lounge stay one selection, not two.
  const [roomId, setRoomId] = useState<string>(
    tier === "free" ? FREE_LOUNGE_ROOM_ID : FIC_ROOM_ID
  );

  // LOADING IS NOT EMPTY: the live tab owns "Nobody is on the air." at
  // display size, so it needs the in-flight signal, not just an empty array.
  const { events, loading: eventsLoading } = useLiveEventsState({ fixtures: demoEvents });
  const showLive = !isKid;
  const primaryLive = showLive ? primaryLiveEvent(events) : null;
  const liveNow = primaryLive && isEventUrgent(primaryLive) ? primaryLive : null;
  const liveCount = showLive
    ? events.filter((e) => e.status === "live" || e.status === "starting_soon").length
    : 0;

  const tabs: BoardTab[] = [
    { id: "feed", label: "Feed" },
    { id: "discussions", label: "Discussions" },
    ...(isKid ? [] : [{ id: "cmm", label: "Changed my mind", href: "/community/changed-my-mind" }]),
    { id: "lounge", label: "Lounge" },
    ...(showLive ? [{ id: "live", label: "Live", onAir: liveCount > 0 }] : []),
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

  /** Board 01's presence line: real counts above the floor, founding copy below. */
  const presenceLine = useMemo(() => {
    if (presence?.floorMet) {
      return (
        <>
          <span className="font-bold tabular-nums text-ink">{presence.connectedMinds}</span> members
          {presence.actionsToday > 0 && (
            <>
              {" · "}
              <span className="font-bold tabular-nums text-ink">{presence.actionsToday}</span> moves
              today
            </>
          )}
        </>
      );
    }
    return MODE_PRESENCE[mode];
  }, [presence, mode]);

  return (
    <div className="mx-auto max-w-2xl px-0">
      <BoardMasthead
        title={mode === "lounge" ? "The Lounge" : mode === "live" ? "Live" : "The Club"}
        presence={<PresenceLine>{presenceLine}</PresenceLine>}
        actions={
          <>
            {/* The masthead glyph raises the universal ⌘K palette — the one
                surface that actually searches members, theses, debates and
                names. It used to link /research, which is not a route. */}
            <button
              type="button"
              onClick={openCommandSearch}
              aria-label="Search the Club"
              className="f0-focus text-ink transition-colors hover:text-gold-700"
            >
              <Search className="h-[21px] w-[21px]" strokeWidth={2} />
            </button>
            {!isKid && (
              <Link
                href="/community/compose"
                aria-label="Share your call"
                className="f0-focus text-ink transition-colors hover:text-gold-700"
              >
                <Pencil className="h-[21px] w-[21px]" strokeWidth={2} />
              </Link>
            )}
          </>
        }
      />

      <div className="mt-4">
        <BoardTabs
          tabs={tabs}
          active={mode}
          onSelect={(id) => selectMode(id as Mode)}
          ariaLabel="The Club"
        />
      </div>

      {/* Amendment #2 — the on-air rule stays, now as the board's own object: a
          near-black strip directly under the tabs that hands the member into the
          Live screen. It renders only when a room is genuinely on the air. */}
      {liveNow && mode !== "live" && (
        <button
          type="button"
          onClick={() => selectMode("live")}
          className="f0-focus mt-4 flex w-full items-center gap-2.5 rounded-[12px] bg-[#14110F] px-3.5 py-2.5 text-left transition-opacity hover:opacity-90"
        >
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="shrink-0 font-mono text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-volt-300">
            {liveNow.status === "live" ? "On air" : "Starting"}
          </span>
          <span className="min-w-0 flex-1 truncate font-display text-[13px] font-bold text-[#F7F3EA]">
            {liveNow.title}
          </span>
          <span className="shrink-0 rounded-[6px] bg-volt-500 px-2.5 py-1 font-display text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-white">
            Join
          </span>
        </button>
      )}

      <div className="mt-5">
        {mode === "feed" && (
          <CommunityClient
            initialData={initialData}
            embedded
            onOpenDiscussions={() => selectMode("discussions")}
          />
        )}

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
  );
}
