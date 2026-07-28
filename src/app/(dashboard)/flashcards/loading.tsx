/** Route skeleton — the picker's own shape (§0.4 loading ≠ empty). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-8 pb-16" aria-busy="true">
      <div className="space-y-3">
        <div className="h-3 w-32 rounded bg-sand/60" />
        <div className="h-11 w-56 rounded bg-sand/60" />
        <div className="h-4 w-full max-w-sm rounded bg-sand/40" />
      </div>
      <div className="club-b-warm h-44" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="club-b-card flex items-center gap-4 px-4 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-sand/60" />
              <div className="h-3 w-3/4 rounded bg-sand/40" />
            </div>
            <div className="h-4 w-16 shrink-0 rounded bg-sand/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
