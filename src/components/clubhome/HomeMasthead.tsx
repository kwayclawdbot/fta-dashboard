"use client";

import { useLocalHour } from "./clock";

/**
 * HOME MASTHEAD — board 01, the two lines at the top of the screen.
 *
 * The board draws a WARM PERSONAL GREETING, not a market headline: 26px/700
 * "GM, Marcus 👋" with a 13px sub-line, "Here's what the Club is seeing". An
 * earlier pass replaced it with a 44px data-led headline naming the leading
 * ticker; that is a different object with a different job and the owner
 * rejected it. This is the drawn one.
 *
 * The greeting register is the board's — short and spoken, "GM" in the morning
 * rather than "Good morning" — and it stays consistent across the day rather
 * than mixing an abbreviation with a full phrase.
 *
 * PURITY: the local hour arrives from the hour-bucketed external store, so
 * nothing here reads a clock during render. Before the store primes (the server
 * render and the first client render) there is no hour, and the greeting falls
 * back to the neutral, always-true form rather than guessing one.
 */

function greetingFor(hour: number | null, name: string): string {
  const who = name ? `, ${name}` : "";
  if (hour == null) return `Welcome back${who}`;
  if (hour < 12) return `GM${who}`;
  if (hour < 17) return `Afternoon${who}`;
  return `Evening${who}`;
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
      <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">
        {greetingFor(hour, name)} <span aria-hidden>👋</span>
      </h1>
      <p className="mt-1.5 text-[13px] leading-snug text-soft">
        {isKid
          ? "Here's what the Club is looking at"
          : "Here's what the Club is seeing"}
      </p>
    </header>
  );
}
