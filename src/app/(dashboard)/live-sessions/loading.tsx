/**
 * Route skeleton — board 07's own shape (§0.4 loading ≠ empty).
 *
 * It has to be the SAME shape the page's in-component skeleton draws, or the
 * route transition reflows twice: glyph + display word, the filter pill row, the
 * dark hero island, then board cards. Never the founding state's copy — this
 * promises content is arriving, which is the opposite claim.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6 lg:max-w-3xl"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-sand" />
        <div className="h-9 w-40 animate-pulse rounded-lg bg-sand" />
      </div>
      <div className="mt-5 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 w-28 animate-pulse rounded-[14px] bg-sand/70" />
        ))}
      </div>
      <div className="mt-5 h-52 animate-pulse rounded-2xl bg-sand/70" />
      <div className="mt-6 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="club-b-card flex items-center gap-3 px-3 py-3 motion-safe:animate-pulse"
          >
            <div className="h-[54px] w-[54px] shrink-0 rounded-[10px] bg-ink/10" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded-full bg-ink/10" />
              <div className="h-2.5 w-1/3 rounded-full bg-ink/[0.07]" />
            </div>
            <div className="h-8 w-20 shrink-0 rounded-[10px] bg-ink/10" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading the live schedule</span>
    </div>
  );
}
