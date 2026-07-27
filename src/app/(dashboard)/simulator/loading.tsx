/**
 * Route shell for the Trading Floor. Paints the practice tab rail, the obsidian
 * portfolio field and the asymmetric chart/ticket layout that are known ahead of
 * time — the shared DashboardSkeleton's "chart" variant is a two-column card
 * grid, the pattern the register retired.
 *
 * LOADING, not EMPTY: every pending slot pulses. The founding states (an empty
 * equity curve, no open positions) live in the page itself and must never be
 * mistaken for this.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-24">
      <div className="flex gap-6 border-b border-sand pb-3 sm:gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-3 w-28 animate-pulse rounded bg-sand" />
        ))}
      </div>

      <div>
        <div className="h-2.5 w-20 animate-pulse rounded bg-sand" />
        <div className="mt-3 h-8 w-64 animate-pulse rounded bg-sand" />
        <div className="mt-3 h-3 w-80 animate-pulse rounded bg-sand/70" />
      </div>

      <div className="f0-hero-field h-44 w-full animate-pulse" />

      <div>
        <div className="h-2.5 w-24 animate-pulse rounded bg-sand" />
        <div className="mt-3 h-[116px] w-full animate-pulse rounded-lg bg-sand/60" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0 space-y-4">
          <div className="flex gap-6 border-b border-sand pb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-2.5 w-12 animate-pulse rounded bg-sand" />
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 w-9 animate-pulse rounded-full bg-sand" />
            ))}
          </div>
          <div className="chart-frame h-[420px] w-full animate-pulse" />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="h-2.5 w-24 animate-pulse rounded bg-sand" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-sand/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
