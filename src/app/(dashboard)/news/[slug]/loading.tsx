/** Route shell for an article — the reading measure, ruled, before the prose. */
export default function NewsArticleLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 sm:px-6">
      <div className="h-2.5 w-20 animate-pulse rounded bg-sand" />
      <div className="mt-6 space-y-3">
        <div className="h-2.5 w-28 animate-pulse rounded bg-sand" />
        <div className="h-9 w-4/5 animate-pulse rounded bg-sand" />
        <div className="h-5 w-full max-w-[46ch] animate-pulse rounded bg-sand/70" />
      </div>
      <div className="f0-rule-top mt-7" />
      <div className="mt-7 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-full max-w-[65ch] animate-pulse rounded bg-sand/60" />
        ))}
      </div>
    </div>
  );
}
