/** Route skeleton — hero field + the reps ledger (§0.4 loading ≠ empty). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8" aria-busy="true">
      <div className="h-48 animate-pulse rounded-2xl bg-sand/40" />
      <div className="f0-ledger border-t border-sand/70">
        {[0, 1].map((i) => (
          <div key={i} className="f0-ledger-row">
            <div className="h-8 w-9 shrink-0 animate-pulse rounded bg-sand/60" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-5 w-1/2 animate-pulse rounded bg-sand/60" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-sand/40" />
            </div>
            <div className="h-6 w-14 shrink-0 animate-pulse rounded bg-sand/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
