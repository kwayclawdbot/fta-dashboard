"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  TrendingUp,
  FileText,
  MessageSquare,
  Newspaper,
  Telescope,
  ArrowRight,
  MessagesSquare,
  Eye,
  Bot,
} from "lucide-react";
import NewsClient from "../news/NewsClient";
import type { NewsCardData } from "@/lib/news/types";
import type { CommunityBoardSeed } from "@/lib/community-watchlist-board";

/**
 * DiscoverClient — the five-tab discovery shell (R2). Tabs render real content
 * where it maps trivially onto existing surfaces; For You / Top Research are
 * honest placeholders. R3 replaces the placeholders + enriches Trending.
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
}

export default function DiscoverClient({ initialNews, board }: DiscoverClientProps) {
  const [tab, setTab] = useState<TabKey>("for-you");

  // Community board entries, ranked by net likes → the "most discussed" /
  // "trending in the club" slices. Both derive from the same seed; Trending
  // sorts by discussion + recency, Most Discussed by comment volume.
  const entries = board?.entries ?? [];
  const likeCounts = board?.likeCounts ?? {};

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

  return (
    <div className="mx-auto max-w-3xl">
      {/* Tab strip — horizontally scrollable on phones so all five fit. */}
      <div className="mb-5 -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <div className="flex gap-1.5 min-w-max">
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
                    : "text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800/40"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "for-you" && <ForYouTab />}
      {tab === "trending" && <TrendingTab rows={byDiscussion.slice(0, 12)} likeCounts={likeCounts} />}
      {tab === "research" && <ResearchTab />}
      {tab === "discussed" && <DiscussedTab rows={byLikes.slice(0, 12)} likeCounts={likeCounts} />}
      {tab === "news" && <NewsClient initialArticles={initialNews} />}
    </div>
  );
}

// ── Stock Finder CTA (screener lives inside Discover now) ────────────────────
function StockFinderCard() {
  return (
    <Link
      href="/screener"
      data-tour="discover:stock-finder"
      className="group flex items-center gap-4 rounded-2xl border border-sand bg-card p-4 shadow-soft transition hover:shadow-lift"
    >
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
          Filter 11,000+ stocks for the ones worth researching — near highs, surging volume, oversold.
        </p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-gold-600 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-sand bg-midnight-900/40 px-4 py-6 text-center text-[13px] text-soft">
      {children}
    </p>
  );
}

function TickerRow({
  ticker,
  name,
  meta,
}: {
  ticker: string;
  name: string;
  meta: string;
}) {
  return (
    <Link
      href="/watchlist/community"
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-midnight-800/40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-400/12 font-mono text-[11px] font-bold text-gold-700">
        {ticker.slice(0, 4)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{ticker}</p>
        <p className="truncate text-[12px] text-soft">{name}</p>
      </div>
      <span className="shrink-0 text-[12px] font-medium text-midnight-400">{meta}</span>
    </Link>
  );
}

// ── For You — honest placeholder (R3 makes it personalized) ──────────────────
function ForYouTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sand bg-card p-5 shadow-soft">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold-600" />
          <p className="font-display text-sm font-bold text-ink">Your personalized feed is warming up</p>
        </div>
        <p className="text-[13px] leading-relaxed text-soft">
          As you follow tickers, champion ideas and read research, this tab will surface what the
          Club thinks you&apos;ll care about. In the meantime, here&apos;s where to dive in.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <QuickLink href="/community" icon={MessagesSquare} title="Community" body="See what the Club is sharing right now." />
        <QuickLink href="/watchlist/community" icon={Eye} title="Community Watchlist" body="The ideas the Club is tracking together." />
        <QuickLink href="/kai" icon={Bot} title="Ask Kai" body="Your AI research co-pilot. Ask anything." />
        <QuickLink href="/news" icon={Newspaper} title="Newsroom" body="AI-narrated market recaps, daily." />
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

// ── Trending — community board sorted by discussion (R3 adds sparklines) ──────
function TrendingTab({
  rows,
  likeCounts,
}: {
  rows: CommunityBoardSeed["entries"];
  likeCounts: CommunityBoardSeed["likeCounts"];
}) {
  return (
    <div className="space-y-4">
      <StockFinderCard />
      <div className="rounded-2xl border border-sand bg-card p-2 shadow-soft">
        <p className="px-3 pb-1 pt-2 font-display text-sm font-bold text-ink">Trending in the Club</p>
        {rows.length ? (
          <div className="space-y-0.5">
            {rows.map((e) => (
              <TickerRow
                key={e.id}
                ticker={e.ticker}
                name={e.company_name}
                meta={`${e.comment_count ?? 0} 💬 · ${likeCounts[e.ticker]?.net ?? 0} ♥`}
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

// ── Top Research — honest placeholder (R3 adds author cards) ──────────────────
function ResearchTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sand bg-card p-5 shadow-soft">
        <div className="mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4 text-gold-600" />
          <p className="font-display text-sm font-bold text-ink">Top research, ranked</p>
        </div>
        <p className="text-[13px] leading-relaxed text-soft">
          The Club&apos;s best deep-dives — author, thesis, and reactions — will land here. For now,
          the freshest write-ups live on the Community feed and each idea&apos;s thread.
        </p>
      </div>
      <QuickLink
        href="/community"
        icon={MessagesSquare}
        title="Browse the Community feed"
        body="Every idea the Club has shared, newest first."
      />
    </div>
  );
}

// ── Most Discussed — community board sorted by net likes ──────────────────────
function DiscussedTab({
  rows,
  likeCounts,
}: {
  rows: CommunityBoardSeed["entries"];
  likeCounts: CommunityBoardSeed["likeCounts"];
}) {
  return (
    <div className="rounded-2xl border border-sand bg-card p-2 shadow-soft">
      <p className="px-3 pb-1 pt-2 font-display text-sm font-bold text-ink">Most discussed ideas</p>
      {rows.length ? (
        <div className="space-y-0.5">
          {rows.map((e) => (
            <TickerRow
              key={e.id}
              ticker={e.ticker}
              name={e.company_name}
              meta={`${likeCounts[e.ticker]?.net ?? 0} ♥ · ${e.comment_count ?? 0} 💬`}
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
