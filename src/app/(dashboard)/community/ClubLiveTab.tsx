"use client";

import { useEffect, useRef } from "react";
import { Radio, CalendarClock, History } from "lucide-react";
import { EditorialSection } from "@/components/grammar";
import { LiveEventCard } from "@/components/live";
import type { LiveEvent } from "@/lib/clubhome/live-events";

/**
 * The Club · Live — the room list. One infrastructure, three states: what's on
 * the air now, what's scheduled, and recent replays. Built from the grammar:
 * editorial section framing on the sand canvas, live_event ObjectCards for the
 * rooms themselves. Empty until real rooms run (GET /api/live degrades to []),
 * so it degrades to a calm founding state, never a fabricated room.
 *
 * `focusId` is the go-live deep-link target (/club?live={id} → /community?mode=
 * live&live={id}): the matching room scrolls into view and pulses briefly.
 */
export default function ClubLiveTab({
  events,
  focusId = null,
}: {
  events: LiveEvent[];
  focusId?: string | null;
}) {
  const live = events.filter((e) => e.status === "live" || e.status === "starting_soon");
  const scheduled = events.filter((e) => e.status === "scheduled");
  const replays = events.filter((e) => e.status === "replay_ready" || e.status === "ended");

  const focusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focusId) return;
    const el = focusRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-volt-500", "ring-offset-2", "ring-offset-paper", "rounded-2xl");
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-volt-500", "ring-offset-2", "ring-offset-paper");
    }, 2600);
    return () => clearTimeout(t);
  }, [focusId, events.length]);

  // Wrap the deep-link target so it can be scrolled to / highlighted.
  const renderCard = (e: LiveEvent) =>
    e.id === focusId ? (
      <div key={e.id} ref={focusRef} className="transition-shadow">
        <LiveEventCard event={e} />
      </div>
    ) : (
      <LiveEventCard key={e.id} event={e} />
    );

  if (events.length === 0) {
    return (
      <div className="py-16 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-volt-500/12 text-volt-600">
          <Radio className="h-7 w-7" />
        </span>
        <h3 className="mt-4 font-display text-[22px] font-bold tracking-tight text-ink">
          No rooms live right now
        </h3>
        <p className="mx-auto mt-1.5 max-w-sm text-base leading-relaxed text-soft">
          Live rooms — market walk-throughs, classes, and audio hangs — show up here
          the moment a host opens one. The first ones drop with the challenge.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {live.length > 0 && (
        <EditorialSection title="On the air">
          <div className="grid gap-4 sm:grid-cols-2">
            {live.map(renderCard)}
          </div>
        </EditorialSection>
      )}
      {scheduled.length > 0 && (
        <EditorialSection
          title="Coming up"
          lead="Rooms on the schedule — tap Remind Me and we'll ping you at start."
          divide={live.length > 0}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {scheduled.map(renderCard)}
          </div>
        </EditorialSection>
      )}
      {replays.length > 0 && (
        <EditorialSection
          title="Recent replays"
          lead="Every room becomes a recap — covered tickers, key takeaways, watch again."
          divide={live.length > 0 || scheduled.length > 0}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {replays.map(renderCard)}
          </div>
        </EditorialSection>
      )}
      {live.length === 0 && (
        <p className="flex items-center justify-center gap-2 pt-2 text-sm text-soft">
          <CalendarClock className="h-4 w-4" />
          Nothing on the air this second — check <History className="h-4 w-4" /> replays above.
        </p>
      )}
    </div>
  );
}
