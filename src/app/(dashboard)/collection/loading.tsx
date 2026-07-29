import LivingCardSkeleton from "@/components/ownership/LivingCardSkeleton";

/**
 * Route shell for /collection. LOADING, not EMPTY: the header the page always
 * paints (eyebrow · title · lede) and the shelf grid are drawn at their real
 * measures, and only the slots whose VALUES depend on the fetch pulse. Geometry
 * mirrors CollectionClient exactly so the swap is a fill, not a reflow — the
 * same max-w-6xl rail, the same 2/3/4-up grid, the same gaps.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {/* Eyebrow — "Ownership Cards", known ahead of the fetch. */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-pulse rounded bg-sand" />
            <div className="h-2.5 w-32 animate-pulse rounded bg-sand" />
          </div>
          <div className="mt-2 h-8 w-52 animate-pulse rounded-lg bg-sand" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-sand/70" />
        </div>

        {/* The count/value stat card keeps its footprint so the header does
            not jump a row when the real numbers land. */}
        <div className="club-b-card px-4 py-2 text-right">
          <div className="ml-auto h-2.5 w-20 animate-pulse rounded bg-sand" />
          <div className="ml-auto mt-2 h-5 w-16 animate-pulse rounded bg-sand" />
        </div>
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i}>
            <LivingCardSkeleton size="shelf" />
          </li>
        ))}
      </ul>
    </div>
  );
}
