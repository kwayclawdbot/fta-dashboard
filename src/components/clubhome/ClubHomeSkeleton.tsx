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
 * It matches CANVAS BOARD 01's rhythm one-for-one — greeting, display headline,
 * the ranked tile strip, the brief field, the signals ledger, the board ledger,
 * the belt strip — so the swap to real content is a fill, not a reflow. The
 * brief field is drawn here as well as in TodayIn30's own loading state, because
 * the two boundaries can be in flight at the same time and the shell must not
 * leave a hole where the field will land.
 *
 * Deliberately DUMB: no "use client", no hooks, no fetches, no timers. A Suspense
 * fallback can be hydrated if the boundary is slow, and anything stateful in here
 * would mount twice (double alert/live-events fetches). It is pure markup.
 */
export default function ClubHomeSkeleton() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-7 pb-16 lg:max-w-3xl"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading the Club board</span>

      {/* 1 — greeting + the display headline's footprint */}
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
        <div className="mt-3 h-3 w-52 max-w-full rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
      </header>

      {/* 2 — TOP IN THE CLUB: the ranked tile strip. Five tiles so the strip's
          density (the thing that replaced the carousel) is present before the
          data arrives, mirroring TickerTile's own loading branch. */}
      <section>
        <div className="h-3 w-28 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        <div className="mt-3 flex gap-2.5 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="shrink-0" style={{ width: 58 }}>
              <div
                className="f0-tile-field motion-safe:animate-pulse"
                style={{ height: 58, borderRadius: 12 }}
              />
              <div className="mx-auto mt-1.5 h-2 w-8 rounded-full bg-ink/10 motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      </section>

      {/* 3 — TODAY IN 30 SECONDS: the brand-tinted field's footprint */}
      <div className="f0-brief-field px-5 py-5">
        <div className="h-2.5 w-20 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        <div className="mt-3 h-6 w-[62%] rounded-full bg-ink/10 motion-safe:animate-pulse" />
        <div className="mt-4 space-y-2.5">
          <div className="h-3.5 w-[88%] rounded-full bg-ink/10 motion-safe:animate-pulse" />
          <div className="h-3.5 w-[64%] rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
        </div>
      </div>

      {/* 5 — YOUR SIGNALS (4 is the escalation band, which is absent by default) */}
      <section>
        <div className="h-3 w-24 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        <div className="mt-3 border-t border-ink/10">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3.5 border-b border-ink/10 py-3.5"
            >
              <div className="h-11 w-11 shrink-0 rounded-[10px] bg-ink/10 motion-safe:animate-pulse" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-16 rounded-full bg-ink/10 motion-safe:animate-pulse" />
                <div className="h-3 w-40 max-w-full rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
              </div>
              <div className="h-3.5 w-14 shrink-0 rounded-full bg-ink/10 motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      </section>

      {/* 6 — presence row */}
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

      {/* 7 — the hairline ledger */}
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

      {/* 8 — the primary action's footprint */}
      <div className="h-[56px] rounded-full bg-ink/[0.06] motion-safe:animate-pulse" />
    </div>
  );
}
