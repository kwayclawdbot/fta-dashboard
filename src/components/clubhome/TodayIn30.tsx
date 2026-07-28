"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { BriefResponse } from "@/lib/clubhome/contract";
import IndexChips from "./IndexChips";

/**
 * TODAY IN 30 SECONDS — board 01's digest, built as drawn.
 *
 * The board draws a peach-tinted card: a 14.5px uppercase title, ONE line of
 * summary under it, a 36px circular orange button on the right, and a row of
 * three index chips along the bottom. An earlier pass rendered this as a tall
 * editorial field with an eyebrow, a display heading, a Kai mark, a stacked
 * ledger of four lines and a text link. This is the card.
 *
 * THE ROUND BUTTON. The board's glyph is a play triangle. There is no audio
 * digest in this app and there is no plan for one on this surface, so a play
 * triangle would promise a thing that does not exist. The affordance the board
 * drew — a single round orange button, top-right, taking you deeper into the
 * read — ships with an arrow instead. Same object, honest glyph.
 *
 * THE SUMMARY LINE is the Kai brief's lead item, verbatim. Three states, all
 * distinct: loading shimmers inside the real card; `available:false` renders the
 * preserved unavailable line; no items at all renders the founding line.
 *
 * COLOUR LAW: the card is brand-tinted, so nothing on the tint carries a price
 * EXCEPT the index chips, which sit in their own wells with their own hairline
 * — the board draws them that way, and they are the one place on this surface a
 * market number belongs.
 *
 * KID: the caller strips sentiment items before they reach here (ClubHomeV2), so
 * no bull/bear read can arrive on this surface.
 */
export default function TodayIn30({
  brief,
  loading = false,
}: {
  brief?: BriefResponse | null;
  /** LOADING ≠ EMPTY — see the header. */
  loading?: boolean;
}) {
  const items = brief?.items ?? [];
  const available = brief?.available ?? true;
  const derived = brief?.source === "derived";
  const lead = items[0] ?? null;

  return (
    <section
      className="club-b-warm f0-grain px-[15px] py-[14px]"
      aria-labelledby="club-today"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2
            id="club-today"
            className="text-[14.5px] font-bold uppercase leading-[1.3] text-ink"
          >
            Today in 30 seconds
          </h2>

          {loading ? (
            <div className="mt-[6px] space-y-2" aria-busy="true">
              <div className="h-2.5 w-[88%] max-w-[220px] rounded-full bg-ink/10 motion-safe:animate-pulse" />
              <div className="h-2.5 w-[56%] max-w-[220px] rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
              <span className="sr-only">Loading today&apos;s read</span>
            </div>
          ) : !available ? (
            <p className="mt-1 max-w-[240px] text-[12px] font-medium leading-snug text-soft">
              Kai is temporarily unavailable — here&apos;s what the Club&apos;s
              activity shows.
            </p>
          ) : lead ? (
            <p className="mt-1 max-w-[240px] text-[12px] font-medium leading-snug text-soft">
              {lead.ticker && (
                <span className="mr-1 font-mono font-bold text-ink">
                  ${lead.ticker}
                </span>
              )}
              {lead.text}
            </p>
          ) : (
            <p className="mt-1 max-w-[240px] text-[12px] font-medium leading-snug text-soft">
              Your brief fills in as the Club moves — check back once a little
              more activity lands.
            </p>
          )}
        </div>

        <Link
          href="/kai"
          aria-label="Open the full read with Kai"
          className="club-b-orb f0-focus f0-press h-9 w-9 shrink-0"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <IndexChips />

      {derived && (
        <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.12em] text-soft">
          derived from Club activity
        </p>
      )}
    </section>
  );
}
