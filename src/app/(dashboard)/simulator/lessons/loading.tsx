/**
 * Route shell for Pattern Practice. The tab rail, masthead, progress meter and
 * two ruled ledgers are known ahead of time, so only the member's record is
 * pending. LOADING, not EMPTY — the "you haven't cleared a pattern yet"
 * founding line lives in the page and must not be confused with this.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24">
      <div className="flex gap-6 border-b border-sand pb-3 sm:gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-3 w-28 animate-pulse rounded bg-sand" />
        ))}
      </div>

      <div>
        <div className="h-2.5 w-20 animate-pulse rounded bg-sand" />
        <div className="mt-3 h-8 w-72 animate-pulse rounded bg-sand" />
        <div className="mt-3 h-3 w-96 max-w-full animate-pulse rounded bg-sand/70" />
        <div className="mt-5 flex max-w-sm items-center gap-3">
          <div className="h-1.5 flex-1 animate-pulse rounded-full bg-sand" />
          <div className="h-2.5 w-24 animate-pulse rounded bg-sand" />
        </div>
      </div>

      {[0, 1].map((section) => (
        <div key={section}>
          <div className="h-2.5 w-40 animate-pulse rounded bg-sand" />
          <div className="f0-ledger mt-2">
            {Array.from({ length: section === 0 ? 6 : 4 }).map((_, i) => (
              <div key={i} className="f0-ledger-row">
                <div className="min-w-0 flex-1">
                  <div className="h-3.5 w-44 animate-pulse rounded bg-sand" />
                  <div className="mt-2 h-2.5 w-full max-w-md animate-pulse rounded bg-sand/70" />
                </div>
                <div className="h-2.5 w-14 shrink-0 animate-pulse rounded bg-sand" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
