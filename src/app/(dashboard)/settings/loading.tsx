/**
 * LOADING ≠ EMPTY. The shape of the settings cards arriving — never an empty
 * form that reads as "you have no settings".
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
      <div className="h-9 w-40 rounded bg-sand/60 motion-safe:animate-pulse" />
      <div className="h-8 w-full max-w-md rounded bg-sand/40 motion-safe:animate-pulse" />
      <div className="club-b-card h-[220px] rounded-[16px] motion-safe:animate-pulse" />
      <div className="club-b-card h-[96px] rounded-[16px] motion-safe:animate-pulse" />
      <div className="club-b-card h-[180px] rounded-[16px] motion-safe:animate-pulse" />
      <span className="sr-only">Loading your settings</span>
    </div>
  );
}
