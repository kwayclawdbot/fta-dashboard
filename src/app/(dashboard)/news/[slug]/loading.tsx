export default function NewsArticleLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 pb-24 sm:px-6">
      <div className="h-4 w-24 animate-pulse rounded bg-sand" />
      <div className="space-y-2">
        <div className="h-4 w-20 animate-pulse rounded-full bg-sand" />
        <div className="h-8 w-4/5 animate-pulse rounded bg-sand" />
        <div className="h-5 w-full animate-pulse rounded bg-sand/70" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-sand/60" />
        ))}
      </div>
    </div>
  );
}
