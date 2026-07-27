/** Route skeleton — the class ledger's own shape (§0.4 loading ≠ empty). */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6" aria-busy="true">
      <div className="h-3 w-28 animate-pulse rounded bg-sand" />
      <div className="mt-4 h-11 w-64 animate-pulse rounded bg-sand" />
      <div className="mt-4 h-4 w-full max-w-md animate-pulse rounded bg-sand/60" />
      <div className="mt-9 h-8 w-full animate-pulse rounded bg-sand/50" />
      <div className="f0-ledger mt-6 border-t border-sand/70">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="f0-ledger-row">
            <div className="h-8 w-[4.75rem] shrink-0 animate-pulse rounded bg-sand/60" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-sand/60" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-sand/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
