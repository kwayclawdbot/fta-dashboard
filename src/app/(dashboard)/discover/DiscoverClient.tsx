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
 *   SEGMENTED CONTROL   For You · Trending · Top Research · Most Discussed —
 *                       underline-driven tabs on a hairline, never pill-soup
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
}

type SegmentKey = "foryou" | "trending" | "research" | "discussed";

/* ── DARK-THEME COLOUR STEPS ─────────────────────────────────────────────────
 * The colour law is unchanged at night — orange is still brand/action, lime is
 * still sentiment, green/red is still price, Kai blue is still AI. What changes
 * is the STEP on each ramp, because every one of them was chosen for legibility
 * against cream and none of them survives an obsidian page:
 *
 *   volt-700  #C24400 on #0F1115 → ~2.5:1     → volt-400 #FF8C33 (~7.4:1)
 *   green-600 #15803D            → ~2.9:1     → green-400 #22C55E
 *   red-600   #B91C1C            → ~2.6:1     → red-400   #F87171
 *   kai-600   #1D4FD6            → ~2.2:1     → kai-300   #7DA0FF
 *
 * Every dark step goes BRIGHTER, never greyer — orange must not soften at night.
 * The one orange that stays at volt-700 is the Stock Finder pill, because it
 * sits on a white chip inside the theme-invariant .club2-band.
 */
const ORANGE_ACTION =
  "text-volt-700 hover:text-volt-600 dark:text-volt-400 dark:hover:text-volt-300";
const ORANGE_LINK = `font-display font-bold underline decoration-volt-500/40 underline-offset-2 dark:decoration-volt-400/50 ${ORANGE_ACTION}`;

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
export default function DiscoverClient({ initialNews, board, extras }: DiscoverClientProps) {
  // Stable identities for the seeds — `x ?? []` allocates a fresh array on every
  // render, which would invalidate every memo below.
  const entries = useMemo(() => board?.entries ?? [], [board]);
  const movers = useMemo(() => extras?.forYouMovers ?? [], [extras]);
  const contributions = extras?.contributions ?? [];
  const reports = extras?.reports ?? [];

  // The community-attention ledger + the pulse series the carousel charts.
  const { trending, pulse } = useClubLedger();
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
        <p className="font-display text-eyebrow font-bold uppercase text-volt-700 dark:text-volt-400">
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
        <TickerCarousel trending={trending} pulse={pulse} />
      </div>

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
      <StockFinderBand />

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
        <NewsClient initialArticles={initialNews} />
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
    void get<TrendingResponse>("/api/club/trending").then((d) => d && setTrending(d));
    void get<PulseResponse>("/api/club/pulse").then((d) => d && setPulse(d));
    return () => ctrl.abort();
  }, []);

  return { trending, pulse };
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
      <div className="group flex items-center gap-3 border-b-2 border-ink/80 pb-3 transition-colors focus-within:border-volt-500 dark:border-ink/40 dark:focus-within:border-volt-400">
        <Search
          className="h-5 w-5 shrink-0 text-soft transition-colors group-focus-within:text-volt-600 dark:group-focus-within:text-volt-400"
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
            className={`shrink-0 rounded-full p-1.5 transition-colors hover:bg-volt-500/10 dark:hover:bg-volt-500/20 ${ORANGE_ACTION}`}
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
          className={`inline-flex items-center gap-1.5 font-display text-[13px] font-bold transition-colors ${ORANGE_ACTION}`}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          or ask Kai
        </button>
      </div>
    </form>
  );
}

/* ── SEGMENTED CONTROL ───────────────────────────────────────────────────── */
/**
 * Underline-driven tabs riding a single hairline. Deliberately NOT pills: a row
 * of rounded chips reads as five competing objects, where the rule + one charged
 * underline reads as one control with a current position.
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
      className="club2-track -mx-4 flex gap-7 overflow-x-auto border-b border-sand px-4 dark:border-ink/20"
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
            className={`relative shrink-0 pb-3 font-display text-[13px] font-bold uppercase tracking-[0.1em] transition-colors ${
              active ? "text-ink" : "text-soft hover:text-ink"
            }`}
          >
            {s.label}
            {s.count > 0 && (
              <span
                className={`ml-1.5 font-mono text-[10px] font-semibold tabular-nums ${
                  active ? "text-volt-700 dark:text-volt-400" : "text-soft/70"
                }`}
              >
                {s.count}
              </span>
            )}
            <span
              aria-hidden
              className={`absolute inset-x-0 -bottom-px h-[2px] rounded-full transition-opacity duration-200 ${
                active ? "bg-volt-500 opacity-100" : "opacity-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ── THE RANKED LEDGER ───────────────────────────────────────────────────── */
function Ledger({ items, empty }: { items: LedgerItem[]; empty: React.ReactNode }) {
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
        className="w-11 shrink-0 text-right font-display text-[34px] font-extrabold leading-none tracking-tight tabular-nums text-ink/15 transition-colors group-hover:text-volt-500/50 dark:text-ink/25 dark:group-hover:text-volt-500/70"
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
              ? "text-green-600 dark:text-green-400"
              : tone === "down"
                ? "text-red-600 dark:text-red-400"
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
      {/* The unfilled track rides --sand, so it re-maps with the theme. The lime
          fill is deliberately CONSTANT in both themes: lime means one thing
          (community sentiment) and reads cleanly on cream and on obsidian. */}
      <span
        className="h-[3px] w-16 shrink-0 overflow-hidden rounded-full bg-sand sm:w-24"
        aria-hidden
      >
        <span
          className="block h-full rounded-full bg-lime-500"
          style={{ width: `${Math.max(2, Math.min(100, item.bullPct as number))}%` }}
        />
      </span>
      <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-soft">
        {item.bullPct}% bull · {item.positioned} positioned
        {showWatchers ? ` · ${item.watchers} watching` : ""}
        {item.heat != null ? ` · club ${item.heat}` : ""}
      </span>
    </div>
  );
}

/** The server-authoritative free cap, stated plainly rather than blurred out. */
function LedgerWall({ shown, total }: { shown: number; total: number }) {
  return (
    <div className="mt-5 border-t border-sand pt-4 dark:border-ink/20">
      <p className="font-display text-[15px] font-bold text-ink">
        You&apos;re seeing the top {shown} of {total}.
      </p>
      <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-soft">
        The full attention ledger — every rank, plus its history — is part of the
        Club.
      </p>
      <Link
        href="/upgrade"
        className={`mt-2.5 inline-flex items-center gap-1.5 font-display text-[13px] font-bold transition-colors ${ORANGE_ACTION}`}
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
              className="block -mx-2 px-2 py-4 transition-colors hover:bg-volt-500/[0.05] dark:hover:bg-volt-500/10"
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
            className="block -mx-2 px-2 py-4 transition-colors hover:bg-volt-500/[0.05] dark:hover:bg-volt-500/10"
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
 * white text and the white action pill here are correct in both themes and must
 * NOT be swapped for semantic tokens — text-ink on this band would flip to
 * near-black in light and near-white in dark, i.e. it would break in one of them.
 * These are the only literal whites on the surface.
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
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-display text-[13px] font-bold text-volt-700 transition-transform active:scale-[0.98]"
          >
            <Telescope className="h-4 w-4" aria-hidden />
            Open Stock Finder
          </Link>
          <Link
            href="/watchlist/community"
            className="inline-flex items-center gap-1 font-display text-[13px] font-bold text-white/90 transition-colors hover:text-white"
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
    <p className="max-w-[56ch] border-l-2 border-volt-500/50 pl-4 text-[15px] leading-relaxed text-soft">
      {children}
    </p>
  );
}
