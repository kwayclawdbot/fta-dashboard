"use client";

/**
 * /news — the Club Newsroom front page, rebuilt in the mockup's language.
 *
 * The canvas draws no newsroom board, so this surface is composed from the
 * vocabulary boards 01/02/15 DO draw and which every other surface in this lane
 * now speaks: a lowercase masthead with round controls, an orange PILL TAB row,
 * orange mono section marks, a row of 46px company discs (board 02's "black
 * belts are watching" geometry, here carrying the names the day's stories are
 * about), and a column of white story CARDS with one warm feature card at the
 * top.
 *
 * The previous pass drew a hairline broadsheet with no cards and no pills. None
 * of it remains.
 *
 * COLOUR LAW: the newsroom carries no price, no sentiment and no Kai — the only
 * accent is brand orange, via `gold-*`/`--accent-solid`, both mode- and
 * theme-correct.
 *
 * DATA: every story is a real generated article. There is no fixture path — an
 * empty feed says so in words, and LOADING ≠ EMPTY.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { m, AnimatePresence } from "@/lib/motion";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchNewsFeed } from "@/lib/news/client";
import { AI_GENERATED_TAG, KIND_META, type NewsCardData, type NewsKind } from "@/lib/news/types";
import NewsEntry from "@/components/news/NewsCard";
import CompanyLogo from "@/components/fic/CompanyLogo";
import {
  Bone,
  BoardCard,
  BoardHead,
  FoundingLine,
  PillTabs,
  RoundButton,
  SectionMark,
} from "@/components/discover/board";
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
   * Rendered inside another surface (Discover's news section) rather than as
   * the /news route. Drops the masthead, the page box and the desk strip — the
   * host already carries all three — leaving the tab row and the column.
   */
  embedded?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [articles, setArticles] = useState<NewsCardData[]>(initialArticles ?? []);
  const [loading, setLoading] = useState(initialArticles == null);
  const [kind, setKind] = useState<KindKey>("all");
  const [tickerFilter, setTickerFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
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
    // Switching desks refetches; the column must show its skeleton rather than
    // the previous desk's stories while the new ones are in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    load();
  }, [load]);

  const shown = useMemo(() => {
    const t = tickerFilter.trim().toUpperCase();
    if (!t) return articles;
    return articles.filter((a) => a.tickers.some((k) => k.includes(t)));
  }, [articles, tickerFilter]);

  /* ── IN THE NEWS TODAY ───────────────────────────────────────────────────
     Board 02's 46px disc row, given to the desk that had no board of its own:
     the names the current stories are actually about, ordered by how many
     stories mention each. Every ticker comes off a real published article, and
     each disc is the fastest route from "I read about this" to "show me the
     company". No price sits on this row, so nothing here can be a stale mark. */
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
      .slice(0, 10)
      .map(([t, n]) => ({ ticker: t, stories: n }));
  }, [articles]);

  return (
    <div className={embedded ? "" : "mx-auto max-w-2xl px-4 pb-24 sm:px-6 lg:max-w-3xl"}>
      {/* ── MASTHEAD ──────────────────────────────────────────────────────── */}
      {!embedded && (
        <header>
          <BoardHead
            title="news"
            sub="The market, explained for the whole family"
            right={
              <>
                <RoundButton
                  label={filterOpen ? "Close ticker filter" : "Filter stories by ticker"}
                  active={filterOpen}
                  onClick={() => setFilterOpen((v) => !v)}
                >
                  {filterOpen ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Search className="h-[15px] w-[15px]" />
                  )}
                </RoundButton>
                <RoundButton
                  label="What is the Club Newsroom?"
                  active={explainerOpen}
                  onClick={() => setExplainerOpen((v) => !v)}
                >
                  <span aria-hidden className="text-[13px] font-bold leading-none">
                    ?
                  </span>
                </RoundButton>
              </>
            }
          />
          <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft">
            {AI_GENERATED_TAG} · delayed market data
          </p>
        </header>
      )}

      {/* ── THE DESK TABS ─────────────────────────────────────────────────── */}
      <PillTabs
        className={embedded ? "" : "mt-5"}
        options={KIND_TABS}
        value={kind}
        onChange={setKind}
        ariaLabel="News desks"
        idPrefix="news-desk"
        panelId="news-column"
      />

      {/* ── TICKER FILTER (opened from the masthead control) ───────────────── */}
      <AnimatePresence initial={false}>
        {filterOpen && !embedded && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <BoardCard radius={14} className="mt-3 flex items-center gap-2.5 px-3.5 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-soft" aria-hidden />
              <label className="min-w-0 flex-1">
                <span className="sr-only">Filter stories by ticker</span>
                <input
                  autoFocus
                  value={tickerFilter}
                  onChange={(e) => setTickerFilter(e.target.value)}
                  placeholder="Filter by $TICKER"
                  className="w-full bg-transparent font-mono text-[13px] uppercase tracking-[0.06em] text-ink outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-soft/70"
                />
              </label>
              {tickerFilter && (
                <button
                  type="button"
                  onClick={() => setTickerFilter("")}
                  aria-label="Clear the ticker filter"
                  className="f0-focus shrink-0 rounded-full p-1 text-soft hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </BoardCard>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── HOUSE NOTE ────────────────────────────────────────────────────── */}
      {/* Editorial policy in the paper's own voice. Copy unchanged. */}
      <AnimatePresence initial={false}>
        {explainerOpen && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <BoardCard radius={16} className="mt-3 flex items-start gap-3 px-[15px] py-[14px]">
              <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-soft">
                The Club Newsroom is written by AI from public market data — a
                twice-daily <em>Market Wrap</em> plus short <em>Ticker Notes</em> on
                the day&apos;s biggest movers. It narrates what happened and teaches
                how to read it; it is <strong>not</strong> advice and never tells you
                what to buy. Tap any ticker to open its research page.
              </p>
              <HintDismiss
                onClick={() => {
                  setExplainerOpen(false);
                  howToHint.dismiss();
                }}
              />
            </BoardCard>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── IN THE NEWS TODAY ─────────────────────────────────────────────── */}
      {!embedded && (
        <section className="mt-6" aria-labelledby="news-desk-strip">
          <SectionMark
            id="news-desk-strip"
            label="In the news today"
            gloss="The names the desk is filing on"
          />
          {loading ? (
            <div className="mt-2.5 flex gap-[13px]" aria-busy="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Bone w={46} h={46} className="!rounded-full" />
                  <Bone w={28} h={7} className="mx-auto" />
                </div>
              ))}
            </div>
          ) : deskTickers.length === 0 ? (
            <FoundingLine className="mt-3">
              No company has been written about yet. The desk tags every story
              with the names it covers, and they appear here.
            </FoundingLine>
          ) : (
            <div className="club2-track -mx-1 mt-2.5 flex gap-[13px] overflow-x-auto px-1">
              {deskTickers.map((d) => (
                <Link
                  key={d.ticker}
                  href={`/research/${encodeURIComponent(d.ticker)}`}
                  className="f0-focus shrink-0 rounded-lg text-center"
                  title={`${d.stories} ${d.stories === 1 ? "story" : "stories"} mention ${d.ticker}`}
                >
                  <CompanyLogo symbol={d.ticker} size={46} rounded="rounded-full" />
                  <span className="mt-[5px] block font-mono text-[9px] text-ink/80">
                    {d.ticker}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── THE COLUMN ────────────────────────────────────────────────────── */}
      <div id="news-column" className={embedded ? "mt-3" : "mt-6"}>
        {loading ? (
          <NewsSkeleton />
        ) : shown.length === 0 ? (
          <FoundingLine>
            {tickerFilter
              ? "No stories tagged with that ticker yet."
              : "Nothing filed yet — the newsroom updates before the open and after the close on market days."}
          </FoundingLine>
        ) : (
          <div className="flex flex-col gap-2.5">
            {shown.map((a, i) => (
              <NewsEntry key={a.slug} article={a} lead={i === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function NewsSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <BoardCard key={i} radius={16} className="space-y-2.5 px-[15px] py-[14px]">
          <Bone w={96} h={8} />
          <Bone w="70%" h={15} />
          <Bone w="100%" h={9} />
          <div className="flex gap-1.5 pt-1">
            <Bone w={54} h={18} className="!rounded-full" />
            <Bone w={54} h={18} className="!rounded-full" />
          </div>
        </BoardCard>
      ))}
      <span className="sr-only">Loading the newsroom</span>
    </div>
  );
}
