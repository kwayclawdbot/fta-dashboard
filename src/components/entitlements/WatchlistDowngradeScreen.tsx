"use client";

import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { FIC_CHECKOUT_URL } from "@/lib/free-class";
import { WATCHLIST_FREE_ACTIVE } from "@/lib/entitlements";

/**
 * Watchlist DOWNGRADE screen (MONETIZATION-GATES.md "DOWNGRADE = PRESERVE, NEVER
 * DELETE"). Shown to a free/lapsed member who still has saved watchlist tickers
 * — nothing is ever deleted; monitoring is PAUSED above the free active cap.
 * Their data is the reason to come back, and this screen IS the Sept 6–8
 * (challenge-pass expiry) conversion moment.
 *
 * Copy is the ratified template: "26 stocks saved · Your free plan actively
 * monitors 5 · Upgrade to reactivate Kai Watch for all 26."
 *
 * The active subset is the OLDEST `WATCHLIST_FREE_ACTIVE` tickers (the names held
 * longest stay live); the rest are preserved but paused.
 */
export interface DowngradeItem {
  id: string;
  ticker: string;
  company_name: string;
  created_at: string;
}

export default function WatchlistDowngradeScreen({
  items,
}: {
  items: DowngradeItem[];
}) {
  const saved = items.length;
  const cap = WATCHLIST_FREE_ACTIVE;
  // Oldest-first → the first `cap` are actively monitored, the rest preserved.
  const byAge = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const activeIds = new Set(byAge.slice(0, cap).map((i) => i.id));
  const monitored = Math.min(saved, cap);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="paper-card p-6">
        <span className="text-[11px] font-display font-bold uppercase tracking-[0.14em] text-gold-700">
          Your watchlist is safe
        </span>
        <h1 className="mt-1.5 font-display text-2xl font-bold text-ink">
          {saved} {saved === 1 ? "stock" : "stocks"} saved · Your free plan
          actively monitors {monitored}
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-soft">
          Nothing was deleted. Upgrade to reactivate Kai Watch for all {saved} —
          custom alerts, community deltas, news summaries and sentiment shifts on
          every ticker.
        </p>
        <a
          href={FIC_CHECKOUT_URL}
          className="cta-button mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px]"
        >
          Reactivate for all {saved} — join the Club <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      <ul className="mt-5 space-y-2">
        {byAge.map((it) => {
          const active = activeIds.has(it.id);
          return (
            <li
              key={it.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                active
                  ? "border-sand bg-card"
                  : "border-sand/60 bg-transparent opacity-70"
              }`}
            >
              {active ? (
                <Eye className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <EyeOff className="h-4 w-4 shrink-0 text-soft" />
              )}
              <span className="font-display font-semibold text-ink">
                {it.ticker}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-soft">
                {it.company_name}
              </span>
              <span
                className={`shrink-0 text-xs font-medium ${
                  active ? "text-green-600" : "text-soft"
                }`}
              >
                {active ? "Monitored" : "Monitoring paused"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
