/** Route skeleton — masthead, setup trail, then the six-step ledger (§0.4). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl pb-14" aria-busy="true">
      <div className="h-3 w-24 animate-pulse rounded bg-sand" />
      <div className="mt-3 h-11 w-80 animate-pulse rounded bg-sand" />
      <div className="mt-4 h-4 w-full max-w-lg animate-pulse rounded bg-sand/60" />
      <div className="mt-2 h-4 w-full max-w-md animate-pulse rounded bg-sand/40" />
      <div className="mt-9 h-24 animate-pulse rounded-2xl bg-sand/40" />
      <div className="f0-ledger mt-10 border-t border-sand/70">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="f0-ledger-row py-5">
            <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-sand/60" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/2 animate-pulse rounded bg-sand/60" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-sand/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
