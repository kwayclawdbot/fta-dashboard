/** Route skeleton — masthead, the record card, the reps (§0.4 loading ≠ empty). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8" aria-busy="true">
      <div>
        <div className="h-3 w-28 animate-pulse rounded bg-sand" />
        <div className="mt-3 h-11 w-72 animate-pulse rounded bg-sand" />
        <div className="mt-4 h-4 w-full max-w-md animate-pulse rounded bg-sand/60" />
      </div>
      <div className="club-b-warm px-5 py-5">
        <div className="h-2.5 w-28 animate-pulse rounded-full bg-ink/10" />
        <div className="mt-3 h-8 w-16 animate-pulse rounded bg-ink/10" />
        <div className="mt-3 h-3 w-32 animate-pulse rounded bg-ink/10" />
      </div>
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="club-b-card flex items-start gap-4 px-4 py-4">
            <div className="h-[52px] w-[52px] shrink-0 animate-pulse rounded-[12px] bg-sand/60" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-5 w-1/2 animate-pulse rounded bg-sand/60" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-sand/40" />
              <div className="h-3 w-20 animate-pulse rounded bg-sand/40" />
            </div>
            <div className="h-6 w-14 shrink-0 animate-pulse rounded bg-sand/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
