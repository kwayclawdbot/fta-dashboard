"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, Sparkles } from "lucide-react";

import type { DiscoverExtras } from "@/lib/discover";
import type { NewsCardData } from "@/lib/news/types";
import type { TrendingRow } from "@/lib/clubhome/contract";
import { brandInk, signedPct, toneFor } from "@/components/clubhome/board";
import { useKaiSheet } from "@/components/kai/KaiSheetProvider";
import ScreenerSurface from "@/components/screener/ScreenerSurface";

type DiscoverTab = "foryou" | "screener" | "trending";

function mark(ticker: string, size = 32) {
  const ink = brandInk(ticker);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[10px] font-extrabold"
      style={{ width: size, height: size, background: ink.bg, color: ink.fg }}
      aria-hidden
    >
      {ticker.slice(0, 1)}
    </span>
  );
}

function money(value?: number | null) {
  return value == null || !Number.isFinite(value) ? "—" : `$${value.toFixed(2)}`;
}

function TopRow({ row, rank }: { row: TrendingRow; rank: number }) {
  return (
    <Link href={`/research/${encodeURIComponent(row.ticker)}`} className="flex items-center gap-2.5 border-b border-[#2A2530] py-2.5 last:border-b-0">
      <span className={`cc-app-signal grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[8px] font-bold ${rank === 1 ? "bg-[#FF7A1A] text-[#0D0B0E]" : "bg-[#2A2530] text-[#8F8894]"}`}>{rank}</span>
      {mark(row.ticker)}
      <div className="min-w-0 flex-1">
        <p className="cc-app-signal text-[11px] font-semibold text-[#F4F0EC]">{row.ticker}</p>
        <p className="mt-0.5 truncate text-[9px] text-[#6E6774]">{row.company || "Club attention"}</p>
      </div>
      <div className="text-right">
        <p className="cc-app-signal text-[10.5px] font-semibold text-[#F4F0EC]">{money(row.price)}</p>
        <p className={`cc-app-signal mt-0.5 text-[8.5px] font-semibold ${toneFor(row.changePct)}`}>{signedPct(row.changePct)}</p>
        {(row.watchers ?? 0) > 0 && <p className="mt-0.5 text-[8px] text-[#6E6774]">{row.watchers!.toLocaleString()} watching</p>}
      </div>
    </Link>
  );
}

