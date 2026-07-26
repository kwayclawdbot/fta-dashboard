"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { m, AnimatePresence } from "@/lib/motion";
import { Newspaper, Info, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchNewsFeed } from "@/lib/news/client";
import { AI_GENERATED_TAG, KIND_META, type NewsCardData, type NewsKind } from "@/lib/news/types";
import NewsCard from "@/components/news/NewsCard";
import { useNewMemberHints, HintDismiss } from "@/components/hints/useNewMemberHints";
import Tabs from "@/components/ui/Tabs";

const KIND_TABS: { key: NewsKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "market_wrap", label: KIND_META.market_wrap.label },
  { key: "ticker_event", label: KIND_META.ticker_event.label },
];

export default function NewsClient({
  initialArticles = null,
}: {
  initialArticles?: NewsCardData[] | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [articles, setArticles] = useState<NewsCardData[]>(initialArticles ?? []);
  const [loading, setLoading] = useState(initialArticles == null);
  const [kind, setKind] = useState<NewsKind | "all">("all");
  const [tickerFilter, setTickerFilter] = useState("");
  // Server-first: the initial "all" feed is seeded from the server page, so the
  // first list paints without the skeleton. Skip the very first client fetch for
  // that seeded tab; every kind change (and re-selecting "all") still refreshes.
  const skipFirstLoad = useRef(initialArticles != null);

  const howToHint = useNewMemberHints("newsroom-howto");
  const [explainerOpen, setExplainerOpen] = useState(false);
  useEffect(() => {
    if (howToHint.show) setExplainerOpen(true);
  }, [howToHint.show]);

  const load = useCallback(async () => {
    const rows = await fetchNewsFeed(supabase, {
      kind: kind === "all" ? null : kind,
      limit: 60,
    });
    setArticles(rows);
    setLoading(false);
  }, [supabase, kind]);

  useEffect(() => {
    if (skipFirstLoad.current) {
      skipFirstLoad.current = false;
      return;
    }
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const shown = useMemo(() => {
    const t = tickerFilter.trim().toUpperCase();
    if (!t) return articles;
    return articles.filter((a) => a.tickers.some((k) => k.includes(t)));
  }, [articles, tickerFilter]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pb-24 sm:px-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-chip-sky text-ink">
            <Newspaper className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Club Newsroom</h1>
            <p className="text-xs text-soft">The market, explained for the whole family.</p>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-soft/80">{AI_GENERATED_TAG} · delayed market data</p>
      </div>

      {/* Kind tabs + how-to */}
      <div className="flex items-end justify-between gap-2">
        <Tabs
          ariaLabel="News categories"
          size="sm"
          className="min-w-0 flex-1"
          tabs={KIND_TABS}
          active={kind}
          onSelect={setKind}
        />
        <button
          onClick={() => setExplainerOpen((v) => !v)}
          className="mb-1.5 inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-soft hover:text-ink"
        >
          <Info className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">What is this?</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {explainerOpen && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2 rounded-xl border border-sand bg-paper/60 px-4 py-3">
              <p className="text-[13px] leading-relaxed text-soft">
                The Club Newsroom is written by AI from public market data — a twice-daily{" "}
                <em>Market Wrap</em> plus short <em>Ticker Notes</em> on the day&apos;s biggest movers.
                It narrates what happened and teaches how to read it; it is <strong>not</strong> advice
                and never tells you what to buy. Tap any ticker to open its research page.
              </p>
              <HintDismiss
                onClick={() => {
                  setExplainerOpen(false);
                  howToHint.dismiss();
                }}
              />
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Ticker filter */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" />
        <input
          value={tickerFilter}
          onChange={(e) => setTickerFilter(e.target.value)}
          placeholder="Filter by ticker (e.g. NVDA)…"
          className="w-full rounded-2xl border border-sand bg-paper py-2.5 pl-10 pr-4 text-sm font-medium text-ink outline-none transition focus:border-gold-400"
        />
      </div>

      {/* Feed */}
      {loading ? (
        <NewsSkeleton />
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand bg-paper/60 py-16 text-center">
          <Newspaper className="mx-auto mb-3 h-10 w-10 text-gold-400/60" />
          <h3 className="font-display text-lg font-bold text-ink">Nothing here yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-soft">
            {tickerFilter
              ? "No stories tagged with that ticker yet."
              : "The newsroom updates before the open and after the close on market days."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((a) => (
            <NewsCard key={a.slug} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}

export function NewsSkeleton() {
  return (
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
  );
}
