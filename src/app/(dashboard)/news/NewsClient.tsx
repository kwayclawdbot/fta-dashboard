"use client";

/**
 * /news — the Club Newsroom front page (canvas rebuild B).
 *
 * REGISTER: editorial. A masthead, a section bar, then a ruled column of
 * stories. No card grid, no boxed rows — an entry is type on paper separated
 * from the next entry by a hairline, which is what a front page has always
 * been and what the brand register asks for.
 *
 * COLOUR LAW: the newsroom carries no price, no sentiment and no Kai, so the
 * only accent on this surface is brand orange on the active section and on
 * headline hover — via `gold-*`, which is volt orange in club mode and flips
 * for dark (the `volt-*` ramp is frozen and goes murky at night).
 *
 * DATA: every story on this page is a real generated article. There is no
 * fixture path — an empty feed says so in words.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { m, AnimatePresence } from "@/lib/motion";
import { Search } from "lucide-react";
import { TickerTile, TickerTileStrip } from "@/components/canvas2";
import { createClient } from "@/lib/supabase/client";
import { fetchQuotes, type MarketQuote } from "@/lib/market/client";
import { fetchNewsFeed } from "@/lib/news/client";
import { AI_GENERATED_TAG, KIND_META, type NewsCardData, type NewsKind } from "@/lib/news/types";
import NewsEntry from "@/components/news/NewsCard";
import { useNewMemberHints, HintDismiss } from "@/components/hints/useNewMemberHints";

type KindKey = NewsKind | "all";

const KIND_TABS: { key: KindKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "market_wrap", label: KIND_META.market_wrap.label },
  { key: "ticker_event", label: KIND_META.ticker_event.label },
];

export default function NewsClient({
  initialArticles = null,
  embedded = false,
}: {
  initialArticles?: NewsCardData[] | null;
  /**
   * Rendered inside another surface (Discover's newsroom section) rather than
   * as the /news route.
   *
   * DEFECT THIS FIXES: Discover mounted this component whole, so a `display-1`
   * "NEWSROOM" masthead — the loudest type in the system, and the marker for
   * "you are on the newsroom" — appeared halfway down Discover, directly under
   * Discover's own `News moving the Club` section rule. Two mastheads, one
   * page. Embedded now drops the masthead, the route's own page box, and the
   * ticker strip (Discover already carries two ticker strips of its own),
   * leaving exactly what the host asked for: the desk bar and the column.
   */
  embedded?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [articles, setArticles] = useState<NewsCardData[]>(initialArticles ?? []);
  const [loading, setLoading] = useState(initialArticles == null);
  const [kind, setKind] = useState<KindKey>("all");
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

  /* ── IN THE NEWS TODAY ───────────────────────────────────────────────────
     Canvas v2's ticker-tile strip, applied to the desk that had no board of
     its own: the names the current stories are actually about, ordered by how
     many stories mention each. Every ticker here comes off a real published
     article, and the delta comes off the same batched quote endpoint the rest
     of the app uses — a name whose quote is unavailable renders "—" on its own
     tile rather than a fabricated 0.00%. Each tile is a link into that
     company's research page — the newsroom's fastest route from "I read about
     this" to "show me the company". */
  const deskTickers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) {
      for (const t of a.tickers) {
        const k = t.toUpperCase();
        if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([t]) => t);
  }, [articles]);

  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  useEffect(() => {
    if (deskTickers.length === 0) return;
    const ctrl = new AbortController();
    fetchQuotes(deskTickers, ctrl.signal).then(setQuotes).catch(() => {});
    return () => ctrl.abort();
  }, [deskTickers]);

  return (
    <div className={embedded ? "" : "mx-auto max-w-3xl px-4 pb-24 sm:px-6"}>
      {/* ── MASTHEAD ──────────────────────────────────────────────────────── */}
      {!embedded && (
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
      )}

      {/* ── IN THE NEWS TODAY ─────────────────────────────────────────────── */}
      {/* LOADING ≠ EMPTY: in flight the strip pulses filled tiles; with no
          stories filed it renders dashed slots and says so in the column
          below, rather than collapsing to nothing. */}
      {!embedded && (
        <section className="mt-8" aria-labelledby="news-desk-strip">
          <h2
            id="news-desk-strip"
            className="f0-section-rule font-display text-eyebrow font-bold uppercase text-ink"
          >
            <span className="shrink-0 whitespace-nowrap">In the news today</span>
          </h2>
          {loading ? (
            <TickerTileStrip className="mt-4" loading loadingCount={7} size="sm" />
          ) : (
            <TickerTileStrip className="mt-4" minSlots={7} size="sm">
              {deskTickers.map((t) => (
                <TickerTile
                  key={t}
                  ticker={t}
                  size="sm"
                  changePct={quotes[t]?.changePercent ?? null}
                  href={`/research/${encodeURIComponent(t)}`}
                />
              ))}
            </TickerTileStrip>
          )}
        </section>
      )}

      {/* ── SECTION BAR ───────────────────────────────────────────────────── */}
      {/* The desks on the left, the ticker filter on the right — one strip of
          controls bounded by rules, the newspaper's section index. */}
      <div className={`f0-rule-top ${embedded ? "" : "mt-8"}`}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
          <div role="tablist" aria-label="News categories" className="flex flex-wrap gap-x-6">
            {KIND_TABS.map((t) => {
              const on = kind === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setKind(t.key)}
                  className={`f0-focus f0-press relative py-1 font-display text-eyebrow font-bold uppercase transition-colors ${
                    on ? "text-ink" : "text-soft hover:text-ink"
                  }`}
                >
                  {t.label}
                  {/* Canvas v2 L0 geometry. These are real tabs over a story
                      column, so the semantics stay tablist/tab rather than
                      SegmentedRail's radiogroup — but the indicator is the
                      shared .f0-seg-bar, on `bg-accent` so the desk marker is
                      the same object here as on Discover's rail. */}
                  {on && <span aria-hidden className="f0-seg-bar bg-accent" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <label className="group flex items-center gap-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-soft" />
              <span className="sr-only">Filter stories by ticker</span>
              <input
                value={tickerFilter}
                onChange={(e) => setTickerFilter(e.target.value)}
                placeholder="Filter $TICKER"
                className="f0-focus w-32 rounded bg-transparent font-mono text-[12px] uppercase tracking-[0.06em] text-ink outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-soft/70 focus:w-40"
              />
            </label>
            <button
              type="button"
              onClick={() => setExplainerOpen((v) => !v)}
              aria-expanded={explainerOpen}
              className="f0-focus rounded font-display text-eyebrow font-bold uppercase text-soft transition-colors hover:text-gold-700"
            >
              What is this?
            </button>
          </div>
        </div>
      </div>
      <div className="f0-rule-top" />

      {/* ── HOUSE NOTE ────────────────────────────────────────────────────── */}
      {/* Editorial policy, stated in the paper's own voice. Copy unchanged. */}
      <AnimatePresence initial={false}>
        {explainerOpen && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-3 border-l-2 border-accent py-4 pl-4">
              <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-soft">
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

      {/* ── THE COLUMN ────────────────────────────────────────────────────── */}
      {loading ? (
        <NewsSkeleton />
      ) : shown.length === 0 ? (
        <div className="f0-rule-left mt-10 py-1 pl-4">
          <p className="font-display text-display-3 font-extrabold text-ink">
            Nothing filed yet
          </p>
          <p className="mt-1.5 max-w-[52ch] text-[15px] leading-relaxed text-soft">
            {tickerFilter
              ? "No stories tagged with that ticker yet."
              : "The newsroom updates before the open and after the close on market days."}
          </p>
        </div>
      ) : (
        <div className="f0-ledger mt-2">
          {shown.map((a, i) => (
            <NewsEntry key={a.slug} article={a} lead={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

export function NewsSkeleton() {
  return (
    <div className="f0-ledger mt-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="py-6 first:pt-1">
          <div className="h-2.5 w-28 animate-pulse rounded bg-sand" />
          <div className="mt-3 h-6 w-4/5 animate-pulse rounded bg-sand" />
          <div className="mt-2.5 h-4 w-full max-w-[46ch] animate-pulse rounded bg-sand/70" />
          <div className="mt-3 flex gap-3">
            <div className="h-3 w-12 animate-pulse rounded bg-sand" />
            <div className="h-3 w-12 animate-pulse rounded bg-sand" />
          </div>
        </div>
      ))}
    </div>
  );
}
