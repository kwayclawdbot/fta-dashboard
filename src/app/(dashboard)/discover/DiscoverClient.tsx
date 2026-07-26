"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  MessageSquare,
  ArrowRight,
  MessagesSquare,
  Bot,
  Heart,
  Telescope,
  Search,
} from "lucide-react";
import NewsClient from "../news/NewsClient";
import TickerRow from "@/components/ui/TickerRow";
import { PageIntro, EditorialSection } from "@/components/grammar";
import type { NewsCardData } from "@/lib/news/types";
import type { CommunityBoardSeed } from "@/lib/community-watchlist-board";
import type { DiscoverExtras } from "@/lib/discover";
import {
  fetchQuotes,
  formatPrice,
  formatChangePct,
  changeTone,
  type MarketQuote,
} from "@/lib/market/client";
import Sparkline from "@/components/fic/Sparkline";
import CompanyLogo from "@/components/fic/CompanyLogo";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { timeAgo } from "@/lib/feed";
import { contributionMeta } from "@/lib/research/social";

/**
 * Discover — DE-TABBED (CONVERGENCE S2). The six-tab switcher (Trending / Most
 * Discussed / Top Research … were only ranking filters on one universe) is gone.
 * Discover is now ONE editorial page on the sand canvas:
 *
 *   search anchor → For You → Trending Now → Best Research → News Moving the Club
 *
 * with "Open Stock Finder →" (the screener is a full-screen tool ROUTE now, not
 * an embedded tab) and "Explore stocks →" as the page's opening actions. News
 * keeps its own detail view (rows → /news/[slug]). Every ticker row is the shared
 * TickerRow signal-row primitive and navigates to /research/[ticker].
 */

interface DiscoverClientProps {
  initialNews: NewsCardData[] | null;
  board: CommunityBoardSeed | null;
  extras: DiscoverExtras | null;
}

type LikeCounts = CommunityBoardSeed["likeCounts"];
type Entries = CommunityBoardSeed["entries"];

