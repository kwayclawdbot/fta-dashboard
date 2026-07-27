/** Route skeleton — the game stage (§0.4 loading ≠ empty). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl" aria-busy="true">
      <div className="h-3 w-28 animate-pulse rounded bg-sand" />
      <div className="mt-3 h-9 w-56 animate-pulse rounded bg-sand" />
      <div className="mt-5 h-1 w-full animate-pulse rounded-full bg-sand/60" />
      <div className="mt-6 h-64 animate-pulse rounded-2xl bg-sand/40" />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="h-16 animate-pulse rounded-xl bg-sand/40" />
        <div className="h-16 animate-pulse rounded-xl bg-sand/40" />
      </div>
    </div>
  );
}
