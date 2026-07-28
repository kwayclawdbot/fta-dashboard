/**
 * Route shell for /chart. Paints the board's identity row, the mark, the
 * control CARD and the try strip that are known ahead of time, so only the
 * market reads and the chart pane are pending. LOADING, not EMPTY: every
 * pending slot is a pulsing measure, never a dash — a dash would claim the
 * data is absent. Geometry mirrors page.tsx exactly so the swap is a fill,
 * not a reflow.
 */
export default function ChartLoading() {
  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl flex-col">
      <header>
        <div className="h-2.5 w-20 animate-pulse rounded bg-sand" />

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-[11px] bg-sand" />
            <div>
              <div className="h-5 w-48 animate-pulse rounded bg-sand" />
              <div className="mt-1.5 h-2.5 w-28 animate-pulse rounded bg-sand/70" />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="ml-auto h-7 w-32 animate-pulse rounded bg-sand" />
            <div className="ml-auto mt-1.5 h-3 w-24 animate-pulse rounded bg-sand/70" />
          </div>
        </div>

        <p className="mt-3 max-w-[52ch] text-[13.5px] leading-relaxed text-soft">
          Practice reading charts — this is learning, not financial advice.
        </p>
      </header>

      <div className="mt-4 flex items-center justify-between gap-6 rounded-[16px] border border-sand bg-card px-4 py-3 shadow-soft">
        <div className="h-4 w-40 animate-pulse rounded bg-sand" />
        <div className="flex gap-1.5">
          <div className="h-6 w-14 animate-pulse rounded-lg bg-sand" />
          <div className="h-6 w-20 animate-pulse rounded-lg bg-sand" />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-2.5 w-6 shrink-0 animate-pulse rounded bg-sand" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 w-11 shrink-0 animate-pulse rounded-[10px] bg-sand" />
        ))}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[18px] border border-sand shadow-soft">
        <div className="flex h-full items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
        </div>
      </div>
    </div>
  );
}
