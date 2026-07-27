/** Route skeleton — masthead, tab rail, then the chat well (§0.4). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-16" aria-busy="true">
      <div className="h-3 w-20 animate-pulse rounded bg-sand" />
      <div className="mt-3 h-11 w-72 animate-pulse rounded bg-sand" />
      <div className="mt-4 h-4 w-full max-w-sm animate-pulse rounded bg-sand/60" />
      <div className="mt-9 h-8 w-full animate-pulse rounded bg-sand/50" />
      <div className="mt-8 space-y-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-sand/60" />
            <div className="h-16 w-full max-w-[52ch] animate-pulse rounded-2xl bg-sand/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
