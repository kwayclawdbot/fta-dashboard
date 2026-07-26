"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { SectionLabel, Delta } from "./parts";
import type { TrendingResponse } from "@/lib/clubhome/contract";

/**
 * §6 Trending in the Club — a ranked ATTENTION ledger (not a top-gainers card,
 * not a card grid). Club Score = weighted community attention (research views,
 * watchlist adds, comments, unique participants, saves, searches, Kai questions,
 * sentiment activity). Volt = trending/action. Carries the compliance line in
 * the UI: attention inside the Club, NOT a recommendation.
 */

export default function Trending({ trending }: { trending: TrendingResponse | null }) {
  const rows = trending?.rows ?? [];
  if (rows.length === 0) return null;
  const maxScore = Math.max(...rows.map((r) => r.score), 1);

  return (
    <section aria-label="Trending in the Club">
      <SectionLabel
        tone="volt"
        action={
          <Link href="/discover" className="text-xs font-semibold text-volt-700 hover:text-volt-800">
            View all →
          </Link>
        }
      >
        Trending in the Club
      </SectionLabel>

      {/* column header + compliance */}
      <div className="mt-3 flex items-center justify-between border-b border-sand pb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-soft">Ticker</span>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-soft">
          Club Score
          <span title="Weighted community attention — research views, watchlist adds, comments, saves, searches, Kai questions and sentiment activity.">
            <Info className="h-3 w-3" />
          </span>
        </span>
      </div>

      <ol>
        {rows.map((r) => (
          <li key={r.ticker}>
            <Link
              href={`/research/${encodeURIComponent(r.ticker)}`}
              className="group flex items-center gap-3 border-b border-sand py-2.5 transition-colors hover:bg-card"
            >
              <span className="w-4 shrink-0 font-mono text-xs font-bold tabular-nums text-soft">
                {r.rank}
              </span>
              <CompanyLogo symbol={r.ticker} name={r.company} size={26} />
              <div className="min-w-0 flex-1">
                <span className="font-display text-sm font-bold text-ink group-hover:text-volt-700">
                  {r.ticker}
                </span>
                {r.company && (
                  <span className="ml-2 truncate text-[11px] text-soft">{r.company}</span>
                )}
                {/* attention meter — thin volt bar, not a card */}
                <div className="mt-1 h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-sand">
                  <div
                    className="h-full rounded-full bg-volt-500"
                    style={{ width: `${Math.round((r.score / maxScore) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 font-mono text-base font-bold tabular-nums text-ink">
                {r.score}
              </span>
              <span className="w-12 shrink-0 text-right">
                <Delta value={r.change} />
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <p className="mt-2 text-[11px] italic text-soft">
        Attention inside the Club — not a recommendation.
      </p>
    </section>
  );
}
