"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  MessageSquare,
  Search,
  Sparkles,
  Telescope,
} from "lucide-react";

import NewsClient from "../news/NewsClient";
import { TickerTile, TickerTileStrip } from "@/components/canvas2";
import CompanyLogo from "@/components/fic/CompanyLogo";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import TickerCarousel from "@/components/club2/TickerCarousel";
import { useKaiSheet } from "@/components/kai/KaiSheetProvider";
import { FLOORS } from "@/lib/club/score";
import { timeAgo } from "@/lib/feed";
import { contributionMeta } from "@/lib/research/social";
import {
  fetchQuotes,
  formatPrice,
  formatChangePct,
  changeTone,
  type MarketQuote,
} from "@/lib/market/client";
import type { NewsCardData } from "@/lib/news/types";
import type { CommunityBoardSeed } from "@/lib/community-watchlist-board";
import type { DiscoverExtras } from "@/lib/discover";
import type {
  PulseResponse,
  TrendingResponse,
  TrendingRow,
} from "@/lib/clubhome/contract";

/**
 * DISCOVER — rebuilt to the Cheat Code Club canvas system (canvas rebuild B).
 *
 * COMPOSITION (light-primary, warm sand canvas, top → bottom):
 *
 *   DISCOVER            display-1 masthead, one dominant voice on the surface
 *   SEARCH              a full-width ruled field — not a boxed input — with the
 *                       "or ask Kai" affordance opening the contextual Kai sheet
 *   WHAT THE CLUB IS SEEING   the shared <TickerCarousel /> (read-only foundation)
 *   MOVING UP THE BOARD canvas v2 board 02 "From quiet to loud" — a dense
 *                       <TickerTileStrip /> of the names whose club score rose
 *                       most against the prior window. Below the floor it pads
 *                       with EMPTY SLOTS, so nine tickers read as a club filling
 *                       up rather than as a broken row.
 *   MOST DIVISIVE       canvas v2 board 02 §2 — the biggest split in opinion.
 *                       The canvas draws a bull/bear DONUT; adopted as a split
 *                       BAR instead (plan §1.5 keeps one radial gauge in the
 *                       system, and green/red on an opinion split would spend
 *                       the price ramp on community sentiment).
 *   SEGMENTED CONTROL   For You · Trending · Top Research · Most Discussed —
 *                       underline-driven tabs on the shared .f0-seg-bar
 *                       geometry, never pill-soup
 *   THE LEDGER          hairline rows where a LARGE MUTED RANK NUMERAL carries the
 *                       object identity: rank · logo · $CASHTAG · mono price ·
 *                       green/red % · lime community-sentiment bar
 *   TOP RESEARCH        author identity leads (avatar · name · credibility tag),
 *                       then the thesis — hairline separated, never cards
 *   STOCK FINDER        the one orange field on the surface (the screener lives
 *                       behind it). Actions only — no price ever sits on orange.
 *   NEWSROOM            preserved verbatim (rows → /news/[slug])
 *
 * COLOUR LAW: green/red = PRICE only · lime = COMMUNITY SENTIMENT only ·
 * orange = BRAND + ACTION only.
 *
 * DATA: /api/club/trending is the ranked community-ATTENTION ledger and carries
 * price, changePct, watchers, participants, sentiment{bull,neutral,bear,bullPct},
 * heat (null below FLOORS.trendingScore) and floorMet. Nothing here is invented:
 * a metric below its floor renders founding-era copy, and an absent quote renders
 * as an honest dash. The endpoint's free cap (`locked` / `freeCap` /`totalCount`)
 * is server-authoritative and surfaced as a wall, and its compliance `disclaimer`
 * is rendered verbatim under the ledger.
 */

interface DiscoverClientProps {
  initialNews: NewsCardData[] | null;
  board: CommunityBoardSeed | null;
  extras: DiscoverExtras | null;
  /** False for a kid register — /screener redirects them, so the band would be
   *  a door that bounces. Resolved server-side; never guessed here. */
  showStockFinder?: boolean;
}

type SegmentKey = "foryou" | "trending" | "research" | "discussed";

/* ── ORANGE, ONE WAY ─────────────────────────────────────────────────────────
 * This surface used to hand-roll its own dark steps (`text-volt-700
 * dark:text-volt-400`), which is the exact drift the token layer exists to end:
 * `volt-*` is FROZEN across themes, so every consumer that wanted a legible
 * orange at night had to re-derive one and they all landed somewhere different.
 *
 * The system's answer is the GOLD ramp — in club mode it IS volt orange, and
 * unlike volt it flips for the dark page (--g700 #C24400 → #FFC96B). So orange
 * TEXT is `text-gold-700` with NO dark: variant anywhere; orange FILLS and
 * rules ride `bg-accent` / `border-accent` (--accent-solid), which is also
 * mode-correct for free (family gold, club orange, FTA metallic).
 *
 * Underline decoration deliberately inherits currentColor rather than naming a
 * ramp step, so the rule under a link can never disagree with the link.
 */
const ORANGE_ACTION = "text-gold-700 transition-colors hover:text-gold-600";
const ORANGE_LINK = `font-display font-bold underline decoration-1 underline-offset-2 ${ORANGE_ACTION}`;

