"use client";

import { m } from "@/lib/motion";
import { Sparkles } from "lucide-react";
import type { PortfolioState } from "@/lib/simulator/portfolio-manager";
import { getEquity, getWinRate, getReturnPct } from "@/lib/simulator/portfolio-manager";

/**
 * THE PRACTICE PORTFOLIO — the one dark object on the Practice surface.
 *
 * `.f0-hero-field` is deliberately obsidian in BOTH themes and sets its own
 * cream foreground, so everything inside inherits that colour: no literal hex,
 * no bg-white, no text-ink (which flips near-white at night and would vanish).
 * Secondary type is the inherited cream at reduced opacity, and the measure
 * hairlines are white at 15% — all of it reads identically on the cream page
 * and on the night page.
 *
 * COLOUR LAW: the return is a PRICE number, so it is the only coloured thing
 * here. On an always-obsidian field the canonical `text-price-up/-down` tokens
 * can't be used — their LIGHT step (#15803D / #B91C1C) is chosen for the cream
 * page and fails on obsidian — so the field takes the dark steps of the same
 * ramp in both themes, exactly as WatchlistPerformance does inside its hero.
 * Flat is not coloured at all: a $0 move is not a win.
 *
 * HONESTY: win rate shows "—" until a trade has actually closed, and the weekly
 * read below is computed from the member's own closed trades or is not rendered.
 */

interface PortfolioSummaryProps {
  state: PortfolioState;
}

const money = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Deterministic weekly read, derived only from the member's own closed sim
// trades (no fabricated club snapshot). Hidden until there's enough to say
// something honest. Ratio of average win to average loss is the spine — the
// same "you cut winners early / your losers run" read a coach would give.
function weeklyRead(state: PortfolioState): string | null {
  const closed = state.trades;
  if (closed.length < 3) return null;

  const pcts = closed.map((t) => {
    if (t.entryPrice <= 0) return 0;
    const dir = t.side === "long" ? 1 : -1;
    return ((t.exitPrice - t.entryPrice) / t.entryPrice) * 100 * dir;
  });
  const wins = pcts.filter((p) => p > 0);
  const losses = pcts.filter((p) => p < 0).map((p) => Math.abs(p));
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  const winRate = getWinRate(state);

  if (avgLoss > 0 && avgLoss > avgWin * 1.2)
    return "Your losers are running bigger than your winners. Tighten stops — cut losses faster than you let gains go.";
  if (avgWin > 0 && avgWin > avgLoss * 1.5)
    return "You size winners well and keep losses small. Keep running that ratio.";
  if (winRate >= 60)
    return `Strong hit rate this week — ${winRate}% of your closes came back green. Consistency is showing.`;
  return "Risk and reward are running about even. Focus on letting winners breathe before you close them.";
}

export default function PortfolioSummary({ state }: PortfolioSummaryProps) {
  const equity = getEquity(state);
  const winRate = getWinRate(state);
  const returnPct = getReturnPct(state);
  const unrealizedPnl = state.positions.reduce((sum, p) => sum + (p.unrealizedPnl ?? 0), 0);
  const read = weeklyRead(state);

  const flat = state.totalPnl === 0;
  const up = state.totalPnl > 0;
  const tone = flat ? "opacity-70" : up ? "text-green-400" : "text-red-500";

  const measures: { label: string; value: string; tone?: string }[] = [
    { label: "Cash", value: `$${money(state.balance)}` },
    {
      label: "Open P&L",
      value: `${unrealizedPnl > 0 ? "+" : ""}$${money(unrealizedPnl)}`,
      tone:
        unrealizedPnl === 0
          ? undefined
          : unrealizedPnl > 0
            ? "text-green-400"
            : "text-red-500",
    },
    { label: "Win rate", value: state.totalTrades > 0 ? `${winRate}%` : "—" },
    { label: "Closed", value: state.totalTrades > 0 ? `${state.totalTrades}` : "—" },
  ];

  return (
    <div className="space-y-4">
      <m.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="f0-hero-field f0-grain px-5 py-7 sm:px-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="min-w-0">
            <p className="text-eyebrow font-display font-bold uppercase opacity-70">
              Practice portfolio
            </p>
            <p className="mt-3 font-mono text-[40px] font-bold leading-[0.95] tracking-tight tabular-nums sm:text-[48px]">
              ${money(equity)}
            </p>
            <p className={`mt-2.5 font-mono text-[14px] font-semibold tabular-nums ${tone}`}>
              {flat ? "" : up ? "▲ +" : "▼ "}${money(state.totalPnl)}
              <span className="ml-1.5 opacity-65">
                ({returnPct >= 0 ? "+" : ""}
                {returnPct}%) all time
              </span>
            </p>
          </div>

          {/* Measure strip — hairlines, not tiles. */}
          <div className="flex items-stretch">
            {measures.map((mm, i) => (
              <div
                key={mm.label}
                className={`min-w-0 ${
                  i > 0 ? "border-l border-white/15 pl-4 sm:pl-5" : ""
                } ${i < measures.length - 1 ? "pr-4 sm:pr-5" : ""}`}
              >
                <p
                  className={`font-mono text-[17px] font-semibold tabular-nums ${mm.tone ?? ""}`}
                >
                  {mm.value}
                </p>
                <p className="mt-1.5 text-eyebrow font-display font-bold uppercase opacity-60">
                  {mm.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </m.section>

      {/* Kai reviewed your week — Kai blue by law (this is the AI voice), a
          ruled note on the page rather than a second boxed card. */}
      {read && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border-l-[3px] border-kai-500 py-1 pl-3.5 dark:border-kai-400"
        >
          <p className="flex items-center gap-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-kai-600 dark:text-kai-300">
            <Sparkles className="h-3 w-3" />
            Kai reviewed your week
          </p>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-soft">{read}</p>
        </m.div>
      )}
    </div>
  );
}
