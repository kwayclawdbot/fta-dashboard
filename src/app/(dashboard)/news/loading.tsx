import { Newspaper } from "lucide-react";

export default function NewsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-24 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-chip-sky text-ink">
          <Newspaper className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Club Newsroom</h1>
          <p className="text-xs text-soft">The market, explained for the whole family.</p>
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-sand bg-card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-4 w-20 animate-pulse rounded-full bg-sand" />
              <div className="h-3 w-12 animate-pulse rounded bg-sand" />
            </div>
            <div className="h-5 w-3/4 animate-pulse rounded bg-sand" />
            <div className="mt-2 h-4 w-full animate-pulse rounded bg-sand/70" />
            <div className="mt-3 flex gap-1.5">
              <div className="h-5 w-12 animate-pulse rounded bg-sand" />
              <div className="h-5 w-12 animate-pulse rounded bg-sand" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
