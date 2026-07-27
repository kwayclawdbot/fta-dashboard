/**
 * Route shell for /chart. Paints the masthead and the ruled control band that
 * are known ahead of time, so only the chart pane is pending. (The shared
 * DashboardSkeleton's "chart" variant is a two-column card grid — the pattern
 * the register retired.)
 */
export default function ChartLoading() {
  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl flex-col">
      <header>
        <div className="h-2.5 w-20 animate-pulse rounded bg-sand" />
        <h1 className="mt-2.5 font-display text-display-2 font-extrabold uppercase text-ink">
          Practice Chart
        </h1>
        <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-soft">
          Practice reading charts — this is learning, not financial advice.
        </p>
      </header>

      <div className="f0-rule-top mt-6">
        <div className="flex items-center gap-6 py-3">
          <div className="h-2.5 w-24 animate-pulse rounded bg-sand" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-sand" />
        </div>
      </div>
      <div className="f0-rule-top">
        <div className="flex items-center gap-5 py-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-2.5 w-10 animate-pulse rounded bg-sand" />
          ))}
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl border border-sand">
        <div className="flex h-full items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
        </div>
      </div>
    </div>
  );
}
