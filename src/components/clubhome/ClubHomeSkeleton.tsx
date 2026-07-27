/**
 * CLUB HOME — the streaming shell.
 *
 * This is the Suspense fallback the /dashboard server component streams while
 * the club payload is still being assembled (src/lib/club/home-payload.ts). It
 * exists for exactly one reason: LOADING IS NOT EMPTY. Before the seed landed,
 * the surface rendered every section's FOUNDING branch first — "The board starts
 * with you", "The Club hasn't formed a read yet" — and then swapped to real
 * content. That is the bug the owner reported as "the board says empty first
 * before populating". A skeleton claims nothing, so the founding copy is now
 * reserved for the one case it is true: a club that genuinely has no data.
 *
 * Deliberately DUMB: no "use client", no hooks, no fetches, no timers. A Suspense
 * fallback can be hydrated if the boundary is slow, and anything stateful in here
 * would mount twice (double alert/live-events fetches). It is pure markup that
 * matches the real composition's rhythm — eyebrow, display headline, the peeking
 * carousel, the full-bleed band, the ruled ledger — so the swap to real content
 * is a fill, not a reflow.
 */
export default function ClubHomeSkeleton() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-7 pb-16 lg:max-w-3xl"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading the Club board</span>

      {/* 1 + 2 — greeting + the display headline's footprint */}
      <header>
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-display text-eyebrow font-bold uppercase text-soft">
            Welcome back
          </p>
        </div>
        <div className="mt-4 space-y-2.5 motion-safe:animate-pulse">
          <div className="h-[0.9em] w-[86%] rounded-full bg-ink/10 text-display-1" />
          <div className="h-[0.9em] w-[54%] rounded-full bg-ink/10 text-display-1" />
        </div>
      </header>

      {/* 3 — what the club is seeing: two cards so the peek (the swipe
          affordance) is present before the data arrives, mirroring
          TickerCarousel's own loading branch exactly. */}
      <section>
        <div className="-mx-4 flex gap-3 overflow-hidden px-4 pb-1">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="club2-card f0-grain shrink-0 rounded-[22px] motion-safe:animate-pulse"
              style={{ minHeight: 156, opacity: 1 - i * 0.35 }}
            />
          ))}
        </div>
      </section>

      {/* 4 — the full-bleed action band's footprint */}
      <div className="h-[104px] rounded-[22px] bg-ink/[0.06] motion-safe:animate-pulse" />

      {/* 5 — presence row */}
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 w-8 rounded-full bg-ink/10 motion-safe:animate-pulse"
            />
          ))}
        </div>
        <div className="h-3 w-40 rounded-full bg-ink/10 motion-safe:animate-pulse" />
      </div>

      {/* 6 — the hairline ledger */}
      <div className="border-t border-ink/10">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 border-b border-ink/10 py-3.5"
          >
            <div className="h-3.5 w-16 rounded-full bg-ink/10 motion-safe:animate-pulse" />
            <div className="h-3.5 w-24 rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
