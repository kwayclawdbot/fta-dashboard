"use client";

import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { FIC_CHECKOUT_URL } from "@/lib/free-class";
import { WATCHLIST_FREE_ACTIVE } from "@/lib/entitlements";
import { BrandTile } from "@/components/clubhome/board";

/**
 * Watchlist DOWNGRADE screen (MONETIZATION-GATES.md "DOWNGRADE = PRESERVE, NEVER
 * DELETE"). Shown to a free/lapsed member who still has saved watchlist tickers
 * — nothing is ever deleted; monitoring is PAUSED above the free active cap.
 * Their data is the reason to come back, and this screen IS the Sept 6–8
 * (challenge-pass expiry) conversion moment.
 *
 * Copy is the ratified template: "26 stocks saved · Your free plan actively
 * monitors 5 · Upgrade to reactivate Kai Watch for all 26." Every word of it is
 * byte-identical to the version before this restyle — only the container moved.
 *
 * The active subset is the OLDEST `WATCHLIST_FREE_ACTIVE` tickers (the names held
 * longest stay live); the rest are preserved but paused.
 *
 * CANVAS v2: the offer was the pre-canvas paper card with a gradient `.cta-button`, and the
 * saved list was a stack of bordered rows with GREEN "Monitored" text. It is now
 * the board's commercial object — one warm tinted card (`.club-b-warm`) carrying
 * the eyebrow, the headline, the lede and a full-width solid orange button —
 * over the board's white `.club-b-card` rows, each led by its company's own brand
 * tile. COLOUR LAW: green/red is PRICE, and "monitored" is not a price, so the
 * live subset reads in the action colour and the paused names read in `soft`.
 *
 * TWO VARIANTS (same words, different job):
 *   "page"   — the original takeover: the offer block over the full list of
 *              saved tickers. Still used where there is no board to stand on.
 *   "inline" — the offer block ONLY, dropped into the working watchlist under
 *              the board head. A primary surface meters, it never walls, so the
 *              free member now gets the real board — and the board IS the
 *              ticker list. Reprinting `<ul>` here would print every name twice
 *              on one screen, so the inline variant carries the message and lets
 *              the board below it carry the evidence (each paused row wears its
 *              own "Monitoring paused" chip).
 * Every string is byte-identical across both.
 */
export interface DowngradeItem {
  id: string;
  ticker: string;
  company_name: string;
  created_at: string;
}

export default function WatchlistDowngradeScreen({
  items,
  variant = "page",
}: {
  items: DowngradeItem[];
  /** "page" = the takeover (default). "inline" = the offer block alone. */
  variant?: "page" | "inline";
}) {
  const saved = items.length;
  const cap = WATCHLIST_FREE_ACTIVE;
  // Oldest-first → the first `cap` are actively monitored, the rest preserved.
  const byAge = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const activeIds = new Set(byAge.slice(0, cap).map((i) => i.id));
  const monitored = Math.min(saved, cap);
  // Inline the block sits inside a page that already owns its <h1> (the board
  // lead), so the headline steps down a level. Same words, same type.
  const Head = variant === "inline" ? "h2" : "h1";

  const offer = (
    <section className="club-b-warm f0-grain px-5 py-6 sm:px-6">
      <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent">
        Your watchlist is safe
      </p>
      <Head className="mt-2 font-display text-[24px] font-extrabold uppercase leading-[1.08] text-ink">
        {saved} {saved === 1 ? "stock" : "stocks"} saved · Your free plan
        actively monitors {monitored}
      </Head>
      <p className="mt-2.5 max-w-[52ch] text-[13.5px] leading-relaxed text-soft">
        Nothing was deleted. Upgrade to reactivate Kai Watch for all {saved} —
        custom alerts, community deltas, news summaries and sentiment shifts on
        every ticker.
      </p>
      <a
        href={FIC_CHECKOUT_URL}
        className="f0-focus f0-press mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 font-display text-[14.5px] font-extrabold uppercase tracking-[0.05em] text-[color:var(--accent-on)]"
      >
        Reactivate for all {saved} — join the Club <ArrowRight className="h-4 w-4" />
      </a>
    </section>
  );

  // The working board below is the ticker list — see the doc comment.
  if (variant === "inline") return <div className="mt-5">{offer}</div>;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      {offer}

      <ul className="mt-5 flex flex-col gap-[7px]">
        {byAge.map((it) => {
          const active = activeIds.has(it.id);
          return (
            <li
              key={it.id}
              className={`club-b-card flex items-center gap-2.5 px-3 py-[10px] ${
                active ? "" : "opacity-70"
              }`}
            >
              <BrandTile ticker={it.ticker} size={26} radius={8} fontSize={11} />
              <span className="shrink-0 font-mono text-[11px] font-semibold text-ink">
                {it.ticker}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-soft">
                {it.company_name}
              </span>
              <span
                className={`f0-chip inline-flex shrink-0 items-center gap-1 px-2 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] ${
                  active ? "text-accent" : "text-soft"
                }`}
              >
                {active ? (
                  <Eye className="h-3 w-3" aria-hidden />
                ) : (
                  <EyeOff className="h-3 w-3" aria-hidden />
                )}
                {active ? "Monitored" : "Monitoring paused"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
