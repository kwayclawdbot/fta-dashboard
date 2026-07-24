"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Heart,
  ArrowRight,
  LineChart,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchQuotes, type MarketQuote } from "@/lib/market/client";
import { fetchFavorites, type Favorite } from "@/lib/research/social";
import CompanyLogo from "@/components/fic/CompanyLogo";

/**
 * DashboardCommandCenter — the Home "daily pulse" row (Lane 11A). Three compact,
 * self-contained doors, role-aware:
 *   • Market pulse — the three big indices + the day's top movers (adults/teens),
 *     each linking to /research/[ticker]. Kids get a friendlier "explore
 *     companies" door instead of index/mover jargon.
 *   • Community heat — the club's most-liked companies right now.
 *   • Ask Kai — a one-tap entry into the research assistant.
 *
 * Fetches its own data in parallel and shows skeletons until ready, so it never
 * gates the rest of Home. Education-first framing everywhere (family platform).
 */

const INDICES: { symbol: string; label: string }[] = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq" },
  { symbol: "DIA", label: "Dow" },
];

interface Mover {
  ticker: string;
  name: string | null;
  chg_1d: number | null;
}

function pctClass(v: number | null | undefined): string {
  if (v == null) return "text-soft";
  return v > 0 ? "text-green-600" : v < 0 ? "text-red-600" : "text-soft";
}
function pctText(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export default function DashboardCommandCenter({ isKid = false }: { isKid?: boolean }) {
  const supabase = createClient();
  const [indexQuotes, setIndexQuotes] = useState<Record<string, MarketQuote> | null>(null);
  const [movers, setMovers] = useState<Mover[] | null>(null);
  const [favorites, setFavorites] = useState<Favorite[] | null>(null);

  useEffect(() => {
    let mounted = true;
    // Parallel fetches — none blocks another.
    if (!isKid) {
      fetchQuotes(INDICES.map((i) => i.symbol)).then((q) => mounted && setIndexQuotes(q)).catch(() => mounted && setIndexQuotes({}));
      supabase
        .from("screener_metrics")
        .select("ticker, name, chg_1d")
        .not("chg_1d", "is", null)
        .gte("mcap", 2_000_000_000)
        .order("chg_1d", { ascending: false })
        .limit(4)
        .then(({ data }) => mounted && setMovers((data as Mover[]) || []));
    }
    fetchFavorites(supabase, "7d", 4).then((f) => mounted && setFavorites(f)).catch(() => mounted && setFavorites([]));
    return () => {
      mounted = false;
    };
  }, [supabase, isKid]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Market pulse (adults/teens) OR Explore (kids) */}
      {isKid ? (
        <Link
          href="/screener"
          className="paper-card group flex flex-col justify-between p-4 transition-colors hover:border-gold-400/50"
        >
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Search className="h-4 w-4 text-gold-600" />
              <h3 className="font-display text-sm font-bold text-ink">Explore companies</h3>
            </div>
            <p className="text-xs text-soft">Find companies you know and learn what they do.</p>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gold-700">
            Start exploring <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      ) : (
        <div className="paper-card p-4">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-ink">
              <LineChart className="h-4 w-4 text-gold-600" /> Market pulse
            </h3>
            <Link href="/screener" className="text-[11px] font-semibold text-gold-700 hover:text-gold-800">
              Screener →
            </Link>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {INDICES.map((idx) => {
              const q = indexQuotes?.[idx.symbol];
              return (
                <div key={idx.symbol} className="rounded-lg border border-sand bg-paper px-2 py-1.5 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-soft">{idx.label}</div>
                  {indexQuotes == null ? (
                    <div className="mx-auto mt-1 h-3 w-10 animate-pulse rounded bg-sand" />
                  ) : (
                    <div className={`text-xs font-bold ${pctClass(q?.changePercent)}`}>{pctText(q?.changePercent)}</div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-soft">Today&apos;s movers</p>
          <div className="space-y-1">
            {movers == null ? (
              [0, 1, 2].map((i) => <div key={i} className="h-6 animate-pulse rounded bg-sand/60" />)
            ) : movers.length === 0 ? (
              <p className="text-xs text-soft">Movers refresh after the close.</p>
            ) : (
              movers.slice(0, 3).map((m) => (
                <Link
                  key={m.ticker}
                  href={`/research/${encodeURIComponent(m.ticker)}`}
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-paper"
                >
                  <CompanyLogo symbol={m.ticker} name={m.name ?? m.ticker} size={20} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{m.ticker}</span>
                  <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${pctClass(m.chg_1d)}`}>
                    {m.chg_1d != null && m.chg_1d >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {pctText(m.chg_1d)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}

      {/* Community heat */}
      <div className="paper-card p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 font-display text-sm font-bold text-ink">
            <Heart className="h-4 w-4 fill-red-500 text-red-500" /> Community heat
          </h3>
          <Link href="/watchlist/community" className="text-[11px] font-semibold text-gold-700 hover:text-gold-800">
            Board →
          </Link>
        </div>
        <div className="space-y-1">
          {favorites == null ? (
            [0, 1, 2].map((i) => <div key={i} className="h-6 animate-pulse rounded bg-sand/60" />)
          ) : favorites.length === 0 ? (
            <p className="text-xs text-soft">The club hasn&apos;t warmed up to any picks yet this week.</p>
          ) : (
            favorites.slice(0, 4).map((f) => (
              <Link
                key={f.ticker}
                href={`/research/${encodeURIComponent(f.ticker)}`}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-paper"
              >
                <CompanyLogo symbol={f.ticker} name={f.company_name} size={20} />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{f.ticker}</span>
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-500">
                  <Heart className="h-3 w-3 fill-red-500" />
                  {f.score}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Ask Kai */}
      <Link
        href="/kai"
        className="paper-card group flex flex-col justify-between p-4 transition-colors hover:border-gold-400/50"
        data-tour="ask-kai"
      >
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-400/20">
              <Sparkles className="h-4 w-4 text-gold-700" />
            </span>
            <h3 className="font-display text-sm font-bold text-ink">Ask Kai</h3>
          </div>
          <p className="text-xs text-soft">
            {isKid
              ? "Ask Kai about a company you know — it explains things simply."
              : "Your research analyst — explain a business, walk its numbers, pull headlines."}
          </p>
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gold-700">
          {isKid ? "Ask a question" : "Start a chat"} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    </div>
  );
}
