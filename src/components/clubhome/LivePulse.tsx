"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowUp } from "lucide-react";
import CompanyLogo from "@/components/fic/CompanyLogo";
import { SectionLabel, Spark } from "./parts";
import type { PulseResponse, PulseSignal } from "@/lib/clubhome/contract";

/**
 * §2 Live Pulse (hero) — mock-faithful. An editorial "LIVE PULSE / What the Club
 * is seeing today" masthead with carousel arrows, then the row of ticker signal
 * CARDS (the #1-ranked card carries the volt outline). Community behavior, not
 * market movers — most-researched, new watchers, sentiment shift, Kai pattern —
 * each with a saturated orange sparkline. On mobile it collapses to a compact
 * ranked list (the phone mock).
 */

function sparkTone(d?: PulseSignal["direction"]) {
  return d === "down" ? "down" : d === "flat" ? "flat" : "volt";
}

function PulseCard({ s, rank, lead }: { s: PulseSignal; rank: number; lead: boolean }) {
  return (
    <Link
      href={`/research/${encodeURIComponent(s.ticker)}`}
      className={`club-rise group relative flex min-w-0 snap-start flex-col overflow-hidden rounded-2xl bg-card p-4 shadow-soft transition-transform hover:-translate-y-0.5 ${
        lead ? "border-[1.5px] border-volt-500" : "border border-sand"
      }`}
      style={{ animationDelay: `${(rank - 1) * 70}ms` }}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-bold tabular-nums text-volt-600">{rank}</span>
        <CompanyLogo symbol={s.ticker} name={s.company} size={22} />
        <span className="font-display text-sm font-extrabold tracking-tight text-ink group-hover:text-volt-700">
          {s.ticker}
        </span>
      </div>

      <p className="mt-2.5 text-[13px] font-bold leading-snug text-ink">{s.headline}</p>
      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] leading-snug text-soft">
        {s.direction === "up" && <ArrowUp className="h-3 w-3 text-volt-600" />}
        <span className="line-clamp-2">{s.detail}</span>
      </p>

      {s.spark && (
        <div className="pointer-events-none mt-3 flex justify-end pt-1">
          <Spark series={s.spark} tone={sparkTone(s.direction)} width={150} height={40} />
        </div>
      )}
    </Link>
  );
}

export default function LivePulse({
  pulse,
}: {
  pulse: PulseResponse | null;
  isKid: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const signals = pulse?.signals ?? [];
  if (signals.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = rowRef.current;
    if (el) el.scrollBy({ left: dir * (el.clientWidth * 0.7), behavior: "smooth" });
  };

  return (
    <section aria-label="Live pulse — what the Club is seeing today" data-tour="club-pulse">
      <div className="flex items-end justify-between gap-3">
        <div>
          <SectionLabel tone="volt" live liveTone="volt" charged>
            Live Pulse
          </SectionLabel>
          <h2 className="mt-1.5 font-display text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-[28px]">
            What the Club is seeing today
          </h2>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Previous signals"
            className="grid h-8 w-8 place-items-center rounded-full border border-sand bg-card text-soft transition-colors hover:border-volt-400 hover:text-volt-700 active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="More signals"
            className="grid h-8 w-8 place-items-center rounded-full border border-sand bg-card text-soft transition-colors hover:border-volt-400 hover:text-volt-700 active:scale-95"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* desktop / tablet: even card grid (mock's 4-up), no overflow */}
      <div
        ref={rowRef}
        className="mt-4 hidden gap-4 sm:grid"
        style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(signals.length, 1), 4)}, minmax(0, 1fr))` }}
      >
        {signals.map((s, i) => (
          <PulseCard key={`${s.ticker}-${i}`} s={s} rank={i + 1} lead={i === 0} />
        ))}
      </div>

      {/* mobile: compact ranked list (phone mock) */}
      <ul className="mt-4 divide-y divide-sand rounded-2xl border border-sand bg-card px-4 shadow-soft sm:hidden">
        {signals.map((s, i) => (
          <li key={`m-${s.ticker}-${i}`}>
            <Link href={`/research/${encodeURIComponent(s.ticker)}`} className="flex items-center gap-3 py-3">
              <span className="font-mono text-xs font-bold tabular-nums text-volt-600">{i + 1}</span>
              <CompanyLogo symbol={s.ticker} name={s.company} size={26} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-ink">{s.ticker}</p>
                <p className="truncate text-[12px] text-soft">{s.headline}</p>
              </div>
              {s.spark && <Spark series={s.spark} tone={sparkTone(s.direction)} width={72} height={26} />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
