"use client";

import Link from "next/link";
import { useState } from "react";
import { ClubRankRail, TickerQuickSheet, type TickerRank } from "@/components/collective";
import type { TrendingResponse } from "@/lib/clubhome/contract";

function rankItems(trending?: TrendingResponse | null): TickerRank[] {
  return (trending?.rows ?? []).slice(0, 10).map((row) => ({
    rank: row.rank,
    ticker: row.ticker,
    name: row.company || row.ticker,
    movement: row.change,
    statistic:
      row.heat != null
        ? `${row.heat}% Club attention`
        : row.watchers
          ? `${row.watchers.toLocaleString()} watching`
          : row.changePct != null
            ? `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(2)}% today`
            : "Club attention",
    href: `/research/${encodeURIComponent(row.ticker)}?from=dashboard`,
  }));
}

export default function TopInTheClub({
  trending,
  loading = false,
}: {
  trending?: TrendingResponse | null;
  loading?: boolean;
  isKid?: boolean;
}) {
  const items = rankItems(trending);
  const [selected, setSelected] = useState<TickerRank | null>(null);

  if (loading) {
    return (
      <section aria-busy="true" aria-label="Loading Top in the Club">
        <div className="h-7 w-44 rounded-full bg-ink/10 motion-safe:animate-pulse" />
        <div className="mt-3 flex gap-6 overflow-hidden">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-16 min-w-56 border-b border-border bg-ink/[0.03] motion-safe:animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="border-y border-border py-5">
        <h2 className="font-display text-2xl font-bold text-ink">Top in the Club</h2>
        <p className="mt-1 text-sm text-soft">The ranking forms as members watch, research, and take positions.</p>
      </section>
    );
  }

  return (
    <div>
      <ClubRankRail items={items} onSelect={setSelected} />
      <div className="mt-2 flex items-start justify-between gap-4">
        <p className="max-w-xl text-[10px] leading-relaxed text-soft">
          {trending?.disclaimer || "Ranked by Club attention and participation, not investment performance or advice."}
        </p>
        {(trending?.totalCount ?? items.length) > items.length && (
          <Link href="/discover" className="shrink-0 text-xs font-semibold text-action focus-visible:outline-2 focus-visible:outline-action">
            See all
          </Link>
        )}
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/35" role="presentation" onMouseDown={() => setSelected(null)}>
          <div className="mx-auto w-full max-w-xl" role="dialog" aria-modal="true" aria-label={`${selected.ticker} quick view`} onMouseDown={(event) => event.stopPropagation()}>
            <TickerQuickSheet>
              <div className="flex items-start justify-between gap-4">
                <div><span className="font-mono text-xs text-soft">#{selected.rank} in the Club</span><h3 className="mt-1 font-display text-3xl font-bold text-ink">{selected.name}</h3><p className="mt-1 font-mono text-sm text-soft">${selected.ticker} · {selected.statistic}</p></div>
                <button type="button" onClick={() => setSelected(null)} className="rounded-full border border-border px-3 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-action" aria-label="Close ticker quick view">×</button>
              </div>
              <div className="mt-6 flex gap-3"><Link href={selected.href || `/research/${selected.ticker}`} className="rounded-xl bg-action px-4 py-3 text-sm font-semibold text-[var(--accent-on)]">Open ticker</Link><Link href={`/watchlist?add=${encodeURIComponent(selected.ticker)}`} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-ink">Watch</Link></div>
            </TickerQuickSheet>
          </div>
        </div>
      )}
    </div>
  );
}
