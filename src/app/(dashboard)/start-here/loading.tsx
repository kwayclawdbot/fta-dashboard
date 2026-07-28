/**
 * Route skeleton — masthead, the warm "next step" object, then the six step
 * cards. LOADING ≠ EMPTY: it keeps the real layout so the fill is a swap, not a
 * reflow, and it never renders a stated absence for data still in flight.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl pb-14" aria-busy="true">
      <div className="h-3 w-24 animate-pulse rounded bg-sand" />
      <div className="mt-3 h-11 w-80 max-w-full animate-pulse rounded bg-sand" />
      <div className="mt-4 h-4 w-full max-w-lg animate-pulse rounded bg-sand/60" />
      <div className="mt-2 h-4 w-full max-w-md animate-pulse rounded bg-sand/40" />

      <div className="club-b-warm mt-8 px-[15px] py-[15px]">
        <div className="flex items-start gap-3.5 motion-safe:animate-pulse">
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="h-2.5 w-28 rounded-full bg-ink/10" />
            <div className="h-4 w-1/2 rounded bg-ink/10" />
            <div className="h-3 w-3/4 rounded bg-ink/[0.07]" />
          </div>
          <div className="h-10 w-10 shrink-0 rounded-full bg-ink/10" />
        </div>
        <div className="mt-3.5 h-1.5 w-full rounded-full bg-ink/10 motion-safe:animate-pulse" />
      </div>

      <div className="mt-10 h-2.5 w-24 animate-pulse rounded bg-sand" />
      <div className="mt-3.5 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="club-b-card px-4 py-4 motion-safe:animate-pulse">
            <div className="h-4 w-1/2 rounded bg-sand/70" />
            <div className="mt-2.5 h-3 w-full rounded bg-sand/50" />
            <div className="mt-2 h-3 w-2/3 rounded bg-sand/40" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading your setup steps</span>
    </div>
  );
}
