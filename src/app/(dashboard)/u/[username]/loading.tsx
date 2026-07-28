/**
 * LOADING ≠ EMPTY. The shape of Club board 09 arriving — the PROFILE head, the
 * ringed avatar with its XP bar, the badge shelf and the stats card.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
      <div className="h-9 w-44 rounded bg-sand/60 motion-safe:animate-pulse" />
      <div className="flex items-center gap-3.5">
        <div className="h-[78px] w-[78px] shrink-0 rounded-full bg-sand/60 motion-safe:animate-pulse" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="h-6 w-44 rounded bg-sand/60 motion-safe:animate-pulse" />
          <div className="h-3 w-36 rounded bg-sand/40 motion-safe:animate-pulse" />
          <div className="h-1.5 w-full rounded-full bg-sand/60 motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="club-b-card h-[86px] w-[92px] shrink-0 rounded-[13px] motion-safe:animate-pulse" />
        ))}
      </div>
      <div className="club-b-card h-[92px] rounded-[14px] motion-safe:animate-pulse" />
      <span className="sr-only">Loading the profile</span>
    </div>
  );
}
