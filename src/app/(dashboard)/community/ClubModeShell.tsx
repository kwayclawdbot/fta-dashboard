"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Radio } from "lucide-react";
import { deriveRegister } from "@/lib/register";
import type { CommunityFeedSeed } from "@/lib/feed-seed";
import type { ChatMe } from "@/lib/useChatRoom";
import { useLiveEventsState, primaryLiveEvent, isEventUrgent } from "@/lib/clubhome/live-events";
import CommunityClient from "./CommunityClient";
import ClubRooms from "./ClubRooms";
import ClubLiveTab from "./ClubLiveTab";
import { DisplayHead } from "@/components/f0/parts";
import {
  AvatarStack,
  PresenceRail,
  SegmentedControl,
  useClubOrientation,
  useClubPresence,
  type Segment,
} from "./parts";

/**
 * THE CLUB — the Community surface, rebuilt to the locked system.
 *
 * Amendment #1 is still LAW: no landing layer above Feed / Lounge / Live. The
 * Club opens DIRECTLY into the three modes of human communication. What changed
 * is the composition:
 *
 *   · ONE dominant voice — a text-display-1 masthead that names the room the
 *     member is standing in, over a mono presence rail carrying REAL counts.
 *   · A premium segmented control instead of the old underline tab strip.
 *   · Amendment #2 preserved: when a room is on the air, an ON-AIR rule sits
 *     ABOVE the control. It is a HAIRLINE, not a boxed strip — the dark
 *     f0-hero-field inside the Live tab is the single dark object on this
 *     surface, and a second heavy banner above it would break that.
 *   · Kid register keeps the safe subset (Feed read-only posture + Lounge; adult
 *     Live rooms stay deferred to the kid safety framework).
 *
 * PRESENCE is real (GET /api/club/collective) and floored: above the floor it
 * states counts, below it (the founding club) it renders designed founding copy.
 * No branch prints "0 online".
 */

type Mode = "feed" | "lounge" | "live";

/**
 * The masthead voice per mode. `title` + `lede` are ORIENTATION — they render
 * for new members only. `founding` is the presence rail's below-floor line and
 * renders for everyone, because it is presence copy, not a title.
 */
const MODE_VOICE: Record<Mode, { title: string; lede: string; founding: string }> = {
  feed: {
    title: "The floor",
    lede: "Where the club files its reads. Every entry is someone's actual position, with their name on it.",
    founding: "The founding floor — small on purpose",
  },
  lounge: {
    title: "The lounge",
    lede: "The always-on room. Quicker than the floor, and the whole club can see it.",
    founding: "Always on — the founding members are here",
  },
  live: {
    title: "The room",
    lede: "Market walk-throughs, classes and audio hangs — live, then kept as recordings.",
    founding: "Rooms open with the challenge",
  },
};

