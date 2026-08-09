"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";

import type { BriefResponse } from "@/lib/clubhome/contract";
import IndexChips from "./IndexChips";

/**
 * KAI MORNING BRIEF — the CCDoors brief card.
 *
 * A contained card (16px radius, sand hairline, card ground) with three bands:
 *
 *   HEADER — drawn ON the card (the reference board fills no header band): a
 *   small Kai-tinted sparkle tile, the uppercase title in Kai's own colour
 *   and, right-aligned, the brief's own timestamp in mono. The stamp is
 *   formatted AFTER mount so the server never guesses the member's timezone.
 *
 *   BODY — the brief's items as bullet rows, verbatim from the Kai brief.
 *   Three states stay distinct: loading shimmers inside the real card,
 *   `available:false` renders the preserved unavailable line, and zero items
 *   renders the founding line. The index chips close the body — the one place
 *   on this card a market number belongs.
 *
 *   FOOTER CTA — "{n} things need your attention →" into /alerts (the Kai
 *   tab board — chat lives on the FAB, not behind this line).
 *
 * KID: the caller strips sentiment items before they reach here (ClubHomeV2),
 * so no bull/bear read can arrive on this surface.
 */
// A store that never changes: hydration is a one-way, render-time fact.
const subscribeNever = () => () => {};

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

  // The header's time — only formatted on the CLIENT, so server HTML never
  // carries a timezone guess. The store trick makes hydration exact: the
  // server snapshot says "not yet", the client snapshot says "now", and the
  // stamp appears without a setState-in-effect cascade.
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  const updatedAt = brief?.updatedAt ?? null;
  let stamp: string | null = null;
  if (hydrated && updatedAt) {
    const d = new Date(updatedAt);
    if (!Number.isNaN(d.getTime())) {
      stamp = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
  }

  const n = items.length;

  return (
    <section
      className="overflow-hidden rounded-[16px] border border-sand bg-card"
      aria-labelledby="club-today"
    >
      {/* header row — ON the card, in Kai's own colour, never the brand accent
          (the reference board writes "KAI MORNING BRIEF · 8:15 AM" straight on
          the card ground, no filled band) */}
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <span
          className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px]"
          style={{ background: "var(--kai-blue-soft)", color: "var(--kai-blue)" }}
          aria-hidden
        >
          <Sparkles className="h-3 w-3" />
        </span>
        <h2
          id="club-today"
          className="min-w-0 flex-1 truncate font-display text-[11px] font-bold uppercase leading-none tracking-[0.14em]"
          style={{ color: "var(--kai-blue)" }}
        >
          Kai morning brief
        </h2>
        {stamp && (
          <span className="shrink-0 font-mono text-[11px] leading-none text-soft">
            {stamp}
          </span>
        )}
      </div>

      <div className="px-4 pb-4 pt-3">
        {loading ? (
          <div className="space-y-2.5" aria-busy="true">
            <div className="h-2.5 w-[88%] rounded-full bg-ink/10 motion-safe:animate-pulse" />
            <div className="h-2.5 w-[72%] rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
            <div className="h-2.5 w-[56%] rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
            <span className="sr-only">Loading today&apos;s brief</span>
          </div>
        ) : !available ? (
          <p className="text-[12px] font-medium leading-snug text-soft">
            Kai is temporarily unavailable — here&apos;s what the Club&apos;s
            activity shows.
          </p>
        ) : n > 0 ? (
          <ul className="space-y-[11px]">
            {items.map((it, i) => (
              <li
                key={`${it.ticker ?? ""}-${i}`}
                className="flex items-start gap-[10px] text-[12.5px] leading-snug text-ink"
              >
                <span className="shrink-0 text-soft" aria-hidden>
                  •
                </span>
                <span className="min-w-0">
                  {it.ticker && (
                    <span className="mr-1 font-mono font-bold">
                      ${it.ticker}
                    </span>
                  )}
                  {it.text}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] font-medium leading-snug text-soft">
            Your brief fills in as the Club moves — check back once a little
            more activity lands.
          </p>
        )}

        {!loading && available && n > 0 && (
          <Link
            href="/alerts"
            className="f0-focus f0-press mt-3.5 inline-block rounded-md text-[12.5px] font-semibold"
            style={{ color: "var(--kai-blue)" }}
          >
            {n} thing{n === 1 ? "" : "s"} need{n === 1 ? "s" : ""} your
            attention →
          </Link>
        )}

        <IndexChips />

        {derived && (
          <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.12em] text-soft">
            derived from Club activity
          </p>
        )}
      </div>
    </section>
  );
}
