"use client";

import { useLocalHour } from "./clock";

/**
 * HOME MASTHEAD — CCDoors greeting, two lines.
 *
 * Line 1 is the time-aware personal greeting ("Good morning, Marcus! 👋") in
 * the display face; line 2 is the CCDoors tagline ("Let's crush the market
 * today."). Kid register keeps its existing kid-safe sub-line.
 *
 * PURITY: the local hour arrives from the hour-bucketed external store, so
 * nothing here reads a clock during render. Before the store primes (the server
 * render and the first client render) there is no hour, and the greeting falls
 * back to the neutral, always-true form rather than guessing one.
 */

function greetingFor(hour: number | null, name: string): string {
  const who = name ? `, ${name}` : "";
  if (hour == null) return `Welcome back${who}!`;
  if (hour < 12) return `Good morning${who}!`;
  if (hour < 17) return `Good afternoon${who}!`;
  return `Good evening${who}!`;
}

export default function HomeMasthead({
  firstName,
  isKid = false,
}: {
  firstName?: string;
  isKid?: boolean;
}) {
  const hour = useLocalHour();
  const name = (firstName || "").trim();

  return (
    <header>
      {/* the board's greeting: large white display line, cool-gray sub */}
      <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
        {greetingFor(hour, name)} <span aria-hidden>👋</span>
      </h1>
      <p className="mt-[6px] text-[14px] leading-snug text-soft">
        {isKid
          ? "Here's what the Club is looking at"
          : "Let's crush the market today."}
      </p>
    </header>
  );
}