export default function DiscoverClient({ initialNews, board, extras }: DiscoverClientProps) {
  const entries: Entries = board?.entries ?? [];
  const likeCounts: LikeCounts = board?.likeCounts ?? {};

  const byDiscussion = useMemo(
    () => [...entries].sort((a, b) => (b.comment_count ?? 0) - (a.comment_count ?? 0)),
    [entries]
  );

  // Batch one quote request for every ticker any section might show — no N+1.
  const allTickers = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => s.add(e.ticker));
    (extras?.forYouMovers ?? []).forEach((m) => s.add(m.ticker));
    return Array.from(s).filter(Boolean);
  }, [entries, extras]);

  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  useEffect(() => {
    if (!allTickers.length) return;
    const ctrl = new AbortController();
    fetchQuotes(allTickers, ctrl.signal).then(setQuotes).catch(() => {});
    return () => ctrl.abort();
  }, [allTickers]);

  const movers = extras?.forYouMovers ?? [];
  const hasWatched = movers.length > 0;
  const trending = byDiscussion.slice(0, 12);
  const contributions = extras?.contributions ?? [];
  const reports = extras?.reports ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16">
      {/* Search anchor — Discover's opening composition */}
      <div>
        <PageIntro
          eyebrow="Discover"
          title="Find your next idea"
          context="Search any stock, follow what the Club is watching, and read the best thinking."
        />
        <SearchAnchor />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/screener"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-solid)] px-3.5 py-1.5 text-sm font-bold text-[var(--accent-on)] transition-opacity hover:opacity-90"
          >
            <Telescope className="h-4 w-4" /> Open Stock Finder
          </Link>
          <Link
            href="/watchlist/community"
            className="inline-flex items-center gap-1 text-sm font-semibold text-soft transition-colors hover:text-ink"
          >
            Explore stocks <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* For You */}
      <EditorialSection
        title={hasWatched ? "For you" : "Personalize your feed"}
        lead={
          hasWatched
            ? "Moving on the stocks you follow · prices delayed ~15 min"
            : undefined
        }
        divide
      >
        {hasWatched ? (
          <div className="-mx-2">
            {movers.map((mv) => (
              <RankedTickerRow
                key={mv.ticker}
                ticker={mv.ticker}
                name={mv.name ?? mv.ticker}
                quote={quotes[mv.ticker]}
                likes={likeCounts[mv.ticker]?.net}
              />
            ))}
          </div>
        ) : (
          <p className="max-w-[60ch] text-base leading-relaxed text-soft">
            Like a few stocks (👍 on any research page) and this fills with the ones you
            follow — their moves, and what the Club is saying. Until then, here&apos;s what&apos;s
            hot right now.
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <QuickLink href="/community" icon={MessagesSquare} title="The Club" body="See what the Club is sharing right now." />
          <QuickLink href="/kai" icon={Bot} title="Ask Kai" body="Your AI research co-pilot. Ask anything." />
        </div>
      </EditorialSection>

      {/* Trending Now */}
      <EditorialSection
        title="Trending now"
        lead="What the Club is discussing most · prices delayed ~15 min"
        action={
          <Link href="/watchlist/community" className="font-semibold text-[var(--accent-strong)]">
            See all →
          </Link>
        }
        divide
      >
        {trending.length ? (
          <div className="-mx-2">
            {trending.map((e, i) => (
              <RankedTickerRow
                key={e.id}
                rank={i + 1}
                ticker={e.ticker}
                name={e.company_name}
                quote={quotes[e.ticker]}
                discussion={e.comment_count ?? 0}
                likes={likeCounts[e.ticker]?.net ?? 0}
              />
            ))}
          </div>
        ) : (
          <EmptyHint>
            Nothing trending yet. Be the first to champion an idea on the{" "}
            <Link href="/watchlist/community" className="font-semibold text-[var(--accent-strong)]">
              Community Watchlist
            </Link>
            .
          </EmptyHint>
        )}
      </EditorialSection>

      {/* Best Research */}
      <EditorialSection
        title="Best research"
        lead="The Club's best deep-dives — author, thesis, reactions."
        divide
      >
        {contributions.length === 0 && reports.length === 0 ? (
          <div className="space-y-3">
            <p className="max-w-[60ch] text-base leading-relaxed text-soft">
              The best deep-dives land here as members post them. Be the first: drop a thesis
              on any idea&apos;s research page.
            </p>
            <QuickLink
              href="/community"
              icon={MessagesSquare}
              title="Browse the Club feed"
              body="Every idea the Club has shared, newest first."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {contributions.map((c) => {
              const meta = contributionMeta(c.contribution_type);
              return (
                <Link
                  key={c.id}
                  href={`/research/${encodeURIComponent(c.ticker)}`}
                  className="paper-card block p-4 transition hover:shadow-lift"
                >
                  <div className="flex items-start gap-3">
                    <CompanyLogo symbol={c.ticker} name={c.ticker} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-ink">{c.ticker}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${meta.chip}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[15px] leading-snug text-ink/90">{c.snippet}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <Avatar name={c.author?.display_name} avatarUrl={c.author?.avatar_url} role={c.author?.role} size="xs" />
                        <span className="text-[11px] font-medium text-soft">
                          {c.author?.username ? `@${c.author.username}` : c.author?.display_name || "Member"}
                        </span>
                        <AgeBadge role={c.author?.role} ageGroup={c.author?.age_group} className="align-middle" />
                        <span className="ml-auto text-[10px] text-midnight-500">{timeAgo(c.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {reports.length > 0 && (
              <div className="pt-1">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-soft">
                  <Bot className="h-3.5 w-3.5 text-kai-blue" /> Kai research reports
                </p>
                <div className="-mx-2">
                  {reports.map((r) => (
                    <Link
                      key={r.ticker}
                      href={`/research/${encodeURIComponent(r.ticker)}`}
                      className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-sand/50"
                    >
                      <CompanyLogo symbol={r.ticker} name={r.company_name ?? r.ticker} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{r.ticker}</p>
                        <p className="truncate text-[11px] text-soft">{r.company_name ?? "Kai deep-dive"}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-midnight-500">{timeAgo(r.generated_at)}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </EditorialSection>

      {/* News Moving the Club — keeps its own detail view (rows → /news/[slug]) */}
      <EditorialSection title="News moving the Club" divide>
        <div className="flex items-center gap-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-soft">
          <FileText className="h-3.5 w-3.5" /> Newsroom
        </div>
        <NewsClient initialArticles={initialNews} />
      </EditorialSection>
    </div>
  );
}

// ── Search anchor ────────────────────────────────────────────────────────────
function SearchAnchor() {
  const router = useRouter();
  const [q, setQ] = useState("");
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim().toUpperCase().replace(/[^A-Z.]/g, "");
    if (t) router.push(`/research/${encodeURIComponent(t)}`);
  }
  return (
    <form onSubmit={onSubmit} role="search" className="group relative mt-4">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-soft transition-colors group-focus-within:text-volt-600" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search any stock — NVDA, Apple, a theme…"
        aria-label="Search stocks"
        className="h-14 w-full rounded-2xl border border-sand bg-card py-3.5 pl-12 pr-4 text-base text-ink placeholder:text-soft outline-none transition-colors focus:border-volt-400"
      />
    </form>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-sand px-4 py-6 text-center text-[15px] text-soft">
      {children}
    </p>
  );
}

// ── Enriched ranked ticker row (sparkline + delayed price + discussion) ──────
function RankedTickerRow({
  rank,
  ticker,
  name,
  quote,
  discussion,
  likes,
}: {
  rank?: number;
  ticker: string;
  name: string;
  quote?: MarketQuote;
  discussion?: number;
  likes?: number;
}) {
  const tone = changeTone(quote?.changePercent);
  return (
    <TickerRow
      href={`/research/${encodeURIComponent(ticker)}`}
      symbol={ticker}
      name={name}
      leading={
        rank != null ? (
          <span className="w-4 shrink-0 text-center font-mono text-xs font-bold text-midnight-400">
            {rank}
          </span>
        ) : undefined
      }
    >
      <div className="w-12 shrink-0 sm:w-24">
        <Sparkline symbol={ticker} height={28} />
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-[13px] font-semibold text-ink">{formatPrice(quote?.price)}</p>
        <p
          className={`inline-flex items-center justify-end gap-0.5 font-mono text-[11px] font-bold ${
            tone === "up" ? "text-green-600" : tone === "down" ? "text-red-600" : "text-soft"
          }`}
        >
          {tone === "up" ? (
            <TrendingUp className="h-3 w-3" />
          ) : tone === "down" ? (
            <TrendingDown className="h-3 w-3" />
          ) : null}
          {formatChangePct(quote?.changePercent) || "—"}
        </p>
        {(discussion != null || likes != null) && (
          <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px] text-midnight-500">
            {discussion != null && (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="h-2.5 w-2.5" />
                {discussion}
              </span>
            )}
            {likes != null && (
              <span className="inline-flex items-center gap-0.5">
                <Heart className="h-2.5 w-2.5" />
                {likes}
              </span>
            )}
          </p>
        )}
      </div>
    </TickerRow>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="paper-card group p-4 transition hover:shadow-lift"
    >
      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--accent-solid)_12%,transparent)] text-[var(--accent-strong)]">
        <Icon className="h-4 w-4" />
      </span>
      <p className="font-display text-sm font-bold text-ink">{title}</p>
      <p className="mt-0.5 text-[12px] leading-snug text-soft">{body}</p>
    </Link>
  );
}
