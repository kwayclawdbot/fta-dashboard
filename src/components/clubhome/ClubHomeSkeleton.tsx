/**
 * CLUB HOME — the streaming shell.
 *
 * The Suspense fallback the /dashboard server component streams while the club
 * payload is assembled (src/lib/club/home-payload.ts). It exists for exactly one
 * reason: LOADING IS NOT EMPTY. Before the seed landed, the surface rendered
 * every section's FOUNDING branch first — "the board says empty first, then
 * populates". A skeleton claims nothing, so the founding copy is reserved for
 * the one case where it is true.
 *
 * It traces the mockup board's home rhythm object-for-object — greeting, the
 * brief card, the pulse quote-card strip, the watchlist rows — so the swap to
 * real content is a fill, not a reflow. Every shape here is the shape of the
 * object that lands in it.
 *
 * Deliberately DUMB: no "use client", no hooks, no fetches, no timers. A
 * Suspense fallback can be hydrated if the boundary is slow, and anything
 * stateful here would mount twice. It is pure markup.
 */
export default function ClubHomeSkeleton() {
  return (
    <div
      className="mx-auto max-w-2xl pb-16 lg:max-w-3xl"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading the Club board</span>

      {/* 1 — greeting */}
      <header>
        <div className="h-[28px] w-56 max-w-full rounded-lg bg-ink/10 motion-safe:animate-pulse" />
        <div className="mt-2.5 h-3 w-44 max-w-full rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
      </header>

      {/* 2 — KAI MORNING BRIEF: the contained card */}
      <div className="mt-[18px] rounded-[16px] border border-sand bg-card px-4 pb-4 pt-[14px]">
        <div className="flex items-center gap-2.5">
          <div className="h-2.5 w-32 rounded-full bg-ink/10 motion-safe:animate-pulse" />
          <div className="h-2 w-12 rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
        </div>
        <div className="mt-4 space-y-3">
          <div className="h-2.5 w-[88%] rounded-full bg-ink/10 motion-safe:animate-pulse" />
          <div className="h-2.5 w-[72%] rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
          <div className="h-2.5 w-[80%] rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
          <div className="h-2.5 w-[56%] rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
        </div>
        <div className="mt-4 h-2.5 w-48 max-w-full rounded-full bg-ink/10 motion-safe:animate-pulse" />
      </div>

      {/* 3 — MARKET PULSE: label + the quote-card strip */}
      <section className="mt-[26px]">
        <div className="h-3 w-28 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        <div className="mt-3 flex gap-2.5 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-[118px] flex-none rounded-[14px] border border-sand bg-card p-3 motion-safe:animate-pulse"
            >
              <div className="flex items-center gap-2">
                <div className="h-[28px] w-[28px] shrink-0 rounded-[8px] bg-ink/10" />
                <div className="h-2.5 w-10 rounded-full bg-ink/10" />
              </div>
              <div className="mt-3 h-3.5 w-16 rounded-full bg-ink/10" />
              <div className="mt-2.5 h-2.5 w-12 rounded-full bg-ink/[0.07]" />
            </div>
          ))}
        </div>
      </section>

      {/* 4 — MY WATCHLIST MOVERS: label + quiet rows */}
      <section className="mt-[26px]">
        <div className="h-3 w-40 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        <div className="mt-3 space-y-[7px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-[12px] bg-card px-3 py-[11px] motion-safe:animate-pulse"
            >
              <div className="h-[30px] w-[30px] shrink-0 rounded-[9px] bg-ink/10" />
              <div className="h-2.5 w-14 rounded-full bg-ink/10" />
              <div className="h-2.5 flex-1 rounded-full bg-ink/[0.07]" />
              <div className="h-2.5 w-10 shrink-0 rounded-full bg-ink/10" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
