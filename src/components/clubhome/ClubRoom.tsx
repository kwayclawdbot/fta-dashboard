"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { CollectiveResponse, PeopleResponse } from "@/lib/clubhome/contract";

/**
 * THE ROOM — one compact strip carrying two more of the sections Home computed
 * and discarded: `collective` (how many members, how much they did today) and
 * `people` (members worth following).
 *
 * It is deliberately ONE LINE, not a section. The board's own removal note is
 * still right — a big avatar grid belongs to the Club screen, not to Home — but
 * "you are not the only one here" is worth a line on a surface a solo member
 * opens every morning, and it costs nothing: both reads already happen.
 *
 * FLOOR-GATED. `collective.floorMet` is the server's verdict on whether the
 * numbers are big enough to state; below it we say the honest founding thing
 * ("the room is still small") instead of printing "2 members · 3 actions". The
 * faces are consented adult avatars only (the core filters kids out), and the
 * strip renders at most four of them.
 *
 * ABSENT MEANS ABSENT: no collective read and no people read → no strip.
 */
export default function ClubRoom({
  collective,
  people,
  isKid = false,
}: {
  collective?: CollectiveResponse | null;
  people?: PeopleResponse | null;
  isKid?: boolean;
}) {
  const faces = (collective?.avatars ?? []).filter((a) => a.url).slice(0, 4);
  const minds = collective?.connectedMinds ?? 0;
  const actions = collective?.actionsToday ?? 0;
  const floorMet = !!collective?.floorMet;
  const suggested = (people?.members ?? [])[0] ?? null;

  if (!collective && !suggested) return null;

  const line = !collective
    ? null
    : floorMet
      ? `${minds.toLocaleString()} member${minds === 1 ? "" : "s"} · ${actions.toLocaleString()} thing${
          actions === 1 ? "" : "s"
        } done today`
      : "The room is still small — early members shape it.";

  return (
    <Link
      href="/community"
      className="club-b-card f0-focus f0-press flex items-center gap-2.5 px-3 py-[10px]"
    >
      {faces.length > 0 ? (
        <span className="flex shrink-0 -space-x-1.5" aria-hidden>
          {faces.map((a) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={a.id}
              src={a.url as string}
              alt=""
              className="h-[22px] w-[22px] rounded-full border border-card object-cover"
            />
          ))}
        </span>
      ) : (
        <span
          className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] font-mono text-[10px] font-bold text-accent"
          style={{ background: "color-mix(in srgb, var(--accent-solid) 13%, transparent)" }}
          aria-hidden
        >
          {minds > 0 ? minds : "·"}
        </span>
      )}
      <span className="min-w-0 flex-1">
        {line && (
          <span className="block truncate text-[12px] font-semibold text-ink">{line}</span>
        )}
        {suggested && !isKid && (
          <span className="block truncate text-[11px] text-soft">
            {suggested.name} — {suggested.reason}
          </span>
        )}
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-soft" aria-hidden />
    </Link>
  );
}