export default function StandaloneDiscover({
  rows,
  loading,
  news,
  extras,
  showScreener,
  initialTab,
  initialQuery,
}: {
  rows: TrendingRow[];
  loading: boolean;
  news: NewsCardData[] | null;
  extras: DiscoverExtras | null;
  showScreener: boolean;
  initialTab: DiscoverTab;
  initialQuery: string;
}) {
  const router = useRouter();
  const { openKai } = useKaiSheet();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<DiscoverTab>(initialTab);
  const brief = news?.find((item) => item.kind === "market_wrap") ?? news?.[0] ?? null;
  const movers = rows
    .filter((row) => row.changePct != null)
    .slice()
    .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
    .slice(0, 2);
  const rising = rows.filter((row) => (row.change ?? 0) > 0).slice(0, 4);
  const lead = rows[0] ?? null;
  const marketStarter = rows.length > 0 && rows.every((row) => row.score === 0 && row.participants === 0);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const ticker = query.trim().toUpperCase().replace(/[^A-Z.]/g, "");
    if (ticker) router.push(`/research/${encodeURIComponent(ticker)}`);
  }

  function selectTab(next: DiscoverTab) {
    if (next === "screener" && !showScreener) return;
    setTab(next);
    router.replace(next === "foryou" ? "/discover" : `/discover?tab=${next}`, {
      scroll: false,
    });
  }

  if (tab === "screener" && showScreener) {
    return (
      <div className="cc-app-screen mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-[390px] px-[18px] pb-20 pt-[18px] sm:rounded-[34px] sm:border sm:border-[#2A2530]">
        <ScreenerSurface embedded initialQuery={initialQuery} />
      </div>
    );
  }

  return (
    <div className="cc-app-screen mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-[390px] px-[18px] pb-20 pt-[18px] sm:rounded-[34px] sm:border sm:border-[#2A2530]">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="script-mark text-[34px] leading-none text-[#F4F0EC]">discover</h1>
          <p className="mt-1 text-[12.5px] text-[#8F8894]">Find what the Club is paying attention to</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSearchOpen((value) => !value)} className="cc-app-card grid h-[34px] w-[34px] place-items-center" aria-label="Search a ticker">
            <Search className="h-4 w-4 text-[#C8C2CE]" />
          </button>
          {showScreener ? (
            <button type="button" onClick={() => selectTab("screener")} className="cc-app-card grid h-[34px] w-[34px] place-items-center" aria-label="Open stock screener">
              <SlidersHorizontal className="h-4 w-4 text-[#FF9A4D]" />
            </button>
          ) : (
            <button onClick={() => openKai({ chip: "Discover", query: null })} className="cc-app-card grid h-[34px] w-[34px] place-items-center" aria-label="Ask Kai">
              <Sparkles className="h-4 w-4 text-[#FF9A4D]" />
            </button>
          )}
        </div>
      </header>

      {searchOpen && (
        <form onSubmit={submit} className="cc-app-card mt-3 flex items-center gap-2 px-3 py-2.5">
          <Search className="h-4 w-4 text-[#6E6774]" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ticker or company" className="min-w-0 flex-1 bg-transparent text-[13px] text-[#F4F0EC] outline-none placeholder:text-[#6E6774]" />
          <button className="cc-app-signal text-[9px] font-semibold text-[#FF9A4D]">OPEN</button>
        </form>
      )}

      <nav className={`mt-4 grid ${showScreener ? "grid-cols-3" : "grid-cols-2"} gap-1 rounded-[12px] border border-[#2A2530] bg-[#17141A] p-1`} aria-label="Discover views">
        {(
          [
            { key: "foryou" as const, label: "For you" },
            ...(showScreener ? [{ key: "screener" as const, label: "Screener" }] : []),
            { key: "trending" as const, label: "Trending" },
          ]
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => selectTab(item.key)}
            className={`cc-app-signal rounded-[9px] px-2 py-2 text-[8.5px] font-semibold uppercase tracking-[.1em] transition ${
              tab === item.key
                ? "bg-[#FF7A1A] text-[#0D0B0E]"
                : "text-[#8F8894] hover:text-[#F4F0EC]"
            }`}
            aria-current={tab === item.key ? "page" : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "trending" && (
        <section className="mt-5">
          <div className="flex items-center justify-between">
            <h2 className="cc-app-signal text-[9.5px] font-semibold uppercase tracking-[.16em] text-[#F4F0EC]">Trending now</h2>
            <span className="cc-app-signal text-[8px] text-[#6E6774]">LIVE MARKET + CLUB</span>
          </div>
          <div className="cc-app-card mt-2 px-3">
            {loading && rows.length === 0 ? (
              <div className="h-[360px] animate-pulse" aria-label="Loading trending tickers" />
            ) : (
              rows.map((row, index) => <TopRow key={row.ticker} row={row} rank={index + 1} />)
            )}
          </div>
        </section>
      )}

      <div className={tab === "foryou" ? "" : "hidden"}>

      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="cc-app-signal text-[9.5px] font-semibold uppercase tracking-[.16em] text-[#F4F0EC]">{marketStarter ? "Market radar" : "Top in the club"}</h2>
          <Link href="/community" className="text-[10.5px] font-bold text-[#FF9A4D]">See all {rows.length || ""} ›</Link>
        </div>
        <div className="cc-app-card mt-2 px-3">
          {loading && rows.length === 0 ? (
            <div className="h-[260px] animate-pulse" aria-label="Loading Club ranking" />
          ) : rows.length > 0 ? rows.slice(0, 5).map((row, index) => <TopRow key={row.ticker} row={row} rank={index + 1} />) : (
            <p className="py-5 text-center text-[12px] text-[#8F8894]">The Club ranking is filling in.</p>
          )}
        </div>
      </section>

      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="cc-app-signal text-[9.5px] font-semibold uppercase tracking-[.16em] text-[#F4F0EC]">Market brief</h2>
          {brief && <span className="cc-app-signal text-[8px] text-[#6E6774]">AI-GENERATED</span>}
        </div>
        <Link href={brief ? `/news/${brief.slug}` : "/news"} className="mt-2 block overflow-hidden rounded-[18px] border border-[#3A2418] bg-[linear-gradient(125deg,#241009,#17141A_72%)] px-4 py-4">
          <p className="cc-app-signal text-[8px] tracking-[.12em] text-[#FF9A4D]">TODAY · CLUB NEWSROOM</p>
          <h3 className="mt-2 text-[17px] font-bold leading-snug text-[#F4F0EC]">{brief?.title || "The market brief is being prepared."}</h3>
          {brief?.dek && <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-[#B8B2BC]">{brief.dek}</p>}
          <span className="mt-3 inline-block text-[10.5px] font-bold text-[#FF9A4D]">Read full brief →</span>
        </Link>
      </section>

      {movers.length > 0 && (
        <section className="mt-5">
          <div className="flex items-center justify-between">
            <h2 className="cc-app-signal text-[9.5px] font-semibold uppercase tracking-[.16em] text-[#F4F0EC]">What&apos;s moving</h2>
            <button type="button" onClick={() => selectTab("screener")} className="text-[10.5px] font-bold text-[#FF9A4D]">See more ›</button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {movers.map((row) => (
              <Link key={row.ticker} href={`/research/${row.ticker}`} className="cc-app-card p-3">
                <div className="flex items-center gap-2">{mark(row.ticker, 28)}<span className="cc-app-signal text-[10px] font-semibold text-[#F4F0EC]">{row.ticker}</span></div>
                <p className={`cc-app-signal mt-2 text-[12px] font-semibold ${toneFor(row.changePct)}`}>{signedPct(row.changePct)}</p>
                <p className="mt-1 truncate text-[9px] text-[#6E6774]">{row.company || "Live market move"}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {rising.length > 0 && (
        <section className="mt-5">
          <h2 className="cc-app-signal text-[9.5px] font-semibold uppercase tracking-[.16em] text-[#F4F0EC]">Rising in the club</h2>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {rising.map((row) => (
              <Link key={row.ticker} href={`/research/${row.ticker}`} className="cc-app-card min-w-[78px] px-3 py-2.5 text-center">
                <span className="cc-app-signal text-[10px] font-semibold text-[#F4F0EC]">{row.ticker}</span>
                <span className="cc-app-signal mt-1 block text-[9px] font-semibold text-[#FF9A4D]">▲{Math.abs(Math.round(row.change))}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {lead && (
        <section className="mt-5 overflow-hidden rounded-[18px] border border-[#2E3A18] bg-[linear-gradient(125deg,#131A0A,#17141A_70%)] p-4">
          <div className="flex items-center justify-between">
            <span className="cc-app-signal text-[8px] font-semibold tracking-[.12em] text-[#FF9A4D]">CLUB INSIGHT</span>
            {lead.heat != null && <span className="cc-app-signal rounded bg-[#C6FF4D] px-2 py-1 text-[7px] font-bold text-[#0D0B0E]">HIGH ATTENTION</span>}
          </div>
          <h3 className="mt-2 text-[15px] font-bold text-[#F4F0EC]">{marketStarter ? `${lead.ticker} leads the live market radar while Club attention builds.` : `${lead.ticker} holds the Club's highest verified attention rank.`}</h3>
          <p className="mt-2 text-[10.5px] text-[#8F8894]">
            {lead.sentiment?.bullPct != null ? `${lead.sentiment.bullPct}% of positioned members are bullish` : marketStarter ? "Live price data is on · community metrics are still forming" : "Member sentiment is still forming"}
            {lead.watchers != null ? ` · ${lead.watchers.toLocaleString()} watching` : ""}
          </p>
          <Link href={`/research/${lead.ticker}`} className="mt-3 inline-block text-[10.5px] font-bold text-[#FF9A4D]">View insight →</Link>
        </section>
      )}

      {extras?.forYouMovers?.length ? <span className="sr-only">Personalized from {extras.forYouMovers.length} watched movers</span> : null}
      </div>
    </div>
  );
}
