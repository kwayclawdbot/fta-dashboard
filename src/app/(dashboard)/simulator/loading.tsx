/**
 * Route shell for the Trading Floor. Paints the practice PILL rail, the
 * obsidian portfolio field, its four measure cards, the equity card and the
 * asymmetric chart/ticket layout that are known ahead of time. Geometry mirrors
 * page.tsx so the swap is a fill, not a reflow.
 *
 * LOADING, not EMPTY: every pending slot pulses. The founding states (an empty
 * equity curve, no open positions) live in the page itself and must never be
 * mistaken for this.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-24">
      <div className="flex gap-1.5 py-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-7 w-32 animate-pulse rounded-full bg-sand" />
        ))}
      </div>

      <div>
        <div className="h-2.5 w-20 animate-pulse rounded bg-sand" />
        <div className="mt-3 h-8 w-64 animate-pulse rounded bg-sand" />
        <div className="mt-3 h-3 w-80 animate-pulse rounded bg-sand/70" />
      </div>

      <div>
        <div className="f0-hero-field h-44 w-full animate-pulse" />
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 flex-1 animate-pulse rounded-xl border border-sand bg-card"
            />
          ))}
        </div>
        <div className="mt-3 h-[188px] w-full animate-pulse rounded-[16px] border border-sand bg-card" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0 space-y-4">
          <div className="flex gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 w-14 animate-pulse rounded-lg bg-sand" />
            ))}
          </div>
          <div className="h-[72px] w-full animate-pulse rounded-[16px] border border-sand bg-card" />
          <div className="chart-frame h-[420px] w-full animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="h-[340px] w-full animate-pulse rounded-[16px] border border-sand bg-card" />
        </div>
      </div>
    </div>
  );
}
