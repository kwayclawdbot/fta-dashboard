export default function Loading() {
  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-5xl gap-4 px-4">
      <div className="hidden w-64 shrink-0 sm:block">
        <div className="h-full rounded-2xl border border-sand bg-midnight-900 p-3">
          <div className="mb-3 h-9 w-full animate-pulse rounded-lg bg-sand" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-full animate-pulse rounded-lg bg-paper" />
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-sand px-4 py-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-sand" />
          <div className="space-y-1.5">
            <div className="h-4 w-28 animate-pulse rounded bg-sand" />
            <div className="h-3 w-48 animate-pulse rounded bg-paper" />
          </div>
        </div>
        <div className="flex-1 px-4 py-6">
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="ml-auto h-10 w-2/3 animate-pulse rounded-2xl bg-sand" />
            <div className="h-24 w-4/5 animate-pulse rounded-2xl bg-paper" />
            <div className="ml-auto h-10 w-1/2 animate-pulse rounded-2xl bg-sand" />
          </div>
        </div>
        <div className="border-t border-sand px-4 py-3">
          <div className="h-11 w-full animate-pulse rounded-xl bg-paper" />
        </div>
      </div>
    </div>
  );
}
