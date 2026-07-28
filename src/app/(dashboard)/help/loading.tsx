/**
 * Route skeleton — masthead, the two filter pills, then the chat well.
 * LOADING ≠ EMPTY: it keeps the real layout so the fill is a swap, not a reflow.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-16" aria-busy="true">
      <div className="h-3 w-20 animate-pulse rounded bg-sand" />
      <div className="mt-3 h-11 w-72 max-w-full animate-pulse rounded bg-sand" />
      <div className="mt-4 h-4 w-full max-w-sm animate-pulse rounded bg-sand/60" />

      <div className="mt-8 flex gap-2">
        <div className="h-9 w-28 animate-pulse rounded-full bg-sand/60" />
        <div className="h-9 w-28 animate-pulse rounded-full bg-sand/40" />
      </div>

      <div className="mt-6 space-y-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-sand/60" />
            <div className="club-b-card h-16 w-full max-w-[52ch] motion-safe:animate-pulse" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading help</span>
    </div>
  );
}
