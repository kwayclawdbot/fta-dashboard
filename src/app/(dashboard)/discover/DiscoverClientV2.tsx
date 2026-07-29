"use client";

/**
 * DISCOVER — v2 canvas (DESIGN-UX-SPEC + CONVERSION-PLAN §2 `/discover` row).
 *
 * Boards 02 + 15 re-skinned into the cc canvas. Rendered ONLY when
 * `isDesignV2()` is on; the v1 path (DiscoverClient's original body) is
 * byte-identical when the flag is off. Same props, same data reads, same tab
 * state/logic — nothing new is fetched and no number is invented.
 *
 * WHAT MAPS WHERE (feature preservation):
 *   masthead + search + Ask-Kai   → cc ScriptTitle + Kicker + two round controls
 *   For you / Screener / Trending  → cc SubTabs (same Tab state, showScreener gate)
 *   Your names (followed set)      → cc rows (renders only when member follows)
 *   Rising fast                    → cc cards, honest +score-attention (not price)
 *   Most divisive                  → cc Ring at RAW bull share, green/pink split
 *   Black belts are watching       → cc rail, black-belt-ringed company marks
 *   From quiet to loud             → cc spark grid
 *   Newsroom foot                  → cc news rows (mono stamps + $cashtags)
 *   Screener tab                   → the REAL <ScreenerSurface embedded /> (kept
 *                                    whole: NL builder, every filter, sector
 *                                    chips, tier gating), framed in cc chrome
 *   Trending ledger + cap wall     → cc rows + redactions + the ratified
 *                                    UnlockLine + the server's compliance line
 *   Most bullish / bearish         → cc paired cards (green / pink edge)
 *   Most discussed · Top research  → cc rows / cards
 *
 * HONEST DATA (§6.3 + gap matrix):
 *   · The divisiveness Ring is RAW SENTIMENT (bull share), labelled as such —
 *     there is no weighted engine yet, so the ring never claims one.
 *   · "Rising fast" shows `club_change_14d`, a SCORE delta with no % unit, in a
 *     neutral mono tint — never the price ramp, never a rank arrow.
 *   · RankedTile's rank-arrow is intentionally NOT used: the ledger carries a
 *     current rank but no prior-window rank delta, so an arrow would be invented.
 *   · Watcher counts stay hidden below FLOORS.tickerParticipants ("new on the
 *     board" instead of a meaningless small number).
 *   · Belt colour on "black belts watching" comes from real data (they ARE the
 *     black-belt roster); companies wear a black-belt ring, not a fake member
 *     avatar (the row is tickers-watched, it has no per-member identity).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, Search, Sparkles, X } from "lucide-react";

import V2Surface from "@/components/clubhome/v2/V2Surface";
import {
  Kicker,
  ScriptTitle,
  Card,
  TickerBadge,
  BELT_COLORS,
} from "@/components/cc/ui";
import { SubTabs } from "@/components/cc/interactive";

import ScreenerSurfaceV2 from "@/components/screener/ScreenerSurfaceV2";
import UnlockLine from "@/components/entitlements/UnlockLine";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { useKaiSheet } from "@/components/kai/KaiSheetProvider";

import { DiscoverV2Spark } from "./DiscoverV2Spark";
import {
  useClubLedger,
  pickDivisive,
  DIVISIVE_MIN_POSITIONED,
  TRENDING_WALL,
  TRENDING_WALL_DETAIL,
} from "./DiscoverClient";

import { timeAgoAt, useNowHour } from "@/components/discover/clock";
import { FLOORS } from "@/lib/club/score";
import { contributionMeta } from "@/lib/research/social";
import {
  fetchQuotes,
  formatPrice,
  formatChangePct,
  changeTone,
  type MarketQuote,
} from "@/lib/market/client";
import type { NewsCardData } from "@/lib/news/types";
import type { CommunityBoardSeed } from "@/lib/community-watchlist-board";
import type { DiscoverExtras } from "@/lib/discover";
import type { TrendingResponse, TrendingRow } from "@/lib/clubhome/contract";

interface DiscoverClientProps {
  initialNews: NewsCardData[] | null;
  board: CommunityBoardSeed | null;
  extras: DiscoverExtras | null;
  showScreener?: boolean;
}

type Tab = "foryou" | "screener" | "trending";

/* Warm grounds — the board's deep-brown wash (linear-gradient(140deg,#241009,
   #17141A)), composed from tokens. Hero cards ride the rich ground; the leader
   in a rail gets an orange edge + halo. Empty states reuse the same furniture
   at low emphasis rather than a paragraph. */
const WARM_HERO =
  "linear-gradient(140deg, color-mix(in srgb, var(--cc-orange) 26%, var(--cc-card)) 0%, color-mix(in srgb, var(--cc-orange) 9%, var(--cc-card)) 48%, var(--cc-card) 100%)";
const WARM_SOFT =
  "linear-gradient(150deg, color-mix(in srgb, var(--cc-orange) 13%, var(--cc-card)) 0%, var(--cc-card) 60%)";
const WARM_BORDER = "color-mix(in srgb, var(--cc-orange) 34%, var(--cc-line))";

