"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  FileText,
  MessageSquare,
  Newspaper,
  Telescope,
  ArrowRight,
  MessagesSquare,
  Bot,
  Heart,
} from "lucide-react";
import NewsClient from "../news/NewsClient";
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
 * DiscoverClient — the five-tab discovery hub (Cheat Code Club redesign). R3
 * makes the shell rich: For You is a real personalized mix (the viewer's
 * watched-ticker movers + a nudge when thin), Top Research surfaces real typed
 * contributions + published Kai reports, and Trending / Most Discussed rows now
 * carry a local sparkline + a delayed price + the discussion count. Every ticker
 * row navigates to /research/[ticker].
 */

type TabKey = "for-you" | "trending" | "research" | "discussed" | "news";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "for-you", label: "For You", icon: Sparkles },
  { key: "trending", label: "Trending", icon: TrendingUp },
  { key: "research", label: "Top Research", icon: FileText },
  { key: "discussed", label: "Most Discussed", icon: MessageSquare },
  { key: "news", label: "News", icon: Newspaper },
];

interface DiscoverClientProps {
  initialNews: NewsCardData[] | null;
  board: CommunityBoardSeed | null;
  extras: DiscoverExtras | null;
}

type LikeCounts = CommunityBoardSeed["likeCounts"];
type Entries = CommunityBoardSeed["entries"];

export default function DiscoverClient({ initialNews, board, extras }: DiscoverClientProps) {
  const [tab, setTab] = useState<TabKey>("for-you");

  const entries: Entries = board?.entries ?? [];
  const likeCounts: LikeCounts = board?.likeCounts ?? {};

  const byLikes = useMemo(
    () =>
      [...entries].sort(
        (a, b) => (likeCounts[b.ticker]?.net ?? 0) - (likeCounts[a.ticker]?.net ?? 0)
      ),
    [entries, likeCounts]
  );
  const byDiscussion = useMemo(
    () => [...entries].sort((a, b) => (b.comment_count ?? 0) - (a.comment_count ?? 0)),
    [entries]
  );

  // Batch one quote request for every ticker any tab might show — no N+1. The
  // Sparkline components fetch their own (cached) daily bars lazily on scroll.
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

  return (
    <div className="mx-auto max-w-3xl">
      {/* Tab strip — horizontally scrollable on phones so all five fit. */}
      <div className="mb-5 -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <div className="flex min-w-max gap-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                data-tour={`discover:${t.key}`}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-gold-400/15 text-gold-700"
                    : "text-midnight-400 hover:bg-midnight-800/40 hover:text-midnight-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "for-you" && <ForYouTab extras={extras} quotes={quotes} byDiscussion={byDiscussion} likeCounts={likeCounts} />}
      {tab === "trending" && <TrendingTab rows={byDiscussion.slice(0, 12)} quotes={quotes} likeCounts={likeCounts} />}
      {tab === "research" && <ResearchTab extras={extras} />}
      {tab === "discussed" && <DiscussedTab rows={byLikes.slice(0, 12)} quotes={quotes} likeCounts={likeCounts} />}
      {tab === "news" && <NewsClient initialArticles={initialNews} />}
    </div>
  );
}

// ── Stock Finder CTA (screener lives inside Discover now) ────────────────────
function StockFinderCard() {
  return (
    <div
      data-tour="discover:stock-finder"
      className="overflow-hidden rounded-2xl border border-sand bg-card shadow-soft"
    >
      <div className="flex items-center gap-3 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-700">
          <Telescope className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-display text-sm font-bold text-ink">Stock Finder</p>
            <span className="rounded-full bg-teal-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-teal-700">
              AI
            </span>
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-soft">
            Find high-potential stocks that fit your strategy with AI-powered filters.
          </p>
        </div>
      </div>
      <Link
        href="/screener"
        className="flex items-center justify-center gap-2 bg-[var(--accent-solid)] px-4 py-3 font-display text-sm font-bold text-[var(--accent-on)] transition-opacity hover:opacity-90"
      >
        <Telescope className="h-4 w-4" />
        Launch Stock Finder
      </Link>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-sand bg-midnight-900/40 px-4 py-6 text-center text-[13px] text-soft">
      {children}
    </p>
  );
}