/* ── "MOST DIVISIVE" FLOORS ──────────────────────────────────────────────────
 * FLOORS in src/lib/club/score.ts is scaled for club-wide aggregates (50), which
 * a nine-ticker founding club will not clear on any single name for months — so
 * a divisiveness gate borrowed from it would mean the section NEVER renders and
 * the surface would ship a permanently dead heading.
 *
 * These are per-ticker floors instead, and they are deliberately small but
 * honest: the row must carry at least four positioned members, and the split is
 * only called "divisive" inside a genuinely contested band. Because the rendered
 * copy always states the denominator ("· 4 positioned"), a four-vote split can
 * never masquerade as consensus — which is the same contract StanceBar holds.
 */
const DIVISIVE_MIN_POSITIONED = 4;
const DIVISIVE_MAX_GAP = 20; // bullPct within 30–70

/** One row of the ranked ledger, normalized across the three ranked segments. */
interface LedgerItem {
  key: string;
  ticker: string;
  company: string | null;
  price: number | null;
  changePct: number | null;
  /** community stance (lime) */
  bullPct: number | null;
  positioned: number;
  watchers: number | null;
  comments: number | null;
  /** normalized 0–100 club attention; null below FLOORS.trendingScore */
  heat: number | null;
  floorMet: boolean;
  /** canonical ledger rank when the server supplies one (Trending); otherwise the
   *  row's position in its own segment. */
  rank?: number;
}