/* ── surface ─────────────────────────────────────────────────────────────── */
export default function DiscoverClientV2({
  initialNews,
  board,
  extras,
  showScreener = true,
}: DiscoverClientProps) {
  const entries = useMemo(() => board?.entries ?? [], [board]);
  const movers = useMemo(() => extras?.forYouMovers ?? [], [extras]);
  const contributions = extras?.contributions ?? [];
  const reports = extras?.reports ?? [];
  const beltWatch = useMemo(() => extras?.beltWatch ?? [], [extras]);

  const { trending, loading } = useClubLedger();
  const rows = useMemo(() => trending?.rows ?? [], [trending]);

  const [tab, setTab] = useState<Tab>("foryou");

  const tabs = useMemo(
    () =>
      [
        { id: "foryou" as const, label: "For you" },
        ...(showScreener ? [{ id: "screener" as const, label: "Screener" }] : []),
        { id: "trending" as const, label: "Trending" },
      ] satisfies { id: Tab; label: string }[],
    [showScreener],
  );

  return (
    <V2Surface className="min-h-screen">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        <Masthead />

        <div className="mt-4">
          <SubTabs tabs={tabs} value={tab} onChange={setTab} />
        </div>

        <div
          role="tabpanel"
          aria-label={`Discover · ${tab}`}
          className="mt-6"
        >
          {tab === "foryou" && (
            <ForYouPanel
              rows={rows}
              loading={loading}
              movers={movers}
              beltWatch={beltWatch}
              blackBelts={extras?.blackBelts ?? 0}
              initialNews={initialNews}
            />
          )}

          {tab === "screener" && <ScreenerPanel />}

          {tab === "trending" && (
            <TrendingPanel
              trending={trending}
              rows={rows}
              loading={loading}
              movers={movers}
              entries={entries}
              contributions={contributions}
              reports={reports}
            />
          )}
        </div>
      </div>
    </V2Surface>
  );
}

/* ── shared cc bits ──────────────────────────────────────────────────────── */

/** A section header in the cc voice: mono kicker + a soft gloss + optional right. */
function SectionHead({
  kicker,
  gloss,
  right,
  id,
  className = "",
}: {
  kicker: string;
  gloss?: string;
  right?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <Kicker className="!text-[9.5px] !tracking-[0.16em]">
          <span id={id}>{kicker}</span>
        </Kicker>
        {right && <div className="shrink-0 text-[11px]">{right}</div>}
      </div>
      {gloss && (
        <p className="mt-[2px] text-[10.5px] leading-snug" style={{ color: "var(--cc-dim)" }}>
          {gloss}
        </p>
      )}
    </div>
  );
}

/** A charged founding line — a rule + a sentence, never a blank card. */
function Founding({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`max-w-[56ch] pl-3.5 text-[12.5px] leading-relaxed ${className}`}
      style={{ borderLeft: "2px solid var(--cc-orange)", color: "var(--cc-soft)" }}
    >
      {children}
    </p>
  );
}

/** "See all" style link in the cc orange text ramp. */
function SeeAll({ href, children = "See all" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="rounded text-[11px]" style={{ color: "var(--cc-soft)" }}>
      {children}
    </Link>
  );
}

/** A round 34px control on the masthead line (cc-tokened twin of RoundButton). */
function RoundControl({
  label,
  onClick,
  active = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border transition-colors"
      style={{
        borderColor: active ? "var(--cc-orange)" : "var(--cc-line)",
        background: active ? "var(--cc-orange)" : "var(--cc-card)",
        color: active ? "var(--cc-orange-deep)" : "var(--cc-ink)",
      }}
    >
      {children}
    </button>
  );
}

