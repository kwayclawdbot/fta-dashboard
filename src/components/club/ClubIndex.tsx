"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import Ticker from "@/components/ui/Ticker";
import type { ClubIndexRow, IndexTrend } from "@/app/api/club/index/route";

/* ══════════════════════════════════════════════════════════════════════════
   CLUB INDEX — the Club's community-insight surface, built to the approved
   "Club Index" design language in `.planning` mockup v5 (`.index` / `.idx-*`).

   It is deliberately LIGHT and editorial — a ranked read of where the room
   stands, not a decision log: a header verdict ("The room is leaning bullish ·
   LIVE"), then ranked names, each with its logo (the shared Ticker primitive),
   a bull/bear split bar, a conviction %, and a warming / cooling / steady
   trend; a "what N members are on" social-proof line; and the compliance
   footnote. All of it wired to the real `ticker_intel_snapshots` rollup via
   /api/club/index.

   COLOUR LAW (outranks the mockup's green/red split where they disagree):
   green/red = PRICE only. Community sentiment takes the LIME ramp
   (--sentiment / --sentiment-fill); the bear side takes an ink tint. Warming is
   brand volt, cooling is teal, steady is soft. No price colour is ever spent on
   an opinion.

   FOUNDING HONESTY: below the room floor (INDEX_FLOORS) the endpoint returns
   `floorMet:false` and this renders a founding empty state — never a thin
   one-vote list dressed up as a verdict.
   ══════════════════════════════════════════════════════════════════════════ */

interface ClubIndexPayload {
  rows: ClubIndexRow[];
  verdict: string;
  positionedMembers: number;
  namesShown: number;
  floorMet: boolean;
  updatedAt: string | null;
  disclaimer: string;
}

/* The header's soft volt wash — token-driven so it flips with the theme. */
const HEADER_WASH: React.CSSProperties = {
  background:
    "radial-gradient(120% 160% at 0% 0%, color-mix(in srgb, var(--color-volt-500) 14%, transparent) 0%, transparent 48%)",
};

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgba(26,22,20,0.05),0_8px_22px_-12px_rgba(26,22,20,0.18)]";

export default function ClubIndex({ className = "" }: { className?: string }) {
  const [data, setData] = useState<ClubIndexPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/club/index", { signal: ctrl.signal, headers: { accept: "application/json" } })
      .then((res) => (res.ok ? (res.json() as Promise<ClubIndexPayload>) : null))
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  const disclaimer = data?.disclaimer ?? "Attention inside the Club — not a recommendation.";

  return (
    <section aria-labelledby="club-index-title" className={className}>
      <div className={`overflow-hidden rounded-[20px] border border-sand bg-card ${CARD_SHADOW}`}>
        {/* ── HEADER: the room verdict ── */}
        <header
          className="border-b border-sand px-5 pb-3.5 pt-4"
          style={HEADER_WASH}
        >
          <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-gold-700">
            Club Index
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <h2
              id="club-index-title"
              className="font-display text-[17px] font-extrabold leading-tight tracking-[-0.02em] text-ink"
            >
              {loading
                ? "Reading the room…"
                : data?.floorMet
                  ? data.verdict
                  : "The room is still finding its read"}
            </h2>
            {!loading && data?.floorMet && <LivePill />}
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-soft">
            {loading
              ? "Ranking the names the Club is positioned on"
              : data?.floorMet
                ? `Ranked by conviction · ${data.positionedMembers.toLocaleString()} ${
                    data.positionedMembers === 1 ? "member is" : "members are"
                  } on these names`
                : "Where the Club stands, ranked by conviction"}
          </p>
        </header>

        {/* ── BODY ── */}
        {loading ? (
          <IndexSkeleton />
        ) : data?.floorMet && data.rows.length > 0 ? (
          <ol className="m-0 list-none p-0">
            {data.rows.map((r) => (
              <IndexRow key={r.ticker} row={r} />
            ))}
          </ol>
        ) : (
          <FoundingEmpty />
        )}
      </div>

      {/* ── COMPLIANCE FOOTNOTE ── */}
      <p className="mx-auto mt-2 max-w-[52ch] text-center font-mono text-[10px] leading-relaxed text-soft">
        {disclaimer}
      </p>
    </section>
  );
}

