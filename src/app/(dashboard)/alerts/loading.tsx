/**
 * /alerts route skeleton — canvas boards 06/18.
 *
 * LOADING ≠ EMPTY. It mirrors the real composition (wordmark, pill rail, the
 * Kai identity card, the accent "getting close" card with its ring, then alert
 * cards) and every block pulses, which is the one thing the designed founding
 * state never does. A skeleton that pulses cannot be mistaken for a real card
 * that happens to be blank.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6" aria-busy="true">
      <span className="sr-only">Loading Kai Watch…</span>

      {/* wordmark */}
      <div className="h-9 w-40 animate-pulse rounded-md bg-sand" />

      {/* pill rail */}
      <div className="mt-4 flex gap-3.5">
        <div className="h-7 w-24 animate-pulse rounded-full bg-sand" />
        <div className="h-7 w-20 animate-pulse rounded-full bg-sand/70" />
        <div className="h-7 w-20 animate-pulse rounded-full bg-sand/70" />
      </div>

      {/* Kai identity card */}
      <div className="mt-4 flex items-center gap-3 rounded-[16px] border border-sand bg-card px-4 py-3.5">
        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-sand" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-40 animate-pulse rounded-full bg-sand" />
          <div className="h-2.5 w-56 max-w-full animate-pulse rounded-full bg-sand/70" />
        </div>
      </div>

      {/* section pills */}
      <div className="mt-6 flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-sand/70" />
        ))}
      </div>

      {/* nav rows */}
      <div className="mt-6 space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-[13px] border border-sand bg-card px-3.5 py-3"
          >
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-[9px] bg-sand" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-28 animate-pulse rounded-full bg-sand" />
              <div className="h-2.5 w-20 animate-pulse rounded-full bg-sand/70" />
            </div>
          </div>
        ))}
      </div>

      {/* the accent "getting close" card, with its ring */}
      <div
        className="mt-6 rounded-[18px] border px-4 py-4"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent-solid) 15%, var(--card)) 0%, var(--card) 62%)",
          borderColor: "color-mix(in srgb, var(--accent-solid) 32%, var(--sand))",
        }}
      >
        <div className="h-2.5 w-24 animate-pulse rounded-full bg-sand" />
        <div className="mt-3 h-4 w-56 max-w-full animate-pulse rounded-full bg-sand" />
        <div className="mt-4 flex items-center gap-4">
          <div className="h-[84px] w-[84px] shrink-0 animate-pulse rounded-full bg-sand" />
          <div className="min-w-0 flex-1 space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-3 w-full max-w-[16rem] animate-pulse rounded-full bg-sand/80" />
            ))}
          </div>
        </div>
      </div>

      {/* alert cards */}
      <div className="mt-6 space-y-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-[16px] border border-l-[3px] border-sand bg-card px-4 py-3.5"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-20 animate-pulse rounded-[8px] bg-sand" />
              <div className="h-3 w-12 animate-pulse rounded-full bg-sand/70" />
            </div>
            <div className="mt-3 flex items-start gap-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-[10px] bg-sand" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-48 max-w-full animate-pulse rounded-full bg-sand" />
                <div className="h-3 w-full animate-pulse rounded-full bg-sand/70" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
