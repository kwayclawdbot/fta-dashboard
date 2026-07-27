/**
 * Route shell for /chart. Paints the canvas identity row, the mark, and the two
 * ruled control bands that are known ahead of time, so only the market reads and
 * the chart pane are pending. LOADING, not EMPTY: every pending slot is a
 * pulsing measure, never a dash — a dash would claim the data is absent.
 */
export default function ChartLoading() {
  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl flex-col">
      <header>
        <div className="h-2.5 w-20 animate-pulse rounded bg-sand" />

        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-sand" />
            <div>
              <div className="h-6 w-48 animate-pulse rounded bg-sand" />
              <div className="mt-2 h-2.5 w-28 animate-pulse rounded bg-sand/70" />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="ml-auto h-7 w-32 animate-pulse rounded bg-sand" />
            <div className="ml-auto mt-2 h-3 w-24 animate-pulse rounded bg-sand/70" />
          </div>
        </div>

        <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-soft">
          Practice reading charts — this is learning, not financial advice.
        </p>
      </header>

      <div className="f0-rule-top mt-5">
        <div className="flex items-center justify-between gap-6 py-3">
          <div className="h-2.5 w-32 animate-pulse rounded bg-sand" />
          <div className="h-2.5 w-24 animate-pulse rounded bg-sand" />
        </div>
      </div>

      <div className="f0-rule-top">
        <div className="flex items-center gap-3 py-3">
          <div className="h-2.5 w-8 shrink-0 animate-pulse rounded bg-sand" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 w-11 shrink-0 animate-pulse rounded-[10px] bg-sand" />
          ))}
        </div>
      </div>

      <div className="f0-frame mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl">
        <div className="flex h-full items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
        </div>
      </div>
    </div>
  );
}
