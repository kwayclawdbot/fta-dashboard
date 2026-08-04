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
      <header className="mb-5">
        <h1 className="font-display text-[26px] font-extrabold lowercase tracking-[-0.03em] text-ink">
          club index
        </h1>
        <p className="mt-1 text-[13px] text-soft">
          Where the room stands, ranked by conviction
        </p>
      </header>

      <ClubIndex />
    </div>
  );
}
