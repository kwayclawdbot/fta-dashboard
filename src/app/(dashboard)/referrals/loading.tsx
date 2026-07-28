/**
 * LOADING ≠ EMPTY. The shape of the referrals surface arriving. The founding
 * state — a link nobody has followed yet — is designed copy inside the page.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
      <div className="h-9 w-64 max-w-full rounded bg-sand/60 motion-safe:animate-pulse" />
      <div className="h-10 w-full max-w-md rounded bg-sand/40 motion-safe:animate-pulse" />
      <div className="club-b-card h-[104px] rounded-[16px] motion-safe:animate-pulse" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="club-b-card h-[52px] flex-1 rounded-[13px] motion-safe:animate-pulse" />
        ))}
      </div>
      <span className="sr-only">Loading your referral link</span>
    </div>
  );
}
