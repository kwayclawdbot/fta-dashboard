/** Route skeleton — the HUD, the ask, the island stage (§0.4 loading ≠ empty). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl" aria-busy="true">
      <div className="night-island mb-4 h-[132px] animate-pulse" />
      <div className="club-b-card h-12 animate-pulse" />
      <div className="night-island mt-4 h-64 animate-pulse" />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="club-b-card h-16 animate-pulse" />
        <div className="club-b-card h-16 animate-pulse" />
      </div>
    </div>
  );
}
