"use client";

import type { ChallengeCohortCounts } from "@/lib/challenge/types";

/**
 * THE COHORT — the single biggest honesty risk in this lane.
 *
 * The canvas draws `2,847 in`, `+2.8K`, `1,942 cohort mates doing this with you
 * right now`, `638 carry a pre-season badge`. Production is a handful. Every
 * number rendered here is a COUNT OF ROWS from `challenge_cohort_counts()`, and
 * below the floor (50 — the social-proof threshold set in CHALLENGE-FUNNEL-REVIEW
 * P1 item 3) the component renders a DESIGNED founding state instead: a stated,
 * true line about being early, plus whatever avatars genuinely exist.
 *
 * It never interpolates, never rounds up, never shows "+2.8K".
 *
 * LOADING ≠ EMPTY: `counts = null` is the skeleton; `below_floor` is the founding
 * state. They look nothing alike, deliberately.
 */
export default function CohortPresence({
  counts,
  avatars = [],
  /** Copy shown above the floor, e.g. "in your cohort". */
  aboveFloorNoun = "in your cohort",
  /** The founding-state headline. */
  foundingTitle = "The cohort is forming",
  foundingBody = "You are one of the first in. The roster fills through August — the names below are the members already here.",
}: {
  counts: ChallengeCohortCounts | null;
  avatars?: { name: string; url: string | null }[];
  aboveFloorNoun?: string;
  foundingTitle?: string;
  foundingBody?: string;
}) {
  /* ── loading ── */
  if (!counts) {
    return (
      <div aria-busy className="py-1">
        <div className="h-[1em] w-40 rounded-full bg-ink/10 text-display-3 motion-safe:animate-pulse" />
        <div className="mt-2 h-3 w-56 rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
      </div>
    );
  }

  const stack = avatars.slice(0, 7);

  /* ── founding state (below the floor) ── */
  if (counts.below_floor) {
    return (
      <div className="border-l-2 border-sand py-1 pl-4">
        <p className="font-display text-display-3 font-extrabold text-ink">
          {foundingTitle}
        </p>
        <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-soft">
          {foundingBody}
        </p>
        {stack.length > 0 && (
          <div className="mt-3">
            <AvatarStack people={stack} />
          </div>
        )}
      </div>
    );
  }

  /* ── real scale ── */
  return (
    <div className="flex items-center justify-between gap-4">
      <AvatarStack people={stack} />
      <p className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-soft">
        {counts.members.toLocaleString()} {aboveFloorNoun}
      </p>
    </div>
  );
}

function AvatarStack({ people }: { people: { name: string; url: string | null }[] }) {
  if (people.length === 0) return null;
  return (
    <div
      className="f0-stack flex items-center"
      style={{ ["--f0-stack-ring" as string]: "var(--paper)" }}
    >
      {people.map((p) => (
        <span
          key={p.name}
          title={p.name}
          className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-sand font-display text-[11px] font-bold uppercase text-ink"
        >
          {p.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.url} alt="" className="h-full w-full object-cover" />
          ) : (
            (p.name || "?").slice(0, 2)
          )}
        </span>
      ))}
    </div>
  );
}