// ── Enriched ranked ticker row (sparkline + delayed price + discussion) ──────
function TickerRow({
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
    <Link
      href={`/research/${encodeURIComponent(ticker)}`}
      className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-midnight-800/40"
    >
      {rank != null && (
        <span className="w-4 shrink-0 text-center font-mono text-xs font-bold text-midnight-400">
          {rank}
        </span>
      )}
      <CompanyLogo symbol={ticker} name={name} size={30} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{ticker}</p>
        <p className="truncate text-[11px] text-soft">{name}</p>
      </div>
      {/* Local price sparkline (lazy), narrow on phones. */}
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
    </Link>
  );
}

function DelayedNote() {
  return <p className="px-3 pb-1 text-[10px] text-midnight-500">Prices delayed ~15 min.</p>;
}

// ── For You — real personalized mix (watched movers + nudge) ─────────────────
function ForYouTab({
  extras,
  quotes,
  byDiscussion,
  likeCounts,
}: {
  extras: DiscoverExtras | null;
  quotes: Record<string, MarketQuote>;
  byDiscussion: Entries;
  likeCounts: LikeCounts;
}) {
  const movers = extras?.forYouMovers ?? [];
  const hasWatched = movers.length > 0;

  return (
    <div className="space-y-4">
      {hasWatched ? (
        <div className="rounded-2xl border border-sand bg-card p-2 shadow-soft">
          <p className="px-3 pb-1 pt-2 font-display text-sm font-bold text-ink">
            Moving on your watchlist
          </p>
          <DelayedNote />
          <div className="space-y-0.5">
            {movers.map((mv) => (
              <TickerRow
                key={mv.ticker}
                ticker={mv.ticker}
                name={mv.name ?? mv.ticker}
                quote={quotes[mv.ticker]}
                likes={likeCounts[mv.ticker]?.net}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-sand bg-card p-5 shadow-soft">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-600" />
            <p className="font-display text-sm font-bold text-ink">Personalize your feed</p>
          </div>
          <p className="text-[13px] leading-relaxed text-soft">
            Like a few stocks (👍 on any research page) and this tab fills with the ones you
            follow — their moves, and what the Club is saying. Until then, here&apos;s what&apos;s
            hot right now.
          </p>
        </div>
      )}

      {/* Suggested from the Club — trending the viewer may not follow yet. */}
      {byDiscussion.length > 0 && (
        <div className="rounded-2xl border border-sand bg-card p-2 shadow-soft">
          <p className="px-3 pb-1 pt-2 font-display text-sm font-bold text-ink">
            {hasWatched ? "More the Club is watching" : "Trending in the Club"}
          </p>
          <DelayedNote />
          <div className="space-y-0.5">
            {byDiscussion.slice(0, 5).map((e) => (
              <TickerRow
                key={e.id}
                ticker={e.ticker}
                name={e.company_name}
                quote={quotes[e.ticker]}
                discussion={e.comment_count ?? 0}
                likes={likeCounts[e.ticker]?.net ?? 0}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <QuickLink href="/community" icon={MessagesSquare} title="Community" body="See what the Club is sharing right now." />
        <QuickLink href="/kai" icon={Bot} title="Ask Kai" body="Your AI research co-pilot. Ask anything." />
      </div>
      <StockFinderCard />
    </div>
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
      className="group rounded-2xl border border-sand bg-card p-4 shadow-soft transition hover:shadow-lift"
    >
      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-gold-400/12 text-gold-700">
        <Icon className="h-4 w-4" />
      </span>
      <p className="font-display text-sm font-bold text-ink">{title}</p>
      <p className="mt-0.5 text-[12px] leading-snug text-soft">{body}</p>
    </Link>
  );
}

// ── Trending — community board sorted by discussion, enriched rows ───────────
function TrendingTab({
  rows,
  quotes,
  likeCounts,
}: {
  rows: Entries;
  quotes: Record<string, MarketQuote>;
  likeCounts: LikeCounts;
}) {
  return (
    <div className="space-y-4">
      <StockFinderCard />
      <div className="rounded-2xl border border-sand bg-card p-2 shadow-soft">
        <p className="px-3 pb-1 pt-2 font-display text-sm font-bold text-ink">Trending stocks</p>
        <DelayedNote />
        {rows.length ? (
          <div className="space-y-0.5">
            {rows.map((e, i) => (
              <TickerRow
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
          <div className="p-2">
            <EmptyHint>
              Nothing trending yet. Be the first to champion an idea on the{" "}
              <Link href="/watchlist/community" className="font-semibold text-gold-700">
                Community Watchlist
              </Link>
              .
            </EmptyHint>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Top Research — real typed contributions + published Kai reports ──────────
function ResearchTab({ extras }: { extras: DiscoverExtras | null }) {
  const contributions = extras?.contributions ?? [];
  const reports = extras?.reports ?? [];

  return (
    <div className="space-y-4">
      {contributions.length === 0 && reports.length === 0 ? (
        <>
          <div className="rounded-2xl border border-sand bg-card p-5 shadow-soft">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gold-600" />
              <p className="font-display text-sm font-bold text-ink">Top research, ranked</p>
            </div>
            <p className="text-[13px] leading-relaxed text-soft">
              The Club&apos;s best deep-dives — author, thesis, and reactions — land here as members
              post them. Be the first: drop a thesis on any idea&apos;s research page.
            </p>
          </div>
          <QuickLink
            href="/community"
            icon={MessagesSquare}
            title="Browse the Community feed"
            body="Every idea the Club has shared, newest first."
          />
        </>
      ) : (
        <>
          {contributions.length > 0 && (
            <div className="space-y-2">
              {contributions.map((c) => {
                const meta = contributionMeta(c.contribution_type);
                return (
                  <Link
                    key={c.id}
                    href={`/research/${encodeURIComponent(c.ticker)}`}
                    className="block rounded-2xl border border-sand bg-card p-4 shadow-soft transition hover:shadow-lift"
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
                        <p className="line-clamp-2 text-[13px] leading-snug text-midnight-200">
                          {c.snippet}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <Avatar
                            name={c.author?.display_name}
                            avatarUrl={c.author?.avatar_url}
                            role={c.author?.role}
                            size="xs"
                          />
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
            </div>
          )}

          {reports.length > 0 && (
            <div className="rounded-2xl border border-sand bg-card p-2 shadow-soft">
              <div className="flex items-center gap-1.5 px-3 pb-1 pt-2">
                <Bot className="h-4 w-4 text-kai-500" />
                <p className="font-display text-sm font-bold text-ink">Kai research reports</p>
              </div>
              <div className="space-y-0.5">
                {reports.map((r) => (
                  <Link
                    key={r.ticker}
                    href={`/research/${encodeURIComponent(r.ticker)}`}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-midnight-800/40"
                  >
                    <CompanyLogo symbol={r.ticker} name={r.company_name ?? r.ticker} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{r.ticker}</p>
                      <p className="truncate text-[11px] text-soft">{r.company_name ?? "Kai deep-dive"}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-midnight-500">{timeAgo(r.generated_at)}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gold-600" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Most Discussed — community board sorted by net likes, enriched rows ──────
function DiscussedTab({
  rows,
  quotes,
  likeCounts,
}: {
  rows: Entries;
  quotes: Record<string, MarketQuote>;
  likeCounts: LikeCounts;
}) {
  return (
    <div className="rounded-2xl border border-sand bg-card p-2 shadow-soft">
      <p className="px-3 pb-1 pt-2 font-display text-sm font-bold text-ink">Most discussed ideas</p>
      <DelayedNote />
      {rows.length ? (
        <div className="space-y-0.5">
          {rows.map((e, i) => (
            <TickerRow
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
        <div className="p-2">
          <EmptyHint>
            No ideas on the board yet. Head to the{" "}
            <Link href="/watchlist/community" className="font-semibold text-gold-700">
              Community Watchlist
            </Link>{" "}
            to add the first.
          </EmptyHint>
        </div>
      )}
    </div>
  );
}