export default function ClubModeShell({
  initialData,
  demoEvents = false,
}: {
  initialData: CommunityFeedSeed | null;
  /** preview/dev only — surface fixture live_events so the Live mode + on-air
   *  rule are reviewable before the S2.5 backend lands. */
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

  const presence = useClubPresence();

  // NEW vs RETURNING — profiles.created_at (24h window, via the app's existing
  // first-run hook) AND real participation from the server seed. See
  // useClubOrientation for the full rationale.
  const orientation = useClubOrientation({
    meId: me?.id,
    posts: initialData?.posts ?? [],
    likedByMe: initialData?.likedByMe ?? [],
  });

  // Real member faces + names for the Lounge (never fabricated) — the most
  // recent DISTINCT post authors from the seed. These are people who actually
  // spoke in the club, not a manufactured crowd.
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

  // LOADING IS NOT EMPTY: the live tab owns "Nobody is on the air." at
  // display-2, so it needs the in-flight signal, not just an empty array.
  const { events, loading: eventsLoading } = useLiveEventsState({ fixtures: demoEvents });
  const showLive = !isKid;
  const primaryLive = showLive ? primaryLiveEvent(events) : null;
  const liveNow = primaryLive && isEventUrgent(primaryLive) ? primaryLive : null;
  const liveCount = showLive
    ? events.filter((e) => e.status === "live" || e.status === "starting_soon").length
    : 0;

  // The soonest scheduled room, for the quiet "next room" rule under the
  // masthead when nothing is on the air.
  const nextRoom = useMemo(() => {
    if (!showLive) return null;
    return (
      [...events]
        .filter((e) => e.status === "scheduled")
        .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""))[0] ?? null
    );
  }, [events, showLive]);
  const nextRoomWhen = nextRoom
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        hour: "numeric",
        timeZone: "America/New_York",
      }).format(new Date(nextRoom.starts_at)) + " ET"
    : null;

  const segments: Segment[] = [
    { id: "feed", label: "Feed" },
    { id: "lounge", label: "Lounge" },
    ...(showLive
      ? [{ id: "live", label: "Live", onAir: liveCount > 0, count: liveCount } as Segment]
      : []),
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

  const voice = MODE_VOICE[mode];

  return (
    <div className="mx-auto max-w-2xl px-0">
      {/* ── ORIENTATION MASTHEAD — NEW MEMBERS ONLY ─────────────────────────
          Owner law: the Community board is not a landing page. A returning
          member gets NO standing title — the board itself is the page, and the
          first thing in the viewport is a real entry. A member still inside the
          new-member window who has not yet posted or backed anything gets the
          orienting title + lede once, because they do not yet know what this
          surface is. See useClubOrientation for exactly what this keys off. */}
      {orientation.show && (
        <header className="pb-5">
          <DisplayHead eyebrow="The Club" title={voice.title} lede={voice.lede} />
        </header>
      )}

      {/* ── Amendment #2 — the ON-AIR rule, above the control ───────────────
          A hairline, not a banner. It announces the room and hands the member
          straight into the Live tab, where the dark hero field carries it.

          COLOUR: the recording signal is the pulsing red DOT only — an icon, and
          the universal "on air" mark, matching the shipped LiveEventCard. The
          LABEL stays ink. Red as TEXT is reserved for price under the colour
          law, and an "ON AIR" in the same red as a −2.4% two rows below would
          read as a down move for a beat. The dot carries the urgency. */}
      {liveNow && (
        <button
          type="button"
          onClick={() => selectMode("live")}
          className="mb-4 flex w-full items-center gap-3 f0-rule-top py-2.5 text-left transition-colors hover:bg-volt-500/[0.06]"
        >
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink">
            {liveNow.status === "live" ? "On air" : "Starting"}
          </span>
          <span className="min-w-0 flex-1 truncate font-display text-[14px] font-bold text-ink">
            {liveNow.title}
          </span>
          <span className="shrink-0 font-mono text-[10.5px] tracking-wide text-soft">
            {liveNow.host.name}
          </span>
          <Radio className="h-3.5 w-3.5 shrink-0 text-gold-600" aria-hidden />
        </button>
      )}

      {/* Nothing on the air, but something is on the schedule. The Feed used to
          lead with live_event CARDS for this; the same discovery now rides a
          quiet hairline so the stream stays a stream. */}
      {!liveNow && nextRoom && (
        <button
          type="button"
          onClick={() => selectMode("live")}
          className="mb-4 flex w-full items-center gap-3 f0-rule-top py-2.5 text-left transition-colors hover:bg-volt-500/[0.06]"
        >
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">
            Next room
          </span>
          <span className="min-w-0 flex-1 truncate font-display text-[14px] font-bold text-ink">
            {nextRoom.title}
          </span>
          <span className="shrink-0 font-mono text-[10.5px] tracking-wide text-soft">
            {nextRoomWhen}
          </span>
        </button>
      )}

      {/* ── The mode control — the ONLY navigation The Club exposes ───────────
          Followed by the presence rail in its COMPACT form. Together they are
          ~70px, so the first entry starts high instead of below a hero. */}
      <div className="mb-4">
        <SegmentedControl
          segments={segments}
          active={mode}
          onSelect={(id) => selectMode(id as Mode)}
          ariaLabel="The Club"
        />
        <div className="mt-2.5">
          <PresenceRail presence={presence} founding={voice.founding} compact />
        </div>
      </div>

      {/* ── The two destinations the canvas adds (Club Screens 03 + 05) ──────
          A quiet mono rail of standing links, deliberately NOT a second
          segmented control: the surface already has one, and a second pill
          group at the same weight reads as two competing navigations. Kids see
          neither — both flows are kid-walled at the RPC. */}
      {!isKid && (
        <nav aria-label="Club destinations" className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href="/community/changed-my-mind"
            className="f0-focus font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-soft transition-colors hover:text-ink"
          >
            Changed my mind
          </Link>
          <Link
            href="/community/compose"
            className="f0-focus font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold-700 transition-colors hover:text-gold-600"
          >
            Share your call →
          </Link>
        </nav>
      )}

      {mode === "feed" && (
        <CommunityClient
          initialData={initialData}
          embedded
          showOrientation={orientation.show}
        />
      )}

      {mode === "lounge" && (
        <div className="space-y-4">
          {/* Lounge presence. The framing PARAGRAPH is orientation, so it is
              new-member only; the FACES are content (real members who actually
              spoke) and stay for everyone, on one compact line. */}
          {orientation.show && (
            <p className="max-w-[44ch] text-[14.5px] leading-relaxed text-soft">
              {loungeFaces.length > 0
                ? "Always-on chat. The whole club sees this room — say something and it lands with everyone."
                : "The room is always on. Be the first voice today — it sets the tone for everyone who walks in after."}
            </p>
          )}
          {loungeFaces.length > 0 && (
            <div className="flex items-center gap-2.5">
              <AvatarStack
                faces={loungeFaces}
                max={5}
                size="xs"
                label="Members who posted recently"
              />
              <p className="min-w-0 truncate font-mono text-[10.5px] tracking-wide text-soft">
                {loungeFaces
                  .slice(0, 3)
                  .map((f) => f.name.split(" ")[0])
                  .join(", ")}{" "}
                have been through today
              </p>
            </div>
          )}
          {/* The Lounge is no longer one undifferentiated room (canvas v2, Club
              Screens 02) — ClubRooms splits it by topic, with REAL 24h talker
              counts and a designed below-floor line per room. */}
          <ClubRooms me={chatMe} tier={tier} />
        </div>
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
  );
}
