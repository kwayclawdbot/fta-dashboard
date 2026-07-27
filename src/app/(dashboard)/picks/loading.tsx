/**
 * /picks is retired — page.tsx redirects to the Community Watchlist. This shell
 * only ever shows for the instant of that redirect, so it says where you are
 * going instead of flashing a grid of skeleton cards for a board that no longer
 * exists (and a "Family Picks" title that no longer exists either).
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="text-eyebrow font-display font-bold uppercase text-soft">
        Team Picks has moved
      </p>
      <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-soft">
        Taking you to the Community Watchlist…
      </p>
    </div>
  );
}