/* ── MASTHEAD ────────────────────────────────────────────────────────────── */
function Masthead() {
  const router = useRouter();
  const { openKai } = useKaiSheet();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim().toUpperCase().replace(/[^A-Z.]/g, "");
    if (t) router.push(`/research/${encodeURIComponent(t)}`);
  }

  return (
    <header>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <ScriptTitle>discover</ScriptTitle>
          <p className="mt-[5px] text-[12px]" style={{ color: "var(--cc-soft)" }}>
            Find what the Club is paying attention to
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-[9px]">
          <RoundControl
            label={open ? "Close search" : "Search any stock"}
            active={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-4 w-4" /> : <Search className="h-[15px] w-[15px]" />}
          </RoundControl>
          <RoundControl label="Ask Kai" onClick={() => openKai({ chip: "Discover", query: null })}>
            <Sparkles className="h-[15px] w-[15px]" />
          </RoundControl>
        </div>
      </div>

      {open && (
        <form onSubmit={submit} role="search" className="mt-4">
          <Card className="flex items-center gap-2.5 px-3.5 py-2.5">
            <Search className="h-4 w-4 shrink-0" style={{ color: "var(--cc-soft)" }} aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ticker, company, or a theme"
              aria-label="Search stocks"
              className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none"
              style={{ color: "var(--cc-ink)" }}
            />
            {q.trim() && (
              <button
                type="submit"
                aria-label="Open research"
                className="shrink-0 rounded-full p-1"
                style={{ color: "var(--cc-orange-ink)" }}
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </Card>
        </form>
      )}
    </header>
  );
}

/* ── FOR YOU ─────────────────────────────────────────────────────────────── */
function ForYouPanel({
  rows,
  loading,
  movers,
  beltWatch,
  blackBelts,
  initialNews,
}: {
  rows: TrendingRow[];
  loading: boolean;
  movers: DiscoverExtras["forYouMovers"];
  beltWatch: DiscoverExtras["beltWatch"];
  blackBelts: number;
  initialNews: NewsCardData[] | null;
}) {
  const risers = useMemo(
    () =>
      rows
        .filter((r) => (r.change ?? 0) > 0)
        .sort((a, b) => (b.change ?? 0) - (a.change ?? 0)),
    [rows],
  );
  const divisive = useMemo(() => pickDivisive(rows), [rows]);

  return (
    <div className="space-y-6">
      <YourNames movers={movers} rows={rows} />
      <RisingFast rows={risers.slice(0, 3)} loading={loading} />
      <MostDivisive row={divisive} loading={loading} />
      <BlackBeltsWatching names={beltWatch} blackBelts={blackBelts} />
      <QuietToLoud rows={risers.slice(3, 8)} loading={loading} />
      <Newsroom initialNews={initialNews} />
    </div>
  );
}

/* ── YOUR NAMES ──────────────────────────────────────────────────────────── */
function YourNames({
  movers,
  rows,
}: {
  movers: DiscoverExtras["forYouMovers"];
  rows: TrendingRow[];
}) {
  const tickers = useMemo(
    () => movers.map((m) => m.ticker.toUpperCase()).filter(Boolean),
    [movers],
  );
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  useEffect(() => {
    if (!tickers.length) return;
    const ctrl = new AbortController();
    fetchQuotes(tickers, ctrl.signal).then(setQuotes).catch(() => {});
    return () => ctrl.abort();
  }, [tickers]);

  const intel = useMemo(() => {
    const m = new Map<string, TrendingRow>();
    for (const r of rows) m.set(r.ticker.toUpperCase(), r);
    return m;
  }, [rows]);

  if (movers.length === 0) return null;

  return (
    <section aria-label="Your names">
      <SectionHead
        kicker="your names"
        gloss="The tickers you follow, biggest move first"
        right={<SeeAll href="/watchlist" />}
      />
      <div className="mt-3 flex flex-col gap-2">
        {movers.map((mv) => {
          const t = mv.ticker.toUpperCase();
          const q = quotes[t];
          const row = intel.get(t);
          return (
            <SignalRow
              key={`yours-${t}`}
              ticker={mv.ticker}
              price={q?.price ?? row?.price ?? null}
              changePct={q?.changePercent ?? row?.changePct ?? mv.chg_1d ?? null}
              signal={row?.sentiment?.bullPct ?? null}
            />
          );
        })}
      </div>
    </section>
  );
}

/* ── RISING FAST ─────────────────────────────────────────────────────────── */
function RisingFast({ rows, loading }: { rows: TrendingRow[]; loading: boolean }) {
  return (
    <section aria-label="Rising fast">
      <SectionHead
        kicker="rising fast"
        gloss="Biggest gain in Club attention against the last two weeks"
        right={<SeeAll href="/watchlist/community" />}
      />
      {loading ? (
        <div className="mt-3 grid grid-cols-3 gap-2.5" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[92px] animate-pulse rounded-2xl border"
              style={{ background: "var(--cc-card2)", borderColor: "var(--cc-line)" }}
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Founding className="mt-3">
          No name has gained ground on the board this fortnight. Watch a ticker,
          ask Kai about it, or post a thesis — attention is the only thing that
          moves a name onto this row.
        </Founding>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {rows.map((r, i) => {
            const watchers = r.watchers ?? 0;
            const shown = watchers >= FLOORS.tickerParticipants;
            const lead = i === 0;
            return (
              <Card
                key={r.ticker}
                className="relative overflow-hidden transition-colors hover:border-[var(--cc-orange)]"
                style={{
                  background: lead ? WARM_HERO : WARM_SOFT,
                  borderColor: lead ? WARM_BORDER : undefined,
                  boxShadow: lead ? "var(--cc-halo-soft)" : undefined,
                }}
              >
                {/* Top accent hairline — the orange rule the board runs above a
                    charged card; brightest on the leader. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[2px]"
                  style={{
                    background: lead
                      ? "linear-gradient(90deg, var(--cc-orange), transparent)"
                      : "linear-gradient(90deg, color-mix(in srgb, var(--cc-orange) 45%, transparent), transparent)",
                  }}
                />
                <Link
                  href={`/research/${encodeURIComponent(r.ticker)}`}
                  className="block rounded-2xl px-3.5 py-3"
                >
                  {/* Identity row — the ticker names the card; the sparkline
                      rides along as a small, low-emphasis garnish, not the hero. */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="font-[family-name:var(--font-plex-mono)] text-[13px] font-bold"
                      style={{ color: "var(--cc-ink)" }}
                    >
                      {r.ticker.toUpperCase()}
                    </span>
                    <DiscoverV2Spark symbol={r.ticker} width={40} height={14} className="opacity-50" />
                  </div>
                  {/* Hero — the attention delta. club_change_14d is a SCORE delta
                      (no % unit, not price), so it reads big but in neutral ink,
                      never the green price ramp. */}
                  <div className="mt-2 flex items-baseline gap-1">
                    <span
                      className="font-[family-name:var(--font-plex-mono)] text-[19px] font-semibold leading-none tabular-nums"
                      style={{ color: "var(--cc-ink)" }}
                    >
                      +{Math.round(r.change ?? 0)}
                    </span>
                    <span
                      className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.08em]"
                      style={{ color: "var(--cc-soft)" }}
                    >
                      attn
                    </span>
                  </div>
                  <span
                    className="mt-1.5 block truncate font-[family-name:var(--font-plex-mono)] text-[9.5px]"
                    style={{ color: "var(--cc-dim)" }}
                  >
                    {shown ? `${watchers.toLocaleString()} watching` : "New on the board"}
                  </span>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── MOST DIVISIVE ───────────────────────────────────────────────────────── */
function MostDivisive({ row, loading }: { row: TrendingRow | null; loading: boolean }) {
  const s = row?.sentiment;
  const positioned = s ? s.bull + s.neutral + s.bear : 0;
  const bullPct = s?.bullPct ?? null;
  const bearPct = s && positioned > 0 ? Math.round((s.bear / positioned) * 100) : null;

  return (
    <section aria-label="Most divisive">
      <SectionHead
        kicker="most divisive · raw sentiment"
        gloss="Widest split in Club opinion — raw member stances, not a weighted signal"
        right={
          row ? (
            <Link
              href={`/research/${encodeURIComponent(row.ticker)}?tab=community`}
              className="rounded text-[12px]"
              style={{ color: "var(--cc-soft)" }}
              aria-label={`Open the ${row.ticker} thread`}
            >
              →
            </Link>
          ) : undefined
        }
      />

      {loading ? (
        <div
          className="mt-3 h-[136px] animate-pulse rounded-2xl border"
          style={{ background: "var(--cc-card2)", borderColor: "var(--cc-line)" }}
        />
      ) : row && bullPct != null ? (
        <>
          <Card
            className="mt-3 flex items-center gap-4 p-4"
            style={{ background: WARM_SOFT, borderColor: WARM_BORDER }}
          >
            <SplitSide pct={bullPct} label="Bullish" count={s!.bull} color="var(--cc-up)" />
            {/* Divisiveness donut — a two-colour conic split (green bull / pink
                bear), the artboard's viz. The arc-style Ring can't express a
                filled bull-vs-bear split, so it's composed inline from tokens.
                RAW sentiment share; the numbers are also text in the SplitSides. */}
            <div className="relative shrink-0" style={{ width: 104, height: 104 }}>
              <div
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(var(--cc-up) 0 ${bullPct}%, var(--cc-down) ${bullPct}% 100%)`,
                }}
              />
              <div
                className="absolute grid place-items-center rounded-full"
                style={{ inset: 7, background: "var(--cc-bg)" }}
              >
                <Link
                  href={`/research/${encodeURIComponent(row.ticker)}?tab=community`}
                  className="flex flex-col items-center rounded"
                >
                  <TickerBadge symbol={row.ticker} size={34} />
                  <span
                    className="mt-1 font-[family-name:var(--font-plex-mono)] text-[10px]"
                    style={{ color: "var(--cc-ink)" }}
                  >
                    {row.ticker.toUpperCase()}
                  </span>
                </Link>
              </div>
            </div>
            <SplitSide pct={bearPct ?? 0} label="Bearish" count={s!.bear} color="var(--cc-down)" />
          </Card>
          <p className="mt-1.5 text-center text-[10px]" style={{ color: "var(--cc-dim)" }}>
            {positioned.toLocaleString()} {positioned === 1 ? "opinion" : "opinions"}
            {s!.neutral > 0 ? ` · ${s!.neutral} neutral` : ""}
          </p>
        </>
      ) : (
        // Designed zero-state: the divisive donut's own furniture, dimmed, with
        // the invite spoken from inside the ring — never a bare paragraph.
        <Card className="mt-3 flex items-center gap-4 p-4" style={{ opacity: 0.92 }}>
          <div className="flex-1 text-center" style={{ opacity: 0.4 }}>
            <p className="cc-display text-[22px]" style={{ color: "var(--cc-up)" }}>
              —
            </p>
            <p
              className="mt-0.5 font-[family-name:var(--font-plex-mono)] text-[8.5px] uppercase tracking-[0.14em]"
              style={{ color: "var(--cc-up)" }}
            >
              Bullish
            </p>
          </div>
          <div className="relative shrink-0" style={{ width: 104, height: 104 }}>
            {/* the two-colour conic, held at low opacity — the shape of an
                argument waiting to happen */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: "conic-gradient(var(--cc-up) 0 50%, var(--cc-down) 50% 100%)",
                opacity: 0.22,
              }}
            />
            <div
              className="absolute grid place-items-center rounded-full px-2 text-center"
              style={{ inset: 7, background: "var(--cc-bg)" }}
            >
              <span className="text-[10px] font-semibold leading-tight" style={{ color: "var(--cc-soft)" }}>
                No split
                <span className="mt-0.5 block text-[8.5px]" style={{ color: "var(--cc-dim)" }}>
                  yet
                </span>
              </span>
            </div>
          </div>
          <div className="flex-1 text-center" style={{ opacity: 0.4 }}>
            <p className="cc-display text-[22px]" style={{ color: "var(--cc-down)" }}>
              —
            </p>
            <p
              className="mt-0.5 font-[family-name:var(--font-plex-mono)] text-[8.5px] uppercase tracking-[0.14em]"
              style={{ color: "var(--cc-down)" }}
            >
              Bearish
            </p>
          </div>
        </Card>
      )}
      {!loading && !(row && bullPct != null) && (
        <p className="mt-2 text-center text-[11px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
          A split needs {DIVISIVE_MIN_POSITIONED} members on the same company taking opposite
          sides. Take a position and the argument starts here.
        </p>
      )}
    </section>
  );
}

function SplitSide({
  pct,
  label,
  count,
  color,
}: {
  pct: number;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex-1 text-center">
      <p className="cc-display text-[22px]" style={{ color }}>
        {pct}%
      </p>
      <p
        className="mt-0.5 font-[family-name:var(--font-plex-mono)] text-[8.5px] uppercase tracking-[0.14em]"
        style={{ color }}
      >
        {label}
      </p>
      <p
        className="mt-2 font-[family-name:var(--font-plex-mono)] text-[9.5px] tabular-nums"
        style={{ color: "var(--cc-soft)" }}
      >
        {count} {count === 1 ? "member" : "members"}
      </p>
    </div>
  );
}

/* ── BLACK BELTS ARE WATCHING ────────────────────────────────────────────── */
function BlackBeltsWatching({
  names,
  blackBelts,
}: {
  names: DiscoverExtras["beltWatch"];
  blackBelts: number;
}) {
  return (
    <section aria-label="Black belts are watching">
      <SectionHead
        kicker="black belts are watching"
        gloss="What the Club's highest rank actually holds"
        right={<SeeAll href="/leaderboard" />}
      />
      {names.length === 0 ? (
        // Designed zero-state: the ring row's own furniture, dimmed — five
        // black-belt rings holding empty, with the invite spoken beneath.
        <div className="mt-[11px]">
          <div className="flex gap-[13px]" aria-hidden style={{ opacity: 0.5 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full"
                style={{
                  border: `1.5px solid ${BELT_COLORS.black}`,
                  background: "var(--cc-card2)",
                  opacity: 1 - i * 0.13,
                }}
              >
                <span className="text-[15px]" style={{ color: "var(--cc-dim)" }}>
                  ·
                </span>
              </span>
            ))}
          </div>
          <p className="mt-3 max-w-[52ch] text-[12px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
            {blackBelts === 0
              ? "No one has reached Black Belt yet. The first member who does sets this row — and everyone gets to see what they're watching."
              : "The Club's black belts haven't put anything on their watchlists yet."}
          </p>
        </div>
      ) : (
        <div className="no-scrollbar -mx-1 mt-[11px] flex gap-[13px] overflow-x-auto px-1">
          {names.map((n) => (
            <Link
              key={n.ticker}
              href={`/research/${encodeURIComponent(n.ticker)}`}
              className="shrink-0 text-center"
              title={`${n.belts} ${n.belts === 1 ? "black belt is" : "black belts are"} watching ${n.ticker}`}
            >
              {/* The company mark ringed in the black-belt hue — belt colour
                  from real data (they ARE black belts); no fabricated member. */}
              <span
                className="grid h-[46px] w-[46px] place-items-center rounded-full"
                style={{ border: `1.5px solid ${BELT_COLORS.black}` }}
              >
                <TickerBadge symbol={n.ticker} size={38} />
              </span>
              <span
                className="mt-1.5 block font-[family-name:var(--font-plex-mono)] text-[9px]"
                style={{ color: "var(--cc-ink)" }}
              >
                {n.ticker.toUpperCase()}
              </span>
              <span
                className="block font-[family-name:var(--font-plex-mono)] text-[8.5px] tabular-nums"
                style={{ color: "var(--cc-dim)" }}
              >
                {n.belts} {n.belts === 1 ? "belt" : "belts"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── FROM QUIET TO LOUD ──────────────────────────────────────────────────── */
function QuietToLoud({ rows, loading }: { rows: TrendingRow[]; loading: boolean }) {
  return (
    <section aria-label="From quiet to loud">
      <SectionHead kicker="from quiet to loud" gloss="Names the Club just woke up on" />
      {loading ? (
        <Card className="mt-3 overflow-hidden">
          <div className="flex flex-col" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3.5 py-[11px]"
                style={{ borderTop: i === 0 ? undefined : "1px solid var(--cc-line)" }}
              >
                <span className="h-[11px] w-11 animate-pulse rounded" style={{ background: "var(--cc-card2)" }} />
                <span className="ml-auto h-[11px] w-14 animate-pulse rounded" style={{ background: "var(--cc-card2)" }} />
              </div>
            ))}
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Founding className="mt-3">
          Nothing new has woken up behind the leaders yet. The moment a quiet name
          starts collecting watches and theses, it appears here.
        </Founding>
      ) : (
        // A clean list, not a spark grid — the acceleration caret carries the
        // "waking up" signal; the attention delta reads as honest mono meta.
        <Card className="mt-3 overflow-hidden">
          <div className="flex flex-col">
            {rows.map((r, i) => (
              <Link
                key={r.ticker}
                href={`/research/${encodeURIComponent(r.ticker)}`}
                className="flex items-center gap-2.5 px-3.5 py-[11px] transition-colors hover:bg-[var(--cc-card2)]"
                style={{ borderTop: i === 0 ? undefined : "1px solid var(--cc-line)" }}
              >
                <span aria-hidden className="text-[10px] leading-none" style={{ color: "var(--cc-orange)" }}>
                  ▲
                </span>
                <span
                  className="font-[family-name:var(--font-plex-mono)] text-[11px] font-bold"
                  style={{ color: "var(--cc-ink)" }}
                >
                  {r.ticker.toUpperCase()}
                </span>
                <span
                  className="ml-auto font-[family-name:var(--font-plex-mono)] text-[10px] tabular-nums"
                  style={{ color: "var(--cc-soft)" }}
                >
                  +{Math.round(r.change ?? 0)} attn
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </section>
  );
}

/* ── NEWSROOM FOOT ───────────────────────────────────────────────────────── */
function Newsroom({ initialNews }: { initialNews: NewsCardData[] | null }) {
  const now = useNowHour();
  const items = initialNews ?? [];
  return (
    <section aria-label="News moving the Club">
      <SectionHead
        kicker="news moving the club"
        gloss="Written by AI from public market data"
        right={<SeeAll href="/news" />}
      />
      {items.length === 0 ? (
        <Founding className="mt-3">
          The newsroom is quiet right now. AI market wraps and ticker notes land
          here as the day moves.
        </Founding>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {items.slice(0, 8).map((a) => {
            const stamp = timeAgoAt(a.generated_at, now);
            return (
              <Card key={a.slug} className="transition-colors hover:border-[var(--cc-orange)]">
                <Link href={`/news/${a.slug}`} className="block rounded-2xl px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-plex-mono)] text-[8.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--cc-orange-ink)" }}>
                      {a.kind === "market_wrap" ? "Market wrap" : a.kind === "sector_spotlight" ? "Sector" : "Ticker note"}
                    </span>
                    {stamp && (
                      <span className="ml-auto shrink-0 font-[family-name:var(--font-plex-mono)] text-[9.5px]" style={{ color: "var(--cc-dim)" }}>
                        {stamp}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[14px] font-semibold leading-snug" style={{ color: "var(--cc-ink)" }}>
                    {a.title}
                  </p>
                  {a.dek && (
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
                      {a.dek}
                    </p>
                  )}
                  {a.tickers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {a.tickers.slice(0, 5).map((t) => (
                        <span
                          key={t}
                          className="font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold"
                          style={{ color: "var(--cc-orange-ink)" }}
                        >
                          ${t.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── SCREENER ────────────────────────────────────────────────────────────── */
/**
 * Board 15 = the REAL screener. `<ScreenerSurface embedded />` is kept WHOLE —
 * the NL builder, every filter, sector chips, presets and its own tier gating
 * all preserved unchanged — because it is a large surface shared with the
 * standalone `/screener` route (file-boundary rule: don't fork/edit a shared
 * component). It is framed here in cc chrome; a full internal cc re-skin of the
 * screener is its own lane. The kid gate is upstream: this tab only exists when
 * `showScreener` is true.
 */
function ScreenerPanel() {
  return (
    <section aria-label="Screener">
      <SectionHead
        kicker="stock finder · board 15"
        gloss="Screen the whole market — ask in plain English or stack filters"
      />
      <div className="mt-4">
        <ScreenerSurfaceV2 embedded />
      </div>
    </section>
  );
}

/* ── TRENDING ────────────────────────────────────────────────────────────── */
function TrendingPanel({
  trending,
  rows,
  loading,
  movers,
  entries,
  contributions,
  reports,
}: {
  trending: TrendingResponse | null;
  rows: TrendingRow[];
  loading: boolean;
  movers: DiscoverExtras["forYouMovers"];
  entries: CommunityBoardSeed["entries"];
  contributions: DiscoverExtras["contributions"];
  reports: DiscoverExtras["reports"];
}) {
  const intel = useMemo(() => {
    const m = new Map<string, TrendingRow>();
    for (const r of rows) m.set(r.ticker.toUpperCase(), r);
    return m;
  }, [rows]);

  const extraTickers = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => e.ticker && set.add(e.ticker.toUpperCase()));
    movers.forEach((mv) => mv.ticker && set.add(mv.ticker.toUpperCase()));
    return Array.from(set);
  }, [entries, movers]);

  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  useEffect(() => {
    if (!extraTickers.length) return;
    const ctrl = new AbortController();
    fetchQuotes(extraTickers, ctrl.signal).then(setQuotes).catch(() => {});
    return () => ctrl.abort();
  }, [extraTickers]);

  const discussed = useMemo(
    () =>
      [...entries]
        .sort((a, b) => (b.comment_count ?? 0) - (a.comment_count ?? 0))
        .filter((e) => (e.comment_count ?? 0) > 0)
        .slice(0, 6),
    [entries],
  );

  const stanced = useMemo(() => rows.filter((r) => r.sentiment?.bullPct != null), [rows]);
  const mostBullish = useMemo(
    () =>
      [...stanced]
        .sort((a, b) => (b.sentiment!.bullPct ?? 0) - (a.sentiment!.bullPct ?? 0))
        .slice(0, 3),
    [stanced],
  );
  const mostBearish = useMemo(
    () =>
      [...stanced]
        .sort((a, b) => (a.sentiment!.bullPct ?? 0) - (b.sentiment!.bullPct ?? 0))
        .slice(0, 3),
    [stanced],
  );

  const freeCap = trending?.freeCap;
  const totalCount = trending?.totalCount;
  const withheldRanks = useMemo(() => {
    if (!trending?.locked || freeCap == null || totalCount == null) return [];
    const n = totalCount - freeCap;
    if (n <= 0) return [];
    return Array.from({ length: n }, (_, i) => freeCap + i + 1);
  }, [trending?.locked, freeCap, totalCount]);

  return (
    <div className="space-y-6">
      <section aria-label="Ranked by Club signal">
        <SectionHead
          kicker={
            loading
              ? "ranked by club signal"
              : `${rows.length} ${rows.length === 1 ? "name" : "names"} · sorted by club signal`
          }
          gloss="Live ranking by member attention and conviction"
        />

        {loading ? (
          <div className="mt-3 flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[46px] animate-pulse rounded-2xl border"
                style={{ background: "var(--cc-card2)", borderColor: "var(--cc-line)" }}
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Founding className="mt-3">
            The Club hasn&apos;t formed a read yet. Rate a ticker on the{" "}
            <Link href="/watchlist/community" className="font-bold underline" style={{ color: "var(--cc-orange-ink)" }}>
              Community Watchlist
            </Link>{" "}
            and you&apos;ll be the first signal on this board.
          </Founding>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {rows.map((r) => (
              <SignalRow
                key={r.ticker}
                ticker={r.ticker}
                price={r.price ?? null}
                changePct={r.changePct ?? null}
                signal={r.sentiment?.bullPct ?? null}
                rank={r.rank}
              />
            ))}
          </div>
        )}

        {/* The cap, drawn honestly: real withheld rank numbers as redactions,
            then the ratified UnlockLine (the exact upgrade door). */}
        {withheldRanks.length > 0 && (
          <>
            <p className="sr-only">
              {withheldRanks.length} further{" "}
              {withheldRanks.length === 1 ? "rank is" : "ranks are"} withheld from this ledger.
            </p>
            <div role="presentation" aria-hidden className="pointer-events-none mt-2 flex flex-col gap-2">
              {withheldRanks.map((rank) => (
                <RedactedRow key={rank} rank={rank} />
              ))}
            </div>
            <div className="mt-3">
              <UnlockLine cta={TRENDING_WALL.cta}>
                {freeCap} of {totalCount} names shown. The Club opens {TRENDING_WALL_DETAIL}
              </UnlockLine>
            </div>
          </>
        )}

        {rows.length > 0 && (
          <p className="mt-3 font-[family-name:var(--font-plex-mono)] text-[10px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
            {trending?.disclaimer ?? "Attention inside the Club — not a recommendation."}
            {" · Prices delayed ~15 min."}
          </p>
        )}

        {(mostBullish.length > 0 || mostBearish.length > 0) && (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <ConvictionCard title="Club's most bullish" rows={mostBullish} tone="bull" />
            <ConvictionCard title="Club's most bearish" rows={mostBearish} tone="bear" />
          </div>
        )}
      </section>

      {/* MOST DISCUSSED */}
      <section aria-label="Most discussed">
        <SectionHead kicker="most discussed" gloss="Where the Club is actually talking" />
        {discussed.length === 0 ? (
          <Founding className="mt-3">
            No thread has caught yet. Champion an idea on the{" "}
            <Link href="/watchlist/community" className="font-bold underline" style={{ color: "var(--cc-orange-ink)" }}>
              Community Watchlist
            </Link>{" "}
            and the conversation starts here.
          </Founding>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {discussed.map((e) => {
              const t = e.ticker.toUpperCase();
              const q = quotes[t];
              const row = intel.get(t);
              return (
                <SignalRow
                  key={e.id}
                  ticker={e.ticker}
                  price={q?.price ?? row?.price ?? e.latest_close ?? null}
                  changePct={q?.changePercent ?? row?.changePct ?? null}
                  signal={row?.sentiment?.bullPct ?? null}
                  comments={e.comment_count ?? 0}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* TOP RESEARCH */}
      <section aria-label="Top research">
        <SectionHead kicker="top research" gloss="The thinking behind the names" />
        <ResearchCards contributions={contributions} reports={reports} />
      </section>
    </div>
  );
}

/* ── SIGNAL ROW (cc) ─────────────────────────────────────────────────────── */
function SignalRow({
  ticker,
  price,
  changePct,
  signal,
  rank,
  comments,
}: {
  ticker: string;
  price: number | null;
  changePct: number | null;
  /** community bull share — the "Club signal". null until anyone positions. */
  signal: number | null;
  rank?: number;
  comments?: number;
}) {
  const tone = changeTone(changePct ?? undefined);
  return (
    <Card className="transition-colors hover:border-[var(--cc-orange)]">
      <Link
        href={`/research/${encodeURIComponent(ticker)}`}
        className="flex items-center gap-2.5 rounded-2xl px-[11px] py-[9px]"
      >
        {rank != null && (
          <span
            aria-hidden
            className="w-4 shrink-0 text-right font-[family-name:var(--font-plex-mono)] text-[10px] tabular-nums"
            style={{ color: "var(--cc-soft)" }}
          >
            {rank}
          </span>
        )}
        <TickerBadge symbol={ticker} size={26} />
        <span
          className="w-[46px] shrink-0 font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold"
          style={{ color: "var(--cc-ink)" }}
        >
          {ticker.toUpperCase()}
        </span>
        <span className="inline-block">
          <DiscoverV2Spark symbol={ticker} width={52} height={18} />
        </span>
        <span
          className="flex-1 truncate text-right font-[family-name:var(--font-plex-mono)] text-[10.5px] tabular-nums"
          style={{ color: "var(--cc-ink)" }}
        >
          {formatPrice(price ?? undefined) || "—"}
        </span>
        <span
          className="w-[52px] shrink-0 text-right font-[family-name:var(--font-plex-mono)] text-[10px] tabular-nums"
          style={{
            color:
              tone === "up" ? "var(--cc-up)" : tone === "down" ? "var(--cc-down)" : "var(--cc-soft)",
          }}
        >
          {formatChangePct(changePct ?? undefined) || "—"}
        </span>
        {comments != null ? (
          <span
            className="shrink-0 rounded-lg px-1.5 py-[3px] font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold tabular-nums"
            style={{ background: "var(--cc-card2)", color: "var(--cc-soft)" }}
          >
            {comments}
          </span>
        ) : signal != null ? (
          <span
            className="shrink-0 rounded-lg px-1.5 py-[3px] font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold tabular-nums"
            style={{ background: "color-mix(in srgb, var(--cc-up) 14%, transparent)", color: "var(--cc-up)" }}
          >
            {signal}%
          </span>
        ) : (
          <span
            className="shrink-0 rounded-lg px-1.5 py-[3px] font-[family-name:var(--font-plex-mono)] text-[10px]"
            style={{ color: "var(--cc-dim)" }}
          >
            —
          </span>
        )}
      </Link>
    </Card>
  );
}

/** A withheld rank drawn as a redaction — real rank number, obscured bars. */
function RedactedRow({ rank }: { rank: number }) {
  const bar = { background: "color-mix(in srgb, var(--cc-soft) 18%, transparent)", filter: "blur(5px)" };
  return (
    <Card className="select-none">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span
          className="w-4 shrink-0 text-right font-[family-name:var(--font-plex-mono)] text-[10px] tabular-nums"
          style={{ color: "var(--cc-soft)" }}
        >
          {rank}
        </span>
        <span aria-hidden className="h-[26px] w-[26px] shrink-0 rounded-lg" style={bar} />
        <span aria-hidden className="h-[10px] w-[46px] shrink-0 rounded" style={bar} />
        <span aria-hidden className="ml-auto h-[10px] w-[54px] rounded" style={bar} />
        <span aria-hidden className="h-[10px] w-[34px] shrink-0 rounded" style={bar} />
        <span aria-hidden className="h-[10px] w-[26px] shrink-0 rounded" style={bar} />
      </div>
    </Card>
  );
}

/** Board 15's paired conviction cards — green edge (bull) / pink edge (bear). */
function ConvictionCard({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: TrendingRow[];
  tone: "bull" | "bear";
}) {
  if (rows.length === 0) return null;
  const edge = tone === "bull" ? "var(--cc-up)" : "var(--cc-down)";
  return (
    <Card className="px-3.5 py-[13px]" style={{ borderLeft: `3px solid ${edge}` }}>
      <p
        className="font-[family-name:var(--font-plex-mono)] text-[8.5px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: edge }}
      >
        {title}
      </p>
      <div className="mt-2.5 flex flex-col gap-2">
        {rows.map((r) => (
          <Link
            key={r.ticker}
            href={`/research/${encodeURIComponent(r.ticker)}?tab=community`}
            className="flex items-center justify-between rounded"
          >
            <span
              className="font-[family-name:var(--font-plex-mono)] text-[11px] font-semibold"
              style={{ color: "var(--cc-ink)" }}
            >
              {r.ticker.toUpperCase()}
            </span>
            <span
              className="font-[family-name:var(--font-plex-mono)] text-[10.5px] tabular-nums"
              style={{ color: edge }}
            >
              {tone === "bull" ? `${r.sentiment!.bullPct}%` : `${100 - (r.sentiment!.bullPct ?? 0)}%`}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ── TOP RESEARCH ────────────────────────────────────────────────────────── */
function ResearchCards({
  contributions,
  reports,
}: {
  contributions: DiscoverExtras["contributions"];
  reports: DiscoverExtras["reports"];
}) {
  const now = useNowHour();

  if (contributions.length === 0 && reports.length === 0) {
    return (
      <Founding className="mt-3">
        The best deep-dives land here as members post them. Be first — drop a
        thesis on any idea&apos;s{" "}
        <Link href="/community" className="font-bold underline" style={{ color: "var(--cc-orange-ink)" }}>
          research page
        </Link>
        .
      </Founding>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {contributions.map((c) => {
        const meta = contributionMeta(c.contribution_type);
        const stamp = timeAgoAt(c.created_at, now);
        return (
          <Card key={c.id} className="transition-colors hover:border-[var(--cc-orange)]">
            <Link href={`/research/${encodeURIComponent(c.ticker)}`} className="block rounded-2xl px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Avatar
                  name={c.author?.display_name}
                  avatarUrl={c.author?.avatar_url}
                  role={c.author?.role}
                  size="sm"
                />
                <span className="truncate text-[12.5px] font-bold" style={{ color: "var(--cc-ink)" }}>
                  {c.author?.username ? `@${c.author.username}` : c.author?.display_name || "A member"}
                </span>
                <AgeBadge role={c.author?.role} ageGroup={c.author?.age_group} />
                <span
                  className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[8.5px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "var(--cc-soft)" }}
                >
                  {meta.label}
                </span>
                {stamp && (
                  <span className="ml-auto shrink-0 font-[family-name:var(--font-plex-mono)] text-[9.5px]" style={{ color: "var(--cc-dim)" }}>
                    {stamp}
                  </span>
                )}
              </div>
              <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed" style={{ color: "var(--cc-ink)" }}>
                {c.snippet}
              </p>
              <p className="mt-2 font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
                ${c.ticker.toUpperCase()}
              </p>
            </Link>
          </Card>
        );
      })}

      {reports.map((r) => {
        const stamp = timeAgoAt(r.generated_at, now);
        return (
          <Card key={`kai-${r.ticker}`} className="transition-colors hover:border-[var(--cc-orange)]">
            <Link href={`/research/${encodeURIComponent(r.ticker)}`} className="block rounded-2xl px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                  style={{ background: "color-mix(in srgb, var(--cc-blue) 16%, transparent)", color: "var(--cc-blue)" }}
                >
                  <Bot className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-[12.5px] font-bold" style={{ color: "var(--cc-ink)" }}>
                  Kai
                </span>
                <span
                  className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[8.5px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "var(--cc-blue)" }}
                >
                  AI deep-dive
                </span>
                {stamp && (
                  <span className="ml-auto shrink-0 font-[family-name:var(--font-plex-mono)] text-[9.5px]" style={{ color: "var(--cc-dim)" }}>
                    {stamp}
                  </span>
                )}
              </div>
              <p className="mt-2.5 text-[15px] font-bold leading-snug" style={{ color: "var(--cc-ink)" }}>
                {r.company_name ? `${r.company_name} — full research report` : "Full research report"}
              </p>
              <p className="mt-2 font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold" style={{ color: "var(--cc-orange-ink)" }}>
                ${r.ticker.toUpperCase()}
              </p>
            </Link>
          </Card>
        );
      })}
    </div>
  );
}
