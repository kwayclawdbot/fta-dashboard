"use client";

import type { CollectiveResponse } from "@/lib/clubhome/contract";
import { useKaiSheet } from "@/components/kai/KaiSheetProvider";

/**
 * KAI'S READ — the collective read as a full-width Kai-blue band, rendered
 * between the attention section and the market pulse strip. Kai blue means Kai
 * (colour law), so the band rides --kai-blue / --kai-blue-soft, never the
 * brand accent. The CTA opens the contextual Kai sheet with the read as
 * prefilled context. Absent collective → no band.
 *
 * (The people-worth-following line that used to share this file was removed
 * with the doors recomposition — the prototype does not draw it on Home.)
 *
 * FLOOR-GATED: `collective.floorMet` is the server's verdict on whether the
 * numbers are big enough to state; below it the band says the honest founding
 * thing instead of printing "2 members · 3 actions".
 */

function roomLine(collective?: CollectiveResponse | null): string | null {
  if (!collective) return null;
  const minds = collective.connectedMinds ?? 0;
  const actions = collective.actionsToday ?? 0;
  return collective.floorMet
    ? `${minds.toLocaleString()} member${minds === 1 ? "" : "s"} · ${actions.toLocaleString()} thing${
        actions === 1 ? "" : "s"
      } done today`
    : "The room is still small — early members shape it.";
}

export function KaiReadBand({
  collective,
  isKid = false,
}: {
  collective?: CollectiveResponse | null;
  isKid?: boolean;
}) {
  const { openKai } = useKaiSheet();
  const line = roomLine(collective);
  if (!line) return null;

  return (
    <section
      className="border-y border-sand px-5 py-[22px]"
      style={{ background: "var(--kai-blue-soft)" }}
      aria-label="Kai's read"
    >
      <p
        className="font-display text-[11px] font-bold uppercase tracking-[0.16em]"
        style={{ color: "var(--kai-blue)" }}
      >
        Kai&apos;s read
      </p>
      <p className="mt-[11px] text-[14px] leading-[1.55] text-ink">{line}</p>
      {!isKid && (
        <button
          type="button"
          onClick={() =>
            openKai({
              chip: "Club read",
              query: line.length > 140 ? `${line.slice(0, 140)}…` : line,
            })
          }
          className="f0-focus f0-press mt-[10px] rounded-md text-[12.5px] font-semibold"
          style={{ color: "var(--kai-blue)" }}
        >
          Ask Kai about this →
        </button>
      )}
    </section>
  );
}