/* ── the surface ─────────────────────────────────────────────────────────── */
export default function DiscoverClient({
  initialNews,
  board,
  extras,
  showStockFinder = true,
}: DiscoverClientProps) {
  // Stable identities for the seeds — `x ?? []` allocates a fresh array on every
  // render, which would invalidate every memo below.
  const entries = useMemo(() => board?.entries ?? [], [board]);
  const movers = useMemo(() => extras?.forYouMovers ?? [], [extras]);
  const contributions = extras?.contributions ?? [];
  const reports = extras?.reports ?? [];

  // The community-attention ledger + the pulse series the carousel charts.
  const { trending, pulse, loading: ledgerLoading } = useClubLedger();
  const trendingRows = useMemo(() => trending?.rows ?? [], [trending]);

  const byDiscussion = useMemo(
    () => [...entries].sort((a, b) => (b.comment_count ?? 0) - (a.comment_count ?? 0)),
    [entries]
  );

  // Sentiment/heat travel with the ticker, so a For-You or Most-Discussed row can
  // carry the same community read as its Trending twin (joined, never re-derived).
  const intelByTicker = useMemo(() => {
    const m = new Map<string, TrendingRow>();
    for (const r of trendingRows) m.set(r.ticker.toUpperCase(), r);
    return m;
  }, [trendingRows]);

  // ONE batched quote request covering every ticker any segment can show — no N+1.
  // Trending rows already carry a Polygon mark from the server; these fill in the
  // board/For-You universe, which does not.
  const quoteTickers = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => e.ticker && s.add(e.ticker.toUpperCase()));
    movers.forEach((mv) => mv.ticker && s.add(mv.ticker.toUpperCase()));
    return Array.from(s);
  }, [entries, movers]);

  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  useEffect(() => {
    if (!quoteTickers.length) return;
    const ctrl = new AbortController();
    fetchQuotes(quoteTickers, ctrl.signal).then(setQuotes).catch(() => {});
    return () => ctrl.abort();
  }, [quoteTickers]);

  /* — segment models ——————————————————————————————————————————————— */
  const forYouItems: LedgerItem[] = useMemo(
    () =>
      movers.map((mv) => {
        const t = mv.ticker.toUpperCase();
        const intel = intelByTicker.get(t);
        const q = quotes[t];
        return {
          key: `fy-${t}`,
          ticker: mv.ticker,
          company: mv.name,
          price: q?.price ?? intel?.price ?? null,
          changePct: q?.changePercent ?? intel?.changePct ?? mv.chg_1d ?? null,
          ...stanceOf(intel),
          watchers: intel?.watchers ?? null,
          comments: null,
        };
      }),
    [movers, intelByTicker, quotes]
  );

  const trendingItems: LedgerItem[] = useMemo(
    () =>
      trendingRows.map((r) => ({
        key: `tr-${r.ticker}`,
        ticker: r.ticker,
        company: r.company ?? null,
        price: r.price ?? null,
        changePct: r.changePct ?? null,
        ...stanceOf(r),
        watchers: r.watchers ?? null,
        comments: null,
        rank: r.rank,
      })),
    [trendingRows]
  );

  const discussedItems: LedgerItem[] = useMemo(
    () =>
      byDiscussion.slice(0, 12).map((e) => {
        const t = e.ticker.toUpperCase();
        const intel = intelByTicker.get(t);
        const q = quotes[t];
        return {
          key: `md-${e.id}`,
          ticker: e.ticker,
          company: e.company_name,
          price: q?.price ?? intel?.price ?? e.latest_close ?? null,
          changePct: q?.changePercent ?? intel?.changePct ?? null,
          ...stanceOf(intel),
          watchers: intel?.watchers ?? null,
          comments: e.comment_count ?? 0,
        };
      }),
    [byDiscussion, intelByTicker, quotes]
  );

  const researchCount = contributions.length + reports.length;

  /* — canvas v2 board 02 §"From quiet to loud" ————————————————————————
   * `change` is club_change_14d off the snapshot ledger — the row's score
   * against the PRIOR window, i.e. exactly "names the Club just woke up on".
   * Nothing is derived here that the server did not already compute. */
  const risingRows = useMemo(
    () =>
      trendingRows
        .filter((r) => (r.change ?? 0) > 0)
        .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
        .slice(0, 8),
    [trendingRows]
  );

  /* — canvas v2 board 02 §"Most divisive" ————————————————————————————
   * The single widest split in opinion. A split needs BODIES before it can be
   * called divisive, so a row must clear DIVISIVE_MIN_POSITIONED and sit inside
   * the contested band; otherwise the section renders its founding state. The
   * denominator always ships with the percentage, exactly as StanceBar does. */
  const divisive = useMemo(() => {
    let best: TrendingRow | null = null;
    let bestGap = Infinity;
    for (const r of trendingRows) {
      const s = r.sentiment;
      if (!s || s.bullPct == null) continue;
      const positioned = s.bull + s.neutral + s.bear;
      if (positioned < DIVISIVE_MIN_POSITIONED) continue;
      const gap = Math.abs(50 - s.bullPct);
      if (gap <= DIVISIVE_MAX_GAP && gap < bestGap) {
        best = r;
        bestGap = gap;
      }
    }
    return best;
  }, [trendingRows]);

  /* — the control ————————————————————————————————————————————————— */
  const segments: { key: SegmentKey; label: string; count: number }[] = [
    { key: "foryou", label: "For you", count: forYouItems.length },
    { key: "trending", label: "Trending", count: trendingItems.length },
    { key: "research", label: "Top research", count: researchCount },
    { key: "discussed", label: "Most discussed", count: discussedItems.length },
  ];

  // Open on the segment the member actually has content in. Derived, not an
  // effect: the For-You set arrives with the server seed, so the default resolves
  // on first paint and only a real click pins it.
  const [picked, setPicked] = useState<SegmentKey | null>(null);
  const segment: SegmentKey = picked ?? (forYouItems.length ? "foryou" : "trending");
  const setSegment = setPicked;

  const rankedCount =
    segment === "foryou"
      ? forYouItems.length
      : segment === "trending"
        ? trendingItems.length
        : discussedItems.length;

  return (
    <div className="mx-auto max-w-2xl pb-16 lg:max-w-3xl">
      {/* ── MASTHEAD ─────────────────────────────────────────────────────── */}
      <header>
        <p className="font-display text-eyebrow font-bold uppercase text-gold-700">
          Cheat Code Club
        </p>
        <h1 className="mt-3 font-display text-display-1 font-extrabold uppercase text-ink">
          Discover
        </h1>
        <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-soft">
          Every name the Club is working on, ranked by attention — then the thinking
          behind it.
        </p>
      </header>

      {/* ── SEARCH ───────────────────────────────────────────────────────── */}
      <SearchAnchor />

      {/* ── WHAT THE CLUB IS SEEING ─────────────────────────────────────── */}
      <div className="mt-10">
        <TickerCarousel trending={trending} pulse={pulse} loading={ledgerLoading} />
      </div>

      {/* ── MOVING UP THE BOARD (canvas 02 · "From quiet to loud") ───────── */}
      <RisingStrip rows={risingRows} loading={ledgerLoading} />

      {/* ── MOST DIVISIVE (canvas 02 §2) ────────────────────────────────── */}
      <DivisiveSplit row={divisive} loading={ledgerLoading} />

      {/* ── THE LEDGER ───────────────────────────────────────────────────── */}
      <section className="mt-11" aria-labelledby="discover-ledger">
        <h2 id="discover-ledger" className="sr-only">
          Discover the Club
        </h2>

        <Segmented
          segments={segments}
          value={segment}
          onChange={setSegment}
        />

        <div
          id="discover-panel"
          role="tabpanel"
          aria-labelledby={`discover-tab-${segment}`}
          className="mt-5"
        >
          {segment === "foryou" && (
            <Ledger
              items={forYouItems}
              /* For You ranks by the size of the member's own move, not by club rank. */
              empty={
                <FoundingNote>
                  Like a few names (👍 on any research page) and this becomes your
                  ledger — their moves, and the Club&apos;s read on each. Until then,{" "}
                  <button
                    type="button"
                    onClick={() => setSegment("trending")}
                    className={ORANGE_LINK}
                  >
                    see what&apos;s trending
                  </button>
                  .
                </FoundingNote>
              }
            />
          )}

          {segment === "trending" && (
            <>
              <Ledger
                items={trendingItems}
                loading={ledgerLoading}
                empty={
                  <FoundingNote>
                    The Club hasn&apos;t formed a read yet. Rate a ticker on the{" "}
                    <Link
                      href="/watchlist/community"
                      className={ORANGE_LINK}
                    >
                      Community Watchlist
                    </Link>{" "}
                    and you&apos;ll be the first signal on this board.
                  </FoundingNote>
                }
              />
              {trending?.locked && (
                <LedgerWall
                  shown={trendingItems.length}
                  total={trending.totalCount ?? trendingItems.length}
                />
              )}
            </>
          )}

          {segment === "research" && (
            <ResearchLedger contributions={contributions} reports={reports} />
          )}

          {segment === "discussed" && (
            <Ledger
              items={discussedItems}
              empty={
                <FoundingNote>
                  No thread has caught yet. Champion an idea on the{" "}
                  <Link
                    href="/watchlist/community"
                    className={ORANGE_LINK}
                  >
                    Community Watchlist
                  </Link>{" "}
                  and the conversation starts here.
                </FoundingNote>
              }
            />
          )}
        </div>

        {/* Compliance line, verbatim from the ledger endpoint — attention inside
            the Club is not a recommendation. Renders on every ranked view, since
            all three read the same attention/sentiment ledger. */}
        {segment !== "research" && rankedCount > 0 && (
          <p className="mt-5 font-mono text-[11px] leading-relaxed text-soft">
            {trending?.disclaimer ?? "Attention inside the Club — not a recommendation."}
            {" · Prices delayed ~15 min."}
          </p>
        )}
      </section>

      {/* ── STOCK FINDER — the one orange field on this surface ──────────── */}
      {showStockFinder && <StockFinderBand />}

      {/* ── NEWSROOM (preserved: rows keep their own /news/[slug] detail) ── */}
      <section className="mt-11" aria-labelledby="discover-news">
        <div className="f0-section-rule mb-4">
          <h2
            id="discover-news"
            className="font-display text-eyebrow font-bold uppercase text-ink"
          >
            News moving the Club
          </h2>
        </div>
        {/* `embedded` drops the newsroom's own display-1 masthead, its page box
            and its ticker strip — Discover already owns all three. */}
        <NewsClient initialArticles={initialNews} embedded />
      </section>
    </div>
  );
}

