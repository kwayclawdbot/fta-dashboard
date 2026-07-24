export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-sand" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-40 animate-pulse rounded bg-sand" />
          <div className="h-4 w-full max-w-md animate-pulse rounded bg-sand/70" />
        </div>
      </div>
      <div className="mb-4 flex gap-4 border-b border-sand pb-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-5 w-16 animate-pulse rounded bg-sand" />
        ))}
      </div>
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-sand bg-paper p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-sand" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-sand" />
                <div className="h-3 w-40 animate-pulse rounded bg-sand/70" />
              </div>
              <div className="h-5 w-12 animate-pulse rounded bg-sand" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
