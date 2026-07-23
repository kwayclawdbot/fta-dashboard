/**
 * Route-level loading for the free-class funnel landing. Matches the funnel's
 * warm-paper full-screen aesthetic (not the dashboard chrome) so navigating in
 * shows a branded shimmer instead of a white flash or an anonymous spinner.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <div className="h-14 border-b border-sand" />
      <div className="flex-1 flex items-center justify-center px-5">
        <div className="w-full max-w-md space-y-5 animate-pulse" aria-hidden="true">
          <div className="h-6 w-40 mx-auto rounded-full bg-sand/50" />
          <div className="h-9 w-4/5 mx-auto rounded-lg bg-sand/50" />
          <div className="h-4 w-2/3 mx-auto rounded-lg bg-sand/40" />
          <div className="h-40 w-full rounded-2xl bg-sand/40" />
          <div className="h-11 w-full rounded-xl bg-sand/50" />
        </div>
      </div>
    </div>
  );
}
