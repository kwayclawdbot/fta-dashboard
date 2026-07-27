/**
 * Route shell for /news. The masthead is known at build time, so navigation
 * lands on finished page furniture and only the story column fills in.
 */
import { TickerTileStrip } from "@/components/canvas2";
import { AI_GENERATED_TAG } from "@/lib/news/types";
import { NewsSkeleton } from "./NewsClient";

export default function NewsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <header>
        <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
          Cheat Code Club
        </p>
        <h1 className="mt-3 font-display text-display-1 font-extrabold uppercase text-ink">
          Newsroom
        </h1>
        <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-soft">
          The market, explained for the whole family.
        </p>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-soft opacity-70">
          {AI_GENERATED_TAG} · delayed market data
        </p>
      </header>

      {/* The desk strip is page furniture too — without its placeholder the
          section bar and the whole column jumped 60px the moment the route
          resolved. */}
      <section className="mt-8">
        <h2 className="f0-section-rule font-display text-eyebrow font-bold uppercase text-ink">
          <span className="shrink-0 whitespace-nowrap">In the news today</span>
        </h2>
        <TickerTileStrip className="mt-4" loading loadingCount={7} size="sm" />
      </section>

      <div className="f0-rule-top mt-8">
        <div className="flex items-center gap-6 py-3">
          <div className="h-2.5 w-8 animate-pulse rounded bg-sand" />
          <div className="h-2.5 w-20 animate-pulse rounded bg-sand" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-sand" />
        </div>
      </div>
      <div className="f0-rule-top" />

      <NewsSkeleton />
    </div>
  );
}
