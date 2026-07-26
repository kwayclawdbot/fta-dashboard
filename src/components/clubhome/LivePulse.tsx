"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { fetchQuotes, type MarketQuote } from "@/lib/market/client";
import { SectionLabel, Spark } from "./parts";
import type { PulseResponse, PulseSignal } from "@/lib/clubhome/contract";

/**
 * §2 Live Pulse (hero) — ABSORBS the old "Today in the Club" masthead into one
 * hero (no two competing heroes). It answers "what is the Club seeing right
 * now" with the 3–4 strongest COMMUNITY signals (most-researched, new watchers,
 * sentiment shift, Kai pattern) — community behavior, not market movers —
 * composed as ruled columns inside one masthead object, with sparkline accents.
 * The delayed-index strip keeps the hero alive even for a brand-new member.
 */

const INDICES = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq" },
  { symbol: "DIA", label: "Dow" },
];

function pctText(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function pctClass(v: number | null | undefined) {
  if (v == null) return "text-soft";
  return v > 0 ? "text-green-600" : v < 0 ? "text-red-500" : "text-soft";
}

function sparkTone(d?: PulseSignal["direction"]) {
  return d === "down" ? "down" : d === "flat" ? "flat" : "volt";
}

export default function LivePulse({
  pulse,
  isKid,
}: {
  pulse: PulseResponse | null;
  isKid: boolean;
}) {
  const [quotes, setQuotes] = useState<Record<string, MarketQuote> | null>(null);

  useEffect(() => {
    if (isKid) return;
    let mounted = true;
    fetchQuotes(INDICES.map((i) => i.symbol))
      .then((q) => mounted && setQuotes(q))
      .catch(() => mounted && setQuotes({}));
    return () => {
      mounted = false;
    };
  }, [isKid]);

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const signals = pulse?.signals ?? [];
  const marketOk = quotes && Object.keys(quotes).length > 0;

  return (
    <section
      aria-label="Live pulse — what the Club is seeing today"
      data-tour="club-pulse"
      className="club-field-pulse overflow-hidden rounded-2xl px-5 py-5 shadow-soft sm:px-7 sm:py-6"
    >
      {/* Masthead line */}
      <div className="flex items-center justify-between gap-3">
        <SectionLabel tone="volt" live liveTone="volt" charged>
          Live Pulse
        </SectionLabel>
        <span className="font-mono text-[11px] text-soft">{dateLabel}</span>
      </div>

      <h2 className="mt-2 font-display text-2xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-[28px]">
        What the Club is seeing today
      </h2>

      {/* Delayed index strip (adults) — inline mono %, hairline-bounded, not boxed */}
      {!isKid && (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-sand pt-3">
          {INDICES.map((idx) => (
            <span key={idx.symbol} className="inline-flex items-baseline gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-soft">
                {idx.label}
              </span>
              {quotes == null ? (
                <span className="inline-block h-3 w-10 animate-pulse rounded bg-sand align-middle" />
              ) : (
                <span className={`font-mono text-sm font-bold tabular-nums ${pctClass(quotes[idx.symbol]?.changePercent)}`}>
                  {pctText(quotes[idx.symbol]?.changePercent)}
                </span>
              )}
            </span>
          ))}
          {marketOk && (
            <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-soft">
              markets delayed
            </span>
          )}
        </div>
      )}

      {/* Signals — ruled columns on desktop, hairline rows on mobile */}
      <div className="mt-4 border-t border-sand pt-1">
        {/* desktop: divided columns */}
        <div
          className="hidden divide-x divide-sand sm:grid"
          style={{ gridTemplateColumns: `repeat(${Math.max(signals.length, 1)}, minmax(0, 1fr))` }}
        >
          {signals.map((s, i) => (
            <Link
              key={`${s.ticker}-${i}`}
              href={`/research/${encodeURIComponent(s.ticker)}`}
              className="group club-rise relative flex flex-col gap-2 px-5 pt-4 first:pl-0 last:pr-0"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {i === 0 && (
                <span className="club-hero-gradient absolute left-0 top-4 h-6 w-[3px] rounded-full" />
              )}
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-volt-600 tabular-nums">
                  {i + 1}
                </span>
                <CompanyLogo symbol={s.ticker} name={s.company} size={20} />
                <span className="font-display text-sm font-bold text-ink group-hover:text-volt-700">
                  {s.ticker}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{s.headline}</p>
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-soft">
                  {s.detail}
                </p>
              </div>
              {s.spark && (
                <div className="mt-auto pt-1">
                  <Spark series={s.spark} tone={sparkTone(s.direction)} width={110} height={30} />
                </div>
              )}
            </Link>
          ))}
        </div>

        {/* mobile: hairline rows */}
        <div className="divide-y divide-sand sm:hidden">
          {signals.map((s, i) => (
            <Link
              key={`m-${s.ticker}-${i}`}
              href={`/research/${encodeURIComponent(s.ticker)}`}
              className="flex items-center gap-3 py-3"
            >
              <span className="font-mono text-xs font-bold text-volt-600 tabular-nums">{i + 1}</span>
              <CompanyLogo symbol={s.ticker} name={s.company} size={26} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{s.ticker}</p>
                <p className="truncate text-[12px] text-soft">{s.headline}</p>
              </div>
              {s.spark && <Spark series={s.spark} tone={sparkTone(s.direction)} width={72} height={26} />}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
