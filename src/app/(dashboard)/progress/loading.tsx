/**
 * LOADING ≠ EMPTY. The route-level fallback is the SHAPE of board 07 arriving —
 * the ringed avatar, the dial, the two-card measure row, the five tiles and the
 * warm streak card — not any of the surface's founding states, which are
 * designed copy inside ProfileSurface and only render once a read has answered.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-16" aria-busy="true">
      <div className="h-9 w-24 rounded bg-sand/60 motion-safe:animate-pulse" />
      <div className="flex items-center gap-4 pt-2">
        <div className="h-[92px] w-[92px] shrink-0 rounded-full bg-sand/60 motion-safe:animate-pulse" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="h-6 w-40 rounded bg-sand/60 motion-safe:animate-pulse" />
          <div className="h-3.5 w-28 rounded bg-sand/50 motion-safe:animate-pulse" />
          <div className="h-3 w-36 rounded bg-sand/40 motion-safe:animate-pulse" />
        </div>
        <div className="h-16 w-16 shrink-0 rounded-full bg-sand/60 motion-safe:animate-pulse" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="club-b-card h-[104px] rounded-[16px] motion-safe:animate-pulse sm:flex-1" />
        <div className="club-b-card h-[104px] rounded-[16px] motion-safe:animate-pulse sm:flex-[1.5]" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="club-b-card h-[52px] min-w-[64px] flex-1 rounded-[13px] motion-safe:animate-pulse"
          />
        ))}
      </div>
      <div className="club-b-card h-[68px] rounded-[16px] motion-safe:animate-pulse" />
      <span className="sr-only">Loading your profile</span>
    </div>
  );
}
