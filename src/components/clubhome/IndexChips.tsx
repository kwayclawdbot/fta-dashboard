"use client";

import { useEffect, useState } from "react";

import { signedPct, toneFor } from "./board";

/**
 * INDEX CHIPS — the row of three market chips on board 01's digest card.
 *
 * The board draws `SPY ▲1.02%` · `QQQ ▲1.35%` · `VIX ▼4.21%`. Two of those
 * three are shipped verbatim. The third is NOT:
 *
 *   VIX is an INDEX, not an equity, and index snapshots come from Polygon's
 *   /v3/snapshot/indices — which this account's plan is not entitled to
 *   (verified against the live key: NOT_AUTHORIZED). `normalizeSymbol` in the
 *   market client also rejects the `I:VIX` form outright. So the third chip is
 *   IWM, the small-cap benchmark: a real ticker on the same entitled equity
 *   snapshot as the other two, labelled as what it actually is. Printing "VIX"
 *   over a volatility-ETF proxy would be a made-up label on real numbers, which
 *   is the same lie as a made-up number.
 *
 * The quotes ride /api/market/quote, which batches symbols into ONE Polygon
 * snapshot and caches ~60s at the CDN — the same route the rest of the app's
 * price marks come through.
 *
 * LOADING ≠ EMPTY: in flight the chips render their symbols with a pulsing
 * numeral slot, so the row keeps its shape and never claims the market is
 * missing. A failed or unconfigured feed renders an em dash, never 0.00%.
 */

const SYMBOLS = ["SPY", "QQQ", "IWM"] as const;

interface QuoteLite {
  changePercent: number | null;
}

export default function IndexChips() {
  const [quotes, setQuotes] = useState<Record<string, QuoteLite> | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    let live = true;
    void (async () => {
      try {
        const res = await fetch(
          `/api/market/quote?symbols=${SYMBOLS.join(",")}`,
          { signal: ctrl.signal, headers: { accept: "application/json" } }
        );
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as {
          quotes?: Record<string, QuoteLite>;
        };
        if (live) setQuotes(json.quotes ?? {});
      } catch {
        if (live) setQuotes({});
      } finally {
        if (live) setSettled(true);
      }
    })();
    return () => {
      live = false;
      ctrl.abort();
    };
  }, []);

  return (
    <div className="mt-3 flex flex-wrap gap-[7px]" aria-busy={!settled}>
      {SYMBOLS.map((sym) => {
        const pct = quotes?.[sym]?.changePercent ?? null;
        return (
          <span
            key={sym}
            className="club-b-chip inline-flex items-center gap-1 px-2 py-[3px] font-mono text-[9.5px] text-soft"
          >
            {sym}
            {!settled ? (
              <span
                className="inline-block h-2 w-8 rounded-full bg-ink/10 motion-safe:animate-pulse"
                aria-hidden
              />
            ) : (
              <span className={toneFor(pct)}>{signedPct(pct)}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
