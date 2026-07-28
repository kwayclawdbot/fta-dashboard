/** Route skeleton — shaped like the shelf cards it becomes (§0.4). */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl pb-16" aria-busy="true">
      <div className="metal-gold h-[3px] w-full rounded-full opacity-40" />
      <div className="mt-5 h-3 w-44 animate-pulse rounded bg-sand" />
      <div className="mt-3 h-11 w-72 animate-pulse rounded bg-sand" />
      <div className="mt-7 h-8 w-full animate-pulse rounded bg-sand/50" />
      <div className="mt-9 h-3 w-56 animate-pulse rounded-full bg-sand/50" />
      <div className="mt-8 flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="club-b-card flex items-start gap-3 px-4 py-4">
            <div className="h-[34px] w-[34px] shrink-0 animate-pulse rounded-[10px] bg-sand/60" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-sand/60" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-sand/40" />
              <div className="h-3 w-24 animate-pulse rounded-full bg-sand/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
