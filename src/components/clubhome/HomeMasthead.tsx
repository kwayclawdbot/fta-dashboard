"use client";

import { useSyncExternalStore } from "react";
import type { TrendingResponse } from "@/lib/clubhome/contract";

/**
 * HOME MASTHEAD — the greeting line + the one oversized display voice on the
 * surface.
 *
 * Two objects only, no container:
 *   1. a tracked uppercase eyebrow (greeting left, dateline right) — the
 *      quietest type on the screen, so the headline can be the loudest.
 *   2. ONE `text-display-1` headline with a single volt accent word carrying a
 *      hand-drawn underline (SVG stroke, slightly rotated so it reads drawn
 *      rather than ruled).
 *
 * The headline is DATA-LED: it names the ticker actually leading the club board.
 * With no ranked board yet it says so — founding-era copy, never a placeholder
 * ticker and never a fabricated number.
 *
 * Owner rule: no "gm". The greeting is written out in full.
 *
 * Hydration: the greeting + dateline depend on the viewer's clock, so they are
 * resolved AFTER mount (server and first client render agree on the neutral
 * "Welcome back" state, then the real greeting swaps in).
 */

/* The accent word + its underline share ONE themed colour: the span sets the
   colour and the SVG stroke reads `currentColor`, so the drawn line can never
   drift from the word it underlines.
   WHY gold-600 AND NOT volt-600: in club mode the gold ramp IS volt orange, and
   it is the THEMED one — --g600 is #E85400 in light (pixel-identical to
   volt-600) and lifts to #FF8A47 in club-dark so orange keeps its presence on
   obsidian. `volt-*` is the frozen ramp and would stay #E85400 at night. Orange
   never softens; it just moves along its own ramp, which is the mechanism the
   foundation already uses for active nav text. */
function Accent({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block whitespace-nowrap text-gold-600">
      {children}
      {/* hand-drawn underline: uneven bezier, slight rotation, round caps */}
      <svg
        className="pointer-events-none absolute -bottom-[0.06em] left-[-2%] h-[0.26em] w-[104%] -rotate-[1.1deg]"
        viewBox="0 0 200 12"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden
      >
        <path
          d="M3 8.6C36 3.9 71 3.1 104 5.4c31 2.2 60 4.6 93 -1.6"
          stroke="currentColor"
          strokeWidth="3.6"
          strokeLinecap="round"
          opacity="0.9"
        />
      </svg>
    </span>
  );
}

/* Mounted gate — the greeting reads the viewer's clock, which the server can't
   know. useSyncExternalStore gives a deterministic `false` on the server and the
   first client render, then `true`, so the swap is a normal re-render rather
   than a hydration mismatch. */
const NEVER_CHANGES = () => () => {};
const ON_CLIENT = () => true;
const ON_SERVER = () => false;

function clockFor(firstName?: string): { greeting: string; date: string } {
  const now = new Date();
  const h = now.getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const name = (firstName || "").trim();
  return {
    greeting: name ? `${part}, ${name}` : part,
    date: now.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
  };
}

export default function HomeMasthead({
  firstName,
  trending,
}: {
  firstName?: string;
  trending?: TrendingResponse | null;
}) {
  const mounted = useSyncExternalStore(NEVER_CHANGES, ON_CLIENT, ON_SERVER);
  const clock = mounted ? clockFor(firstName) : null;

  const lead = trending?.rows?.[0]?.ticker?.trim().toUpperCase() || null;

  return (
    <header className="f0-stagger">
      <div
        className="flex items-baseline justify-between gap-4"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        <p className="font-display text-eyebrow font-bold uppercase text-soft">
          {clock?.greeting ?? "Welcome back"}
        </p>
        {clock && (
          <p className="shrink-0 font-mono text-eyebrow uppercase text-soft">{clock.date}</p>
        )}
      </div>

      <h1
        className="mt-3.5 font-display text-display-1 font-black text-ink"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        {lead ? (
          <>
            The board leads with <Accent>${lead}</Accent>
          </>
        ) : (
          <>
            The board starts with <Accent>you</Accent>
          </>
        )}
      </h1>
    </header>
  );
}
