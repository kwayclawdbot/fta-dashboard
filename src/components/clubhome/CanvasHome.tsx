"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import CompanyLogo from "@/components/fic/CompanyLogo";
import type {
  BriefResponse,
  PulseResponse,
  TrendingResponse,
  ForYouResponse,
} from "@/lib/clubhome/contract";
import { Card, Spark, Delta } from "./parts";

/**
 * Canvas Home — board 01 rebuilt pixel-faithful to `.planning/design-project/
 * Cheat Code Club - App UI.dc.html` ("Home" artboard). Composition, top → bottom:
 *
 *   · TOP IN THE CLUB   — numbered ticker chips (rank · ticker · price · %)
 *   · MARKET BRIEF      — dark banner + Sora headline + delta bullets + read-all
 *   · WHAT'S MOVING     — row list (logo · ticker · why · sparkline · % pill)
 *   · RISING IN THE CLUB— compact momentum chips
 *
 * Everything reads from the live club-data contract (trending / brief / pulse /
 * foryou). No fabricated numbers: a price/percent only renders when the feed
 * actually carries it. Each section has a designed founding fallback so a sparse
 * club is never an empty rectangle. Kid register is handled upstream (sentiment
 * already stripped from `brief`/`pulse`/`foryou` before they reach here).
 */

/* price/% lookup joined onto a ticker. Market marks (price/changePct) come from
   the ForYou feed — the only contract surface carrying them; inline sparklines
   come from Pulse. Trending only ranks the community, so a chip's price/% renders
   ONLY when ForYou actually supplies it (never fabricated). */
type Mark = { price?: number | null; changePct?: number | null; spark?: number[] };
function buildMarks(
  pulse?: PulseResponse | null,
  foryou?: ForYouResponse | null,
): Map<string, Mark> {
  const m = new Map<string, Mark>();
  for (const it of foryou?.items ?? []) {
    if (!it.ticker) continue;
    m.set(it.ticker, { price: it.price, changePct: it.changePct });
  }
  for (const s of pulse?.signals ?? []) {
    if (!s.ticker || !s.spark) continue;
    const cur = m.get(s.ticker) ?? {};
    m.set(s.ticker, { ...cur, spark: s.spark });
  }
  return m;
}

function fmtPrice(p?: number | null): string | null {
  if (p == null || !Number.isFinite(p)) return null;
  return `$${p.toFixed(2)}`;
}

