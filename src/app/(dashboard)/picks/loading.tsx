/**
 * /picks is retired — page.tsx (and [id]/page.tsx) redirect to the Community
 * Watchlist, which absorbed Team Picks. This shell only ever shows for the
 * instant of that redirect.
 *
 * It is deliberately NOT a skeleton: a skeleton is a promise that content is
 * arriving on THIS route, and nothing ever will. It is a redirect notice in the
 * canvas register — charged rule, eyebrow, display line — so a member landing on
 * a stale bookmark reads a sentence rather than watching grey rectangles for a
 * board that no longer exists.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="border-l-2 border-accent py-1 pl-4">
        <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
          Team Picks has moved
        </p>
        <p className="mt-2 max-w-[46ch] font-display text-display-3 font-extrabold text-ink">
          It&apos;s the Community Watchlist now.
        </p>
        <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-soft">
          One communal board the whole Club builds together — taking you there…
        </p>
      </div>
    </div>
  );
}
