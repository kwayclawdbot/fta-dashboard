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
 * It traces BOARD 01's rhythm object-for-object — greeting, the ranked CARD
 * strip, the warm digest card, three signal card rows, the YOU card — so the
 * swap to real content is a fill, not a reflow. Every shape here is the shape of
 * the object that lands in it.
 *
 * Deliberately DUMB: no "use client", no hooks, no fetches, no timers. A
 * Suspense fallback can be hydrated if the boundary is slow, and anything
 * stateful here would mount twice. It is pure markup.
 */
export default function ClubHomeSkeleton() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-4 pb-16 lg:max-w-3xl"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading the Club board</span>

      {/* 1 — greeting */}
      <header>
        <div className="h-[26px] w-56 max-w-full rounded-lg bg-ink/10 motion-safe:animate-pulse" />
        <div className="mt-2.5 h-3 w-44 max-w-full rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
      </header>

      {/* 2 — TOP IN THE CLUB: five ranked cards */}
      <section>
        <div className="h-2.5 w-28 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        <div className="mt-[3px] h-2 w-52 max-w-full rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
        <div className="mt-[11px] flex gap-[9px] overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="shrink-0" style={{ width: 74 }}>
              <div className="club-b-card py-[9px] text-center motion-safe:animate-pulse">
                <div className="mx-auto mt-[2px] h-[34px] w-[34px] rounded-[10px] bg-ink/10" />
                <div className="mx-auto mt-2 h-2 w-9 rounded-full bg-ink/10" />
                <div className="mx-auto mt-1.5 h-2.5 w-7 rounded-full bg-ink/10" />
                <div className="mx-auto mt-1.5 h-1.5 w-6 rounded-full bg-ink/[0.07]" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 — TODAY IN 30 SECONDS: the warm card */}
      <div className="club-b-warm px-[15px] py-[14px]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-48 max-w-full rounded-full bg-ink/10 motion-safe:animate-pulse" />
            <div className="mt-2.5 h-2.5 w-[88%] max-w-[220px] rounded-full bg-ink/10 motion-safe:animate-pulse" />
            <div className="mt-2 h-2.5 w-[56%] max-w-[220px] rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
          </div>
          <div className="h-9 w-9 shrink-0 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        </div>
        <div className="mt-3 flex gap-[7px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[19px] w-[74px] rounded-md bg-ink/[0.07] motion-safe:animate-pulse"
            />
          ))}
        </div>
      </div>

      {/* 4 — YOUR SIGNALS: three card rows */}
      <section>
        <div className="h-2.5 w-24 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        <div className="mt-2.5 flex flex-col gap-[7px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="club-b-card flex items-center gap-2.5 px-3 py-[10px] motion-safe:animate-pulse"
            >
              <div className="h-[26px] w-[26px] shrink-0 rounded-[8px] bg-ink/10" />
              <div className="h-2.5 w-10 shrink-0 rounded-full bg-ink/10" />
              <div className="h-2.5 flex-1 rounded-full bg-ink/[0.07]" />
              <div className="h-2.5 w-9 shrink-0 rounded-full bg-ink/10" />
            </div>
          ))}
        </div>
      </section>

      {/* 5 — YOU: the warm card with the dial */}
      <div className="club-b-warm flex items-center gap-3 px-[15px] py-[13px]">
        <div className="h-[34px] w-[34px] shrink-0 rounded-[10px] bg-ink/10 motion-safe:animate-pulse" />
        <div className="min-w-0 flex-1">
          <div className="h-2.5 w-28 rounded-full bg-ink/10 motion-safe:animate-pulse" />
          <div className="mt-2 h-2 w-36 max-w-full rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
          <div className="mt-2 h-[5px] w-full rounded-[3px] bg-ink/10 motion-safe:animate-pulse" />
        </div>
        <div className="h-12 w-12 shrink-0 rounded-full bg-ink/10 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
