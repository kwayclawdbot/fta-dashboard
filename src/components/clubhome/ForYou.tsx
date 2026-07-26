"use client";

import Link from "next/link";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { Card, CardHead } from "./parts";
import { formatPrice } from "@/lib/market/client";
import type { ForYouResponse } from "@/lib/clubhome/contract";

/**
 * §9 For You — the bridge from network → me (mock-faithful price list). Per-member
 * deltas on watched tickers (new research, sentiment trend, watcher growth,
 * Kai/alert flags) with price + change. Links into research pages.
 */

function pct(v: number | null | undefined) {
  if (v == null) return { text: "—", tone: "text-soft" };
  const up = v > 0;
  return {
    text: `${up ? "+" : ""}${v.toFixed(2)}%`,
    tone: up ? "text-green-600" : v < 0 ? "text-red-500" : "text-soft",
  };
}

export default function ForYou({ foryou }: { foryou: ForYouResponse | null }) {
  const items = foryou?.items ?? [];
  if (items.length === 0) return null;

  return (
    <Card aria-label="For You">
      <CardHead
        title="For You"
        action={
          <Link href="/watchlist" className="text-xs font-semibold text-volt-700 hover:text-volt-800">
            Go to Watchlist
          </Link>
        }
      />
      <p className="mt-0.5 text-[12px] text-soft">From your watchlist</p>

      <ol className="mt-3 divide-y divide-sand">
        {items.map((it) => {
          const p = pct(it.changePct);
          return (
            <li key={it.ticker}>
              <Link
                href={`/research/${encodeURIComponent(it.ticker)}`}
                className="group club-row -mx-2 flex items-center gap-3 rounded-lg px-2 py-3"
              >
                <CompanyLogo symbol={it.ticker} name={it.company} size={28} />
                <div className="min-w-0 flex-1">
                  <span className="font-display text-sm font-bold text-ink group-hover:text-volt-700">{it.ticker}</span>
                  <p className="truncate text-[12px] text-soft">{it.delta}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-semibold tabular-nums text-ink">{formatPrice(it.price)}</div>
                  <div className={`font-mono text-xs font-bold tabular-nums ${p.tone}`}>{p.text}</div>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