/* ── community stance, joined onto any ledger row ────────────────────────── */
function stanceOf(r?: TrendingRow | null): Pick<
  LedgerItem,
  "bullPct" | "positioned" | "heat" | "floorMet"
> {
  const s = r?.sentiment;
  const positioned = s ? s.bull + s.neutral + s.bear : 0;
  return {
    bullPct: s?.bullPct ?? null,
    positioned,
    heat: r?.heat ?? null,
    floorMet: r?.floorMet ?? false,
  };
}

/* ── live club data ──────────────────────────────────────────────────────── */
/**
 * Discover reads the two endpoints it actually needs rather than the nine-section
 * /api/club/home batch: the ranked ledger, and Pulse for the carousel's inline
 * series. Both fail soft to null — every section below renders a designed founding
 * state instead of a spinner or a fabricated number.
 */
function useClubLedger() {
  const [trending, setTrending] = useState<TrendingResponse | null>(null);
  const [pulse, setPulse] = useState<PulseResponse | null>(null);
  // LOADING IS NOT EMPTY. Trending is the DEFAULT segment for any member without
  // For-You movers, so without this flag every Discover open rendered "The Club
  // hasn't formed a read yet" before the ranked ledger swapped in.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    const get = async <T,>(path: string): Promise<T | null> => {
      try {
        const res = await fetch(path, {
          signal: ctrl.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) return null;
        return (await res.json()) as T;
      } catch {
        return null;
      }
    };
    // The ledger's founding state is gated on the TRENDING read specifically —
    // Pulse only decorates rows with a series, so it must not hold the gate.
    void get<TrendingResponse>("/api/club/trending")
      .then((d) => {
        if (d) setTrending(d);
      })
      .finally(() => setLoading(false));
    void get<PulseResponse>("/api/club/pulse").then((d) => d && setPulse(d));
    return () => ctrl.abort();
  }, []);

  return { trending, pulse, loading };
}

