/**
 * /kai loading — the shape of the rebuilt surface, not a generic spinner: a
 * hairline conversation rail, the ruled header, the dark Kai field where the
 * empty state lands, and the ruled composer.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-5xl gap-0 px-0 sm:gap-7 sm:px-4">
      <div className="hidden w-60 shrink-0 sm:block">
        <div className="h-full border-r border-sand py-4 pr-4">
          <div className="h-2.5 w-28 animate-pulse rounded bg-sand" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 w-full animate-pulse rounded bg-sand/70" />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-sand px-4 py-3.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-kai-500" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-24 animate-pulse rounded bg-sand" />
            <div className="h-2.5 w-56 animate-pulse rounded bg-sand/70" />
          </div>
        </div>

        <div className="flex-1 px-4 py-5">
          <div className="mx-auto max-w-2xl">
            <div className="f0-hero-field h-44 w-full animate-pulse" />
            <div className="mt-6 flex flex-wrap gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-7 w-40 animate-pulse rounded-full bg-sand/70" />
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-sand px-4 py-3.5">
          <div className="mx-auto flex max-w-[65ch] items-end gap-3">
            <div className="h-9 flex-1 animate-pulse rounded border-b border-sand bg-sand/40" />
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-kai-500/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