/* ── one ranked name ─────────────────────────────────────────────────────── */
function IndexRow({ row }: { row: ClubIndexRow }) {
  const bullPct = row.sentiment.bullPct ?? 0;
  return (
    <li className="border-b border-sand/60 last:border-b-0">
      <Link
        href={`/research/${encodeURIComponent(row.ticker)}?tab=community`}
        className="f0-focus flex items-center gap-3 px-5 py-3 transition-colors hover:bg-sand/20"
      >
        <span
          aria-hidden
          className="w-[18px] shrink-0 font-mono text-[13px] font-extrabold tabular-nums text-soft"
        >
          {row.rank}
        </span>

        {/* Identity — the shared Ticker primitive (never plain text). */}
        <Ticker symbol={row.ticker} companyName={row.company} size="sm" />

        {/* Bull / bear split — lime bull fill over an ink-tint bear track. */}
        <span
          className="hidden h-[7px] min-w-[40px] flex-1 overflow-hidden rounded-full bg-ink/10 sm:block"
          role="img"
          aria-label={`${bullPct}% bullish`}
        >
          <span
            className="block h-full rounded-full bg-sentiment-fill"
            style={{ width: `${bullPct}%` }}
          />
        </span>

        {/* Conviction — dominant-side share (lime when bull, ink when bear). */}
        <span
          className={`ml-auto shrink-0 text-right font-display text-[14px] font-extrabold tabular-nums tracking-[-0.02em] sm:ml-0 ${
            row.side === "bull" ? "text-sentiment" : "text-ink"
          }`}
        >
          {row.convictionPct}%
        </span>

        <TrendTag trend={row.trend} />
      </Link>
    </li>
  );
}

/* ── warming / cooling / steady ──────────────────────────────────────────── */
function TrendTag({ trend }: { trend: IndexTrend }) {
  const map = {
    warming: { cls: "text-volt-600", Icon: TrendingUp, label: "Warming" },
    cooling: { cls: "text-teal-600", Icon: TrendingDown, label: "Cooling" },
    steady: { cls: "text-soft", Icon: Minus, label: "Steady" },
  } as const;
  const { cls, Icon, label } = map[trend];
  return (
    <span
      className={`flex w-[74px] shrink-0 items-center justify-end gap-1 text-[11px] font-semibold ${cls}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

/* ── LIVE pill ───────────────────────────────────────────────────────────── */
function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-volt-500/15 px-2 py-[3px] font-mono text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-volt-600">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt-500/70 motion-reduce:hidden" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-volt-500" />
      </span>
      Live
    </span>
  );
}

/* ── founding empty state ────────────────────────────────────────────────── */
/** LIGHT and honest: the room hasn't reached enough positioned members for a
 *  ranked verdict to mean anything, so it names exactly what fills the surface
 *  rather than showing a one-vote list. */
function FoundingEmpty() {
  return (
    <div className="px-5 py-5">
      <p className="max-w-[56ch] border-l-2 border-accent pl-3.5 text-[12.5px] leading-relaxed text-soft">
        Only a handful of names have opinions on them so far — not enough to call
        the room&apos;s read yet. Take a position on any ticker from its{" "}
        <Link
          href="/watchlist/community"
          className="font-bold text-gold-700 underline decoration-1 underline-offset-2"
        >
          Community Watchlist
        </Link>{" "}
        and the Club Index forms around the names members actually stand on.
      </p>
    </div>
  );
}

/* ── loading skeleton (loading ≠ empty) ──────────────────────────────────── */
function IndexSkeleton() {
  return (
    <ol className="m-0 list-none p-0" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-3 border-b border-sand/60 px-5 py-3 last:border-b-0">
          <span className="h-3 w-[14px] animate-pulse rounded bg-soft/15" />
          <span className="h-5 w-5 animate-pulse rounded-md bg-soft/15" />
          <span className="h-3 w-11 animate-pulse rounded bg-soft/15" />
          <span className="h-[7px] flex-1 animate-pulse rounded-full bg-soft/15" />
          <span className="h-3 w-8 animate-pulse rounded bg-soft/15" />
          <span className="h-3 w-14 animate-pulse rounded bg-soft/15" />
        </li>
      ))}
      <span className="sr-only">Reading the Club Index</span>
    </ol>
  );
}