/* ── TOP IN THE CLUB ─────────────────────────────────────────────────────── */
function TopInClub({
  trending,
  marks,
}: {
  trending?: TrendingResponse | null;
  marks: Map<string, Mark>;
}) {
  const rows = (trending?.rows ?? []).slice(0, 4);
  const total = trending?.rows?.length ?? 0;

  return (
    <section aria-labelledby="top-in-club">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2
          id="top-in-club"
          className="font-display text-[13px] font-bold uppercase tracking-[0.14em] text-ink"
        >
          Top in the Club
        </h2>
        {total > 4 && (
          <Link
            href="/discover"
            className="inline-flex items-center gap-1 font-display text-[13px] font-bold text-volt-700 hover:text-volt-600"
          >
            See all {total} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <Card className="!p-4 text-sm text-soft">
          The Club&apos;s top tickers appear here as members research. Be an early
          voice — rate a ticker to seed the board.
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {rows.map((r) => {
            const mk = marks.get(r.ticker);
            const price = fmtPrice(mk?.price);
            const pct = mk?.changePct;
            return (
              <Link
                key={r.ticker}
                href={`/research/${encodeURIComponent(r.ticker)}`}
                className="flex flex-col rounded-2xl border border-sand bg-card p-3.5 shadow-soft transition-colors hover:border-volt-400"
              >
                <span className="font-mono text-xs font-semibold text-soft">{r.rank}</span>
                <span className="mt-1 font-display text-[19px] font-extrabold tracking-tight text-ink">
                  {r.ticker}
                </span>
                {price ? (
                  <span className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-ink">
                    {price}
                  </span>
                ) : (
                  <span className="mt-0.5 font-mono text-xs text-soft">
                    score {Math.round(r.score)}
                  </span>
                )}
                <span className="mt-1.5">
                  {pct != null ? (
                    <Delta value={Number(pct.toFixed(2))} suffix="%" />
                  ) : (
                    <Delta value={Number((r.change ?? 0).toFixed(0))} />
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── MARKET BRIEF ────────────────────────────────────────────────────────── */
function MarketBrief({ brief }: { brief?: BriefResponse | null }) {
  const items = brief?.items ?? [];
  const available = brief?.available ?? false;
  const derived = brief?.source === "derived";
  const headline = items[0]?.text ?? null;
  const bullets = items.slice(1, 3);

  return (
    <Card className="!p-0 overflow-hidden">
      {/* dark market banner — honest brand gradient, not a stock photo */}
      <div className="relative h-32 w-full club-brief-banner sm:h-40">
        <div className="absolute inset-0 club-brief-grid" aria-hidden />
      </div>
      <div className="p-5">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-soft">
          Market Brief
        </p>
        {available && headline ? (
          <>
            <h3 className="mt-2 font-display text-[26px] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-[30px]">
              {headline}
            </h3>
            <ul className="mt-3 space-y-1.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-[15px] text-soft">
                  <span aria-hidden className="text-volt-600">·</span>
                  <span className="min-w-0">
                    {b.ticker ? (
                      <span className="font-semibold text-ink">{b.ticker} </span>
                    ) : null}
                    {b.text}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/kai?intent=brief"
              className="mt-4 inline-flex items-center gap-1 font-display text-[15px] font-bold text-volt-700 hover:text-volt-600"
            >
              Read full brief <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <>
            <h3 className="mt-2 font-display text-[24px] font-extrabold leading-[1.12] tracking-tight text-ink sm:text-[28px]">
              {derived
                ? "Today's brief, straight from the tape."
                : "Kai's full brief is refreshing."}
            </h3>
            <p className="mt-3 text-[15px] text-soft">
              {derived
                ? "A live AI summary is temporarily unavailable — this brief is derived directly from the Club's research flow and market data."
                : "The morning brief updates through the day. Check back shortly, or ask Kai directly."}
            </p>
            {items.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {items.slice(0, 3).map((b, i) => (
                  <li key={i} className="flex gap-2 text-[15px] text-soft">
                    <span aria-hidden className="text-volt-600">·</span>
                    <span className="min-w-0">
                      {b.ticker ? <span className="font-semibold text-ink">{b.ticker} </span> : null}
                      {b.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/kai"
              className="mt-4 inline-flex items-center gap-1 font-display text-[15px] font-bold text-volt-700 hover:text-volt-600"
            >
              Ask Kai <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        )}
      </div>
    </Card>
  );
}

/* ── WHAT'S MOVING ───────────────────────────────────────────────────────── */
function WhatsMoving({
  pulse,
  marks,
}: {
  pulse?: PulseResponse | null;
  marks: Map<string, Mark>;
}) {
  const rows = (pulse?.signals ?? []).slice(0, 3);
  if (rows.length === 0) {
    return (
      <section aria-labelledby="whats-moving">
        <h2 id="whats-moving" className="mb-3 font-display text-[13px] font-bold uppercase tracking-[0.14em] text-ink">
          What&apos;s moving
        </h2>
        <Card className="!p-4 text-sm text-soft">
          Live movers surface here as the Club reacts to the tape.
        </Card>
      </section>
    );
  }
  return (
    <section aria-labelledby="whats-moving">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="whats-moving" className="font-display text-[13px] font-bold uppercase tracking-[0.14em] text-ink">
          What&apos;s moving
        </h2>
        <Link href="/discover" className="inline-flex items-center gap-1 font-display text-[13px] font-bold text-volt-700 hover:text-volt-600">
          See more <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="space-y-3">
        {rows.map((s) => {
          const pct = marks.get(s.ticker)?.changePct ?? null;
          const up = pct != null ? pct >= 0 : s.direction !== "down";
          return (
            <Link
              key={s.ticker}
              href={`/research/${encodeURIComponent(s.ticker)}`}
              className="flex items-center gap-3 rounded-2xl border border-sand bg-card p-3.5 shadow-soft transition-colors hover:border-volt-400"
            >
              <CompanyLogo symbol={s.ticker} name={s.company} size={44} rounded="rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[16px] font-extrabold tracking-tight text-ink">{s.ticker}</p>
                <p className="truncate text-[14px] text-soft">{s.detail || s.headline}</p>
              </div>
              {s.spark && s.spark.length > 1 && (
                <Spark series={s.spark} tone={up ? "volt" : "down"} width={72} height={30} />
              )}
              {pct != null && (
                <span
                  className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-sm font-extrabold tabular-nums ${
                    up ? "bg-green-500/12 text-green-600" : "bg-red-500/12 text-red-600"
                  }`}
                >
                  {up ? "▲" : "▼"}{Math.abs(Number(pct.toFixed(2)))}%
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ── RISING IN THE CLUB ──────────────────────────────────────────────────── */
function RisingInClub({
  trending,
  marks,
}: {
  trending?: TrendingResponse | null;
  marks: Map<string, Mark>;
}) {
  // momentum tail: tickers past the top-4 with a positive community delta
  const rows = (trending?.rows ?? [])
    .slice(4)
    .filter((r) => (r.change ?? 0) > 0)
    .slice(0, 4);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="rising-in-club">
      <h2 id="rising-in-club" className="mb-3 font-display text-[13px] font-bold uppercase tracking-[0.14em] text-ink">
        Rising in the Club
      </h2>
      <div className="flex flex-wrap gap-2.5">
        {rows.map((r) => {
          const pct = marks.get(r.ticker)?.changePct;
          return (
            <Link
              key={r.ticker}
              href={`/research/${encodeURIComponent(r.ticker)}`}
              className="inline-flex items-center gap-2 rounded-full border border-sand bg-card px-3.5 py-2 shadow-soft transition-colors hover:border-volt-400"
            >
              <span className="font-display text-[15px] font-extrabold tracking-tight text-ink">{r.ticker}</span>
              <span className="font-mono text-xs font-extrabold tabular-nums text-green-600">
                ▲{pct != null ? `${Math.abs(Number(pct.toFixed(0)))}%` : Math.round(r.change)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ── the board ───────────────────────────────────────────────────────────── */
export default function CanvasHome({
  trending,
  brief,
  pulse,
  foryou,
}: {
  trending?: TrendingResponse | null;
  brief?: BriefResponse | null;
  pulse?: PulseResponse | null;
  foryou?: ForYouResponse | null;
}) {
  const marks = buildMarks(pulse, foryou);
  return (
    <div className="space-y-7">
      <TopInClub trending={trending} marks={marks} />
      <MarketBrief brief={brief} />
      <WhatsMoving pulse={pulse} marks={marks} />
      <RisingInClub trending={trending} marks={marks} />
    </div>
  );
}
