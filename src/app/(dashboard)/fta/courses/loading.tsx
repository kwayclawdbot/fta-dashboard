/** Route skeleton — shaped like the cards the page becomes (§0.4). */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl pb-16" aria-busy="true">
      <div className="metal-gold h-[3px] w-full rounded-full opacity-40" />
      <div className="mt-5 h-3 w-44 animate-pulse rounded bg-sand" />
      <div className="mt-3 h-11 w-72 animate-pulse rounded bg-sand" />
      <div className="mt-7 h-8 w-full animate-pulse rounded bg-sand/50" />

      <div className="mt-9 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="club-b-card px-3 py-3 text-center">
            <div className="mx-auto h-[22px] w-12 animate-pulse rounded-full bg-sand/60" />
            <div className="mx-auto mt-2 h-2 w-14 animate-pulse rounded-full bg-sand/40" />
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="club-b-card flex items-start gap-3 px-4 py-4">
            <div className="h-[34px] w-[34px] shrink-0 animate-pulse rounded-[10px] bg-sand/60" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="h-4 w-1/2 animate-pulse rounded bg-sand/60" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-sand/40" />
              <div className="h-1.5 w-24 animate-pulse rounded-full bg-sand/50" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
