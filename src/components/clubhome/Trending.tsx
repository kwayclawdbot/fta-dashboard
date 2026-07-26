"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { Card, CardHead, Delta } from "./parts";
import type { TrendingResponse } from "@/lib/clubhome/contract";

/**
 * §6 Trending in the Club — a ranked ATTENTION table (mock-faithful: ticker +
 * Club Score + change delta, clean rows, no gainer bars). Club Score = weighted
 * community attention (research views, watchlist adds, comments, unique
 * participants, saves, searches, Kai questions, sentiment activity). Carries the
 * compliance line in the UI: attention inside the Club, NOT a recommendation.
 */

export default function Trending({ trending }: { trending: TrendingResponse | null }) {
  const rows = trending?.rows ?? [];
  if (rows.length === 0) return null;

  return (
    <Card aria-label="Trending in the Club">
      <CardHead
        title="Trending in the Club"
        action={
          <Link href="/discover" className="text-xs font-semibold text-volt-700 hover:text-volt-800">
            View all
          </Link>
        }
      />

      <div className="mt-3 flex items-center justify-between border-b border-sand pb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-soft">Ticker</span>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-soft">
          Club Score
          <span title="Weighted community attention — research views, watchlist adds, comments, saves, searches, Kai questions and sentiment activity.">
            <Info className="h-3 w-3" />
          </span>
        </span>
      </div>

      <ol className="divide-y divide-sand">
        {rows.map((r) => (
          <li key={r.ticker}>
            <Link
              href={`/research/${encodeURIComponent(r.ticker)}`}
              className="group club-row -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2.5"
            >
              <span className="w-3.5 shrink-0 font-mono text-xs font-bold tabular-nums text-soft">{r.rank}</span>
              <CompanyLogo symbol={r.ticker} name={r.company} size={24} />
              <span className="min-w-0 flex-1 truncate font-display text-sm font-bold text-ink group-hover:text-volt-700">
                {r.ticker}
              </span>
              <span className="shrink-0 font-mono text-base font-extrabold tabular-nums text-ink">{r.score}</span>
              <span className="w-11 shrink-0 text-right">
                <Delta value={r.change} />
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <p className="mt-2.5 text-[11px] italic text-soft">Attention inside the Club — not a recommendation.</p>
    </Card>
  );
}