/* ── SEARCH ANCHOR ───────────────────────────────────────────────────────── */
function SearchAnchor() {
  const router = useRouter();
  const { openKai } = useKaiSheet();
  const [q, setQ] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim().toUpperCase().replace(/[^A-Z.]/g, "");
    if (t) router.push(`/research/${encodeURIComponent(t)}`);
  }

  function askKai() {
    const asked = q.trim();
    openKai({ chip: "Discover", query: asked || null });
  }

  return (
    <form onSubmit={onSubmit} role="search" className="mt-8">
      {/* The rule is the field. In light it is a near-black 2px bar on cream; at
          80% of a near-WHITE ink on obsidian that same bar glares, so dark drops
          it to 40% — same weight and intent, correct value contrast. */}
      <div className="group flex items-center gap-3 border-b-2 border-ink/80 pb-3 transition-colors focus-within:border-accent dark:border-ink/40">
        <Search
          className="h-5 w-5 shrink-0 text-soft transition-colors group-focus-within:text-gold-700"
          aria-hidden
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search any stock"
          aria-label="Search stocks"
          className="min-w-0 flex-1 bg-transparent font-display text-[22px] font-bold tracking-tight text-ink outline-none placeholder:font-semibold placeholder:text-soft/60 dark:placeholder:text-soft/75 sm:text-[26px]"
        />
        {q.trim() && (
          <button
            type="submit"
            aria-label="Open research"
            className={`f0-focus f0-press shrink-0 rounded-full p-1.5 ${ORANGE_ACTION}`}
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
          Ticker, company, or a theme
        </p>
        <button
          type="button"
          onClick={askKai}
          className={`f0-focus f0-press inline-flex items-center gap-1.5 rounded font-display text-[13px] font-bold ${ORANGE_ACTION}`}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          or ask Kai
        </button>
      </div>
    </form>
  );
}

/* ── SECTION HEAD ────────────────────────────────────────────────────────── */
/** The canvas's own section marker: charged tick + label + hairline to the edge,
 *  with the plain-English gloss beneath it. */
function SectionHead({ title, gloss }: { title: string; gloss: string }) {
  return (
    <>
      <h2 className="f0-section-rule font-display text-eyebrow font-bold uppercase text-ink">
        <span className="shrink-0 whitespace-nowrap">{title}</span>
      </h2>
      <p className="mt-2 text-[12.5px] leading-relaxed text-soft">{gloss}</p>
    </>
  );
}

/* ── MOVING UP THE BOARD ─────────────────────────────────────────────────── */
/**
 * Canvas board 02, "From quiet to loud — names the Club just woke up on".
 *
 * The canvas draws five bare sparklines in five different colours (red, orange,
 * amber, green, green) with a ticker under each — five hues encoding nothing,
 * two of which are the price ramp. Adopted as the <TickerTile /> strip instead:
 * one achromatic ground, identity carried by the mark, and the ONLY colour on
 * the object is the delta, which is genuinely a price.
 *
 * LOADING ≠ EMPTY (§0.4) and FOUNDING IS MANDATORY (§0.5) are both visible here:
 * in flight the strip pulses filled tiles; with nothing rising it renders six
 * DASHED slots plus founding copy, so a young club reads as one that is filling
 * up rather than as a section that failed.
 */
function RisingStrip({ rows, loading }: { rows: TrendingRow[]; loading: boolean }) {
  return (
    <section className="mt-11" aria-labelledby="discover-rising">
      <div id="discover-rising">
        <SectionHead
          title="Moving up the board"
          gloss="Names the Club just woke up on — biggest gain in attention against the last two weeks."
        />
      </div>

      {loading ? (
        <TickerTileStrip className="mt-4" loading loadingCount={6} />
      ) : rows.length > 0 ? (
        <TickerTileStrip className="mt-4" minSlots={6}>
          {rows.map((r) => (
            <TickerTile
              key={r.ticker}
              ticker={r.ticker}
              changePct={r.changePct ?? null}
              href={`/research/${encodeURIComponent(r.ticker)}`}
            />
          ))}
        </TickerTileStrip>
      ) : (
        <>
          <TickerTileStrip className="mt-4" minSlots={6} />
          <p className="mt-3 max-w-[56ch] text-[13px] leading-relaxed text-soft">
            No name has gained ground on the board this fortnight. Every slot here
            fills itself — watch a ticker, ask Kai about it, or post a thesis, and
            it starts climbing.
          </p>
        </>
      )}
    </section>
  );
}

/* ── MOST DIVISIVE ───────────────────────────────────────────────────────── */
/**
 * Canvas board 02 §2, "Most divisive — biggest split in opinions".
 *
 * TWO DELIBERATE DIVERGENCES FROM THE CANVAS:
 *  1. The canvas renders the split as a conic-gradient DONUT. Plan §1.5 keeps
 *     exactly one radial gauge in the system (the club-sentiment arc), so this
 *     is a split BAR — which carries a two-part proportion at least as legibly
 *     and costs no new visual idiom.
 *  2. The canvas paints bullish GREEN and bearish RED. Both halves of this split
 *     are COMMUNITY SENTIMENT, and the colour law reserves green/red for price.
 *     The bull share therefore takes the sentiment ramp and the bear share takes
 *     a neutral ink tint — the object still reads as a contest, and no price
 *     colour is spent on an opinion.
 *
 * The tile suppresses its delta on purpose: this object is about disagreement,
 * and hanging a price move off it invites the split to be read as a forecast.
 */
function DivisiveSplit({ row, loading }: { row: TrendingRow | null; loading: boolean }) {
  const s = row?.sentiment;
  const bullPct = s?.bullPct ?? null;
  const positioned = s ? s.bull + s.neutral + s.bear : 0;

  return (
    <section className="mt-11" aria-labelledby="discover-divisive">
      <div id="discover-divisive">
        <SectionHead
          title="Most divisive"
          gloss="Where the Club disagrees with itself the most."
        />
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-4" aria-busy="true">
          <TickerTile size="lg" loading showDelta={false} />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="h-3.5 w-24 rounded-full bg-ink/10 motion-safe:animate-pulse" />
            <div className="h-[6px] w-full rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
            <div className="h-2.5 w-40 rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
          </div>
          <span className="sr-only">Loading the widest split</span>
        </div>
      ) : row && bullPct != null ? (
        <Link
          href={`/research/${encodeURIComponent(row.ticker)}?tab=community`}
          className="f0-focus group mt-4 flex items-center gap-4 rounded-lg"
        >
          <TickerTile ticker={row.ticker} size="lg" showDelta={false} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[17px] font-extrabold tracking-tight text-ink">
              <span className="text-soft">$</span>
              {row.ticker.toUpperCase()}
            </p>
            {row.company && (
              <p className="truncate text-[12px] leading-tight text-soft">{row.company}</p>
            )}

            {/* The split. Sentiment owns the bull share; the bear share is a
                neutral ink tint, never the price red. */}
            <span
              className="mt-2 flex h-[6px] w-full overflow-hidden rounded-full bg-ink/12"
              aria-hidden
            >
              <span
                className="h-full bg-sentiment-fill"
                style={{ width: `${Math.max(2, Math.min(98, bullPct))}%` }}
              />
            </span>

            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
              <span className="text-sentiment">{bullPct}% bull</span>
              {" · "}
              {100 - bullPct}% not
              {" · "}
              {positioned} positioned
            </p>
          </div>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-soft transition-colors group-hover:text-gold-700"
            aria-hidden
          />
        </Link>
      ) : (
        <div className="mt-4 flex items-center gap-4">
          <TickerTile size="lg" showDelta={false} />
          <p className="max-w-[46ch] text-[13px] leading-relaxed text-soft">
            Nothing is contested yet — a split needs at least{" "}
            {DIVISIVE_MIN_POSITIONED} members on the same name taking opposite
            sides. Take a position on any ticker and the argument starts here.
          </p>
        </div>
      )}
    </section>
  );
}

