import type { Metadata } from "next";
import ClubIndex from "@/components/club/ClubIndex";

/**
 * /club-index — a dedicated home for the Club's community-insight surface.
 *
 * The Club Index also appears at the top of Discover's For-You view; this route
 * gives it a stable, linkable home of its own. The surface itself is the
 * self-contained <ClubIndex /> client component, which reads the canonical
 * `ticker_intel_snapshots` rollup via /api/club/index and degrades to a founding
 * empty state below the scale floor. Nothing is fetched here on the server, so
 * the page shell is trivial.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Club Index",
  description: "Where the Club stands — ranked by conviction.",
};

export default function ClubIndexPage() {
  return (
    <div className="mx-auto max-w-2xl pb-16 lg:max-w-3xl">
      {/* CLUB TERMINAL masthead (.planning/CLUB-TERMINAL-STYLE.md,
          2026-08-09): caps, the loudest type on the screen — the lowercase
          wordmark head was the family register on a club surface. The ledger
          below is the ratified <ClubIndex /> object, untouched. */}
      <header className="mb-6">
        <h1 className="font-display text-[clamp(28px,8vw,34px)] font-black uppercase leading-[0.9] tracking-[-0.04em] text-ink">
          Club Index
        </h1>
        <p className="mt-2.5 max-w-[52ch] text-[13px] leading-relaxed text-soft">
          Where the room stands, ranked by conviction
        </p>
      </header>

      <ClubIndex />
    </div>
  );
}
