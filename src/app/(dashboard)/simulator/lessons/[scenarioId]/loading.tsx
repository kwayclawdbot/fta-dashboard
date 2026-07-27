/**
 * Route shell for one pattern. The canvas micro-lesson progress header and the
 * asymmetric canvas/rail layout are known ahead of time, so only the pattern
 * copy and the generated tape are pending.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <div className="h-2.5 w-24 shrink-0 animate-pulse rounded bg-sand" />
        <div className="h-1.5 min-w-0 flex-1 animate-pulse rounded-full bg-sand" />
        <div className="h-2.5 w-10 shrink-0 animate-pulse rounded bg-sand" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-4">
          <div>
            <div className="h-2.5 w-40 animate-pulse rounded bg-sand" />
            <div className="mt-3 h-7 w-64 animate-pulse rounded bg-sand" />
            <div className="mt-3 h-3 w-full max-w-lg animate-pulse rounded bg-sand/70" />
          </div>
          <div className="chart-frame h-[380px] w-full animate-pulse" />
        </div>

        <div className="min-w-0 space-y-3">
          <div className="h-2.5 w-32 animate-pulse rounded bg-sand" />
          <div className="h-3 w-full animate-pulse rounded bg-sand/70" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-sand/70" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-sand" />
        </div>
      </div>
    </div>
  );
}