/* ── SEGMENTED CONTROL ───────────────────────────────────────────────────── */
/**
 * Underline-driven tabs riding a single hairline. Deliberately NOT pills: a row
 * of rounded chips reads as five competing objects, where the rule + one charged
 * underline reads as one control with a current position.
 *
 * WHY NOT <SegmentedRail /> (canvas2): the rail is a `radiogroup` — a FORM
 * control with roving tabindex, correct for stance and post type. This control
 * drives a `tabpanel`, so it must stay `tablist`/`tab` or the panel loses its
 * relationship to the thing that switched it. Per the L0 contract the geometry
 * is shared instead: the same `.f0-seg-bar` indicator and the same `.f0-focus`
 * ring, so the two controls look and feel identical and only their semantics
 * differ. The bar rides `bg-accent` (--accent-solid) rather than a frozen
 * `volt-*` step, so it is mode-correct in family gold / club orange / FTA.
 */
function Segmented<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: { key: T; label: string; count: number }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Discover views"
      /* The inactive hairline needs the same dark lift the foundation gives
         .f0-ledger: --sand (#2A2E37) at 1px all but vanishes on the obsidian
         page, which would leave the control with no baseline for the underline
         to travel along. The active volt underline is unchanged — orange holds
         its value in both themes. */
      className="club2-track f0-rule-bottom -mx-4 flex gap-7 overflow-x-auto px-4"
    >
      {segments.map((s) => {
        const active = s.key === value;
        return (
          <button
            key={s.key}
            id={`discover-tab-${s.key}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls="discover-panel"
            onClick={() => onChange(s.key)}
            className={`f0-focus f0-press relative -mb-px shrink-0 pb-3 font-display text-[13px] font-bold uppercase tracking-[0.1em] transition-colors ${
              active ? "text-ink" : "text-soft hover:text-ink"
            }`}
          >
            {s.label}
            {s.count > 0 && (
              <span
                className={`ml-1.5 font-mono text-[10px] font-semibold tabular-nums ${
                  active ? "text-gold-700" : "text-soft/70"
                }`}
              >
                {s.count}
              </span>
            )}
            {active && <span className="f0-seg-bar bg-accent" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/* ── THE RANKED LEDGER ───────────────────────────────────────────────────── */
function Ledger({
  items,
  empty,
  loading = false,
}: {
  items: LedgerItem[];
  empty: React.ReactNode;
  /** Still arriving. Renders ruled placeholder rows instead of the founding
   *  note, so "loading" is never mistaken for "the club has ranked nothing". */
  loading?: boolean;
}) {
  if (loading && items.length === 0) {
    return (
      <ol className="f0-ledger" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="flex items-center justify-between gap-4 py-3.5">
            <div className="h-3.5 w-20 rounded-full bg-ink/10 motion-safe:animate-pulse" />
            <div className="h-3.5 w-24 rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
          </li>
        ))}
        <span className="sr-only">Loading the ledger</span>
      </ol>
    );
  }
  if (items.length === 0) return <>{empty}</>;
  return (
    <ol className="f0-ledger f0-stagger">
      {items.map((it, i) => (
        <li key={it.key} style={{ "--i": i } as React.CSSProperties}>
          <LedgerRow item={it} rank={it.rank ?? i + 1} />
        </li>
      ))}
    </ol>
  );
}

/**
 * The object IS the typography. A large muted rank numeral gives the row its
 * identity — no box, no border, no fill. Price stays green/red; the community
 * stance bar is the only lime on the surface.
 */
function LedgerRow({ item, rank }: { item: LedgerItem; rank: number }) {
  const tone = changeTone(item.changePct ?? undefined);
  const price = formatPrice(item.price ?? undefined);
  const pct = formatChangePct(item.changePct ?? undefined);

  return (
    <Link
      href={`/research/${encodeURIComponent(item.ticker)}`}
      className="f0-ledger-row group -mx-2 px-2"
    >
      {/* THE RANK NUMERAL — the row's identity, and the piece most sensitive to
          the theme flip. 15% of a near-BLACK ink on cream is a soft grey that
          still holds its shape at 34px; 15% of a near-WHITE ink on obsidian is
          a ghost, because a light tint loses far more perceived presence over a
          dark field than a dark tint does over a light one. Dark runs it at 25%
          (and lifts the hover to 70%) so it reads as deliberately muted rather
          than as something that failed to load. */}
      <span
        aria-hidden
        className="w-11 shrink-0 text-right font-display text-[34px] font-extrabold leading-none tracking-tight tabular-nums text-ink/15 transition-colors group-hover:text-accent dark:text-ink/25"
      >
        {rank}
      </span>

      <CompanyLogo symbol={item.ticker} name={item.company} size={34} rounded="rounded-lg" />

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[15px] font-extrabold tracking-tight text-ink">
          <span className="text-soft">$</span>
          {item.ticker.toUpperCase()}
        </p>
        {item.company && (
          <p className="truncate text-[12px] leading-tight text-soft">{item.company}</p>
        )}
        <StanceBar item={item} />
      </div>

      <div className="shrink-0 text-right">
        <p className="font-mono text-[15px] font-semibold tabular-nums text-ink">
          {price || "—"}
        </p>
        <p
          className={`font-mono text-[12px] font-bold tabular-nums ${
            tone === "up"
              ? "text-price-up"
              : tone === "down"
                ? "text-price-down"
                : "text-soft"
          }`}
        >
          {pct || "—"}
        </p>
        {item.comments != null && item.comments > 0 && (
          <p className="mt-0.5 inline-flex items-center justify-end gap-1 font-mono text-[10px] tabular-nums text-soft">
            <MessageSquare className="h-2.5 w-2.5" aria-hidden />
            {item.comments}
          </p>
        )}
      </div>
    </Link>
  );
}

/**
 * COMMUNITY SENTIMENT — the only lime on the surface.
 *
 * The percentage always ships with its denominator, so a three-vote read can
 * never masquerade as consensus. With nobody positioned there is no bar at all
 * and the row says so in founding language. Watcher counts stay hidden until
 * FLOORS.tickerParticipants, and `heat` is already null below its own floor
 * server-side — nothing here is invented to fill a gap.
 */
function StanceBar({ item }: { item: LedgerItem }) {
  const hasStance = item.bullPct != null && item.positioned > 0;
  const showWatchers = (item.watchers ?? 0) >= FLOORS.tickerParticipants;

  if (!hasStance) {
    return (
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-soft/80">
        {item.floorMet ? "Stance forming" : "Early — no read yet"}
      </p>
    );
  }

  return (
    <div className="mt-1.5 flex items-center gap-2">
      {/* The unfilled track rides --sand, so it re-maps with the theme. The fill
          is `bg-sentiment-fill` — the canonical community-sentiment token, which
          carries BOTH theme steps itself, so this never needs (and must never
          get) a dark: variant. It replaced a hand-written `bg-lime-500`, the
          per-surface divergence the token was minted to end. */}
      <span
        className="h-[3px] w-16 shrink-0 overflow-hidden rounded-full bg-sand sm:w-24"
        aria-hidden
      >
        <span
          className="block h-full rounded-full bg-sentiment-fill"
          style={{ width: `${Math.max(2, Math.min(100, item.bullPct as number))}%` }}
        />
      </span>
      <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-soft">
        <span className="text-sentiment">{item.bullPct}% bull</span> ·{" "}
        {item.positioned} positioned
        {showWatchers ? ` · ${item.watchers} watching` : ""}
        {item.heat != null ? ` · club ${item.heat}` : ""}
      </span>
    </div>
  );
}

/** The server-authoritative free cap, stated plainly rather than blurred out. */
function LedgerWall({ shown, total }: { shown: number; total: number }) {
  return (
    <div className="f0-rule-top mt-5 pt-4">
      <p className="font-display text-[15px] font-bold text-ink">
        You&apos;re seeing the top {shown} of {total}.
      </p>
      <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-soft">
        The full attention ledger — every rank, plus its history — is part of the
        Club.
      </p>
      <Link
        href="/upgrade"
        className={`f0-focus mt-2.5 inline-flex items-center gap-1.5 rounded font-display text-[13px] font-bold ${ORANGE_ACTION}`}
      >
        See the full rankings <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/* ── TOP RESEARCH — author identity leads ────────────────────────────────── */
function ResearchLedger({
  contributions,
  reports,
}: {
  contributions: DiscoverExtras["contributions"];
  reports: DiscoverExtras["reports"];
}) {
  if (contributions.length === 0 && reports.length === 0) {
    return (
      <FoundingNote>
        The best deep-dives land here as members post them. Be first — drop a thesis
        on any idea&apos;s{" "}
        <Link
          href="/community"
          className={ORANGE_LINK}
        >
          research page
        </Link>
        .
      </FoundingNote>
    );
  }

  return (
    <div className="f0-ledger f0-stagger">
      {contributions.map((c, i) => {
        const meta = contributionMeta(c.contribution_type);
        return (
          <article key={c.id} style={{ "--i": i } as React.CSSProperties}>
            <Link
              href={`/research/${encodeURIComponent(c.ticker)}`}
              className="f0-focus block -mx-2 rounded px-2 py-4 transition-colors hover:bg-accent/[0.06]"
            >
              {/* identity first — who is talking, and why you should listen */}
              <div className="flex items-center gap-2">
                <Avatar
                  name={c.author?.display_name}
                  avatarUrl={c.author?.avatar_url}
                  role={c.author?.role}
                  size="sm"
                />
                <span className="truncate font-display text-[13px] font-bold text-ink">
                  {c.author?.username
                    ? `@${c.author.username}`
                    : c.author?.display_name || "A member"}
                </span>
                <AgeBadge role={c.author?.role} ageGroup={c.author?.age_group} />
                {/* Credibility tag as TYPE, not as a coloured chip — the semantic
                    chip tokens are red/green, which the colour law reserves for
                    price. A hairline-separated mono label carries the same
                    information without spending a market colour. */}
                <span
                  aria-hidden
                  className="shrink-0 text-soft/50"
                >
                  ·
                </span>
                <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-soft">
                  {meta.label}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-soft">
                  {timeAgo(c.created_at)}
                </span>
              </div>

              {/* then the thinking */}
              <p className="mt-2.5 line-clamp-2 font-display text-[19px] font-bold leading-snug tracking-tight text-ink">
                {c.snippet}
              </p>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
                ${c.ticker.toUpperCase()}
              </p>
            </Link>
          </article>
        );
      })}

      {reports.map((r, i) => (
        <article
          key={`kai-${r.ticker}`}
          style={{ "--i": contributions.length + i } as React.CSSProperties}
        >
          <Link
            href={`/research/${encodeURIComponent(r.ticker)}`}
            className="f0-focus block -mx-2 rounded px-2 py-4 transition-colors hover:bg-accent/[0.06]"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kai-500/12 text-kai-600 dark:bg-kai-500/22 dark:text-kai-300">
                <Bot className="h-4 w-4" aria-hidden />
              </span>
              <span className="font-display text-[13px] font-bold text-ink">Kai</span>
              <span aria-hidden className="shrink-0 text-soft/50">
                ·
              </span>
              <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-kai-600 dark:text-kai-300">
                AI deep-dive
              </span>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-soft">
                {timeAgo(r.generated_at)}
              </span>
            </div>
            <p className="mt-2.5 font-display text-[19px] font-bold leading-snug tracking-tight text-ink">
              {r.company_name ? `${r.company_name} — full research report` : "Full research report"}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-soft">
              ${r.ticker.toUpperCase()}
            </p>
          </Link>
        </article>
      ))}
    </div>
  );
}

/* ── STOCK FINDER — the surface's single orange field ────────────────────── */
/**
 * Full-bleed orange band. It breaks the container deliberately so orange reads as
 * energy rather than trim, and it carries ACTIONS only — no price, no percentage
 * ever sits on this field (the colour law: they render illegibly on orange).
 *
 * THEME-INVARIANT BY DESIGN. `.club2-band` stays orange in both themes (the
 * foundation only drops a little luminance at night so it doesn't glare), which
 * means the type on it is measured against ORANGE, not against the page. So the
 * light action pill here is correct in both themes and must NOT be swapped for
 * semantic tokens — `text-ink` on this band flips to near-black in light and
 * near-white in dark, i.e. it breaks in one of them.
 *
 * The pill's ground is `bg-night-50` and its type `text-night-950`: both are
 * CONSTANT ramp steps (they are not remapped by the theme blocks), which is the
 * same fix ActionBand carries, expressed with tokens instead of a literal
 * `bg-white` — so this file holds no raw colour keyword at all.
 */
function StockFinderBand() {
  return (
    <section className="club2-band f0-grain relative mt-11" aria-labelledby="stock-finder">
      <div className="mx-auto max-w-2xl px-4 py-6 lg:max-w-3xl">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/90">
          Stock Finder
        </span>
        <h2
          id="stock-finder"
          className="mt-2 max-w-[22ch] font-display text-display-3 font-extrabold text-white"
        >
          Screen the whole market on your own terms.
        </h2>
        <p className="mt-2 max-w-[46ch] text-[14px] leading-relaxed text-white/85">
          Filters, club heat, and plain-English screening — the full finder, behind
          one door.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link
            href="/screener"
            className="f0-focus f0-press inline-flex items-center gap-2 rounded-full bg-night-50 px-4 py-2 font-display text-[13px] font-bold text-night-950"
          >
            <Telescope className="h-4 w-4 text-volt-600" aria-hidden />
            Open Stock Finder
          </Link>
          <Link
            href="/watchlist/community"
            className="f0-focus inline-flex items-center gap-1 rounded font-display text-[13px] font-bold text-white/90 transition-colors hover:text-white"
          >
            Community Watchlist <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── founding-era copy (never an empty rectangle, never a fake number) ───── */
function FoundingNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[56ch] border-l-2 border-accent pl-4 text-[15px] leading-relaxed text-soft">
      {children}
    </p>
  );
}
