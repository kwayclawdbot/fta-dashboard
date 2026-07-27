/** Route skeleton — the missions ledger's own shape (§0.4 loading ≠ empty). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8" aria-busy="true">
      <div>
        <div className="h-3 w-24 animate-pulse rounded bg-sand" />
        <div className="mt-3 h-11 w-64 animate-pulse rounded bg-sand" />
        <div className="mt-4 h-4 w-full max-w-sm animate-pulse rounded bg-sand/60" />
      </div>
      <div className="flex items-stretch gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 space-y-2">
            <div className="h-8 w-16 animate-pulse rounded bg-sand/60" />
            <div className="h-3 w-20 animate-pulse rounded bg-sand/40" />
          </div>
        ))}
      </div>
      <div className="f0-ledger border-t border-sand/70">
        {[0, 1, 2].map((i) => (
          <div key={i} className="f0-ledger-row">
            <div className="h-[52px] w-[52px] shrink-0 animate-pulse rounded-full bg-sand/60" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/2 animate-pulse rounded bg-sand/60" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-sand/40" />
            </div>
            <div className="h-6 w-10 shrink-0 animate-pulse rounded bg-sand/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
