/**
 * Route shell for Simbot. The tab rail, masthead and the framed embed slot are
 * known ahead of time — the frame's own "Warming up Simbot…" overlay takes over
 * once the page mounts, so the two never both claim to be loading.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex gap-6 border-b border-sand pb-3 sm:gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-3 w-28 animate-pulse rounded bg-sand" />
        ))}
      </div>

      <div>
        <div className="h-2.5 w-20 animate-pulse rounded bg-sand" />
        <div className="mt-3 h-8 w-44 animate-pulse rounded bg-sand" />
        <div className="mt-3 h-3 w-80 max-w-full animate-pulse rounded bg-sand/70" />
      </div>

      <div
        className="f0-frame w-full animate-pulse rounded-xl bg-sand/40"
        style={{ height: "calc(100vh - 190px)", minHeight: 520 }}
      />
    </div>
  );
}
