/**
 * /kai loading — the shape of the surface, not a generic spinner: a hairline
 * conversation rail, the ruled header with Kai's identity mark, the dark Kai
 * field where the empty state lands, and the ruled composer.
 *
 * LOADING ≠ EMPTY: every slot pulses. The founding state of a member who has
 * never asked Kai anything is a DESIGNED screen with real copy in it, and this
 * must never be mistaken for it.
 *
 * COLOUR LAW: the only blue here is Kai's own mark and the send key.
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
          <span
            className="f0-kai-mark motion-safe:animate-pulse"
            style={{ width: 30, height: 30 }}
            aria-hidden
          />
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
                <div key={i} className="h-8 w-44 animate-pulse rounded-lg bg-sand/70" />
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
