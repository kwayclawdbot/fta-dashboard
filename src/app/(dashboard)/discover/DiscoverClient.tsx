"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, Mic, Search, Sparkles, Star, X } from "lucide-react";

import NewsClient from "../news/NewsClient";
import ClubIndex from "@/components/club/ClubIndex";
import ScreenerSurface from "@/components/screener/ScreenerSurface";
import UnlockLine from "@/components/entitlements/UnlockLine";
import { wallFor } from "@/lib/entitlements/paywall";
import CompanyLogo from "@/components/fic/CompanyLogo";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { useKaiSheet } from "@/components/kai/KaiSheetProvider";
import { EmptyStateNote, EmptyTwoArrows } from "@/components/art";
import {
  Bone,
  BoardCard,
  BoardHead,
  Donut,
  FoundingLine,
  PillTabs,
  RoundButton,
  SectionMark,
  TickerSpark,
} from "@/components/discover/board";
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
import { useAppMode } from "@/lib/useAppMode";
import { parseScreenerQuery, type ParsedScreen } from "@/lib/screener-nl";
import { createClient } from "@/lib/supabase/client";
import {
  fmtMcap,
  matchesCustom,
  sortRows,
  type CustomFilters,
  type ScreenerRow,
} from "@/lib/screener";

/**
 * DISCOVER — rebuilt screen-for-screen to the owner's mockup.
 *
 * SOURCE OF TRUTH: boards 02 (`Discover`) and 15 (`Discover · Screener`) of
 * `.planning/design-project-v2/Cheat Code App Light.dc.html`, tiled as
 * `boards/light-r0-c0.png` + `light-r0-c1.png` (board 02) and `light-r2-c*`
 * (board 15), with the dark twin in `Cheat Code App.dc.html` / `dark-r0-*`.
 *
 * WHAT THE BOARD DRAWS, TOP TO BOTTOM (board 02):
 *   masthead        "discover" + "Find what the Club is paying attention to",
 *                   two 34px round controls on the right
 *   tabs            FOR YOU · SCREENER · TRENDING — the current one an orange
 *                   pill (board 15 draws the same row with SCREENER lit)
 *   RISING FAST     three white cards: ticker · delta · sparkline · watching
 *   MOST DIVISIVE   one white card: split % · DONUT with the company in it · %
 *   BLACK BELTS…    a row of 46px company discs with the ticker beneath
 *   FROM QUIET…     five bare sparklines with the ticker beneath
 *
 * The previous pass "interpreted" all of this into hairline ledgers, tile
 * strips and a split bar where the board draws a donut. That interpretation is
 * gone: cards, donuts and pills are the drawn language and they are built as
 * drawn. What did NOT change is the honesty contract — every figure below is
 * wired to a real read, a metric under its floor renders founding-era copy, and
 * the board's own 1.2K / 324% are illustrations that appear nowhere here.
 *
 * DATA
 *   /api/club/trending  ranked community-attention ledger (price, changePct,
 *                       watchers, sentiment{bull,neutral,bear,bullPct}, change =
 *                       club_change_14d, heat, floorMet) + the server's free cap
 *                       and its verbatim compliance line.
 *   getDiscoverExtras   For-You movers, research contributions, Kai reports and
 *                       the real black-belt watch roster (src/lib/discover.ts).
 *   /api/market/bars    the sparklines — real daily closes, IO-deferred and
 *                       deduplicated by <TickerSpark />.
 *
 * COLOUR LAW (unchanged, and it outranks the drawing where they disagree):
 * green/red = PRICE · lime = COMMUNITY SENTIMENT · orange = BRAND + ACTION.
 * The board paints the opinion split green/red; here the bull share takes the
 * lime sentiment ramp and the bear share an ink tint, so no price colour is
 * ever spent on an opinion. See the note at the top of components/discover/board.tsx.
 */

interface DiscoverClientProps {
  initialNews: NewsCardData[] | null;
  board: CommunityBoardSeed | null;
  extras: DiscoverExtras | null;
  /** False for a kid register — /screener redirects them, so the tab would be a
   *  door that bounces. Resolved server-side; never guessed here. */
  showScreener?: boolean;
}

type Tab = "foryou" | "screener" | "trending";

const PANEL_ID = "discover-panel";

/**
 * The metering line under the capped ledger. Its second clause is DERIVED from
 * the ratified wall body (`wallFor("trending_full").body`) rather than retyped,
 * so what the ledger promises can never drift from the pricing promise.
 */
const TRENDING_WALL = wallFor("trending_full");
const TRENDING_WALL_DETAIL =
  TRENDING_WALL.body.split("Club members get ")[1] ?? TRENDING_WALL.body;

/* ── the surface ─────────────────────────────────────────────────────────── */
/**
 * MODE SPLIT. The CLUB register gets the owner's mockup-board Discover — the
 * "DISCOVER / ◈ AI" app bar, the "What are you looking for?" ask, the KAI
 * INTERPRETATION chips, underline tabs (Screens · Top Matches · Trending ·
 * Saved) and the board's result rows — composed in <ClubDiscover /> at the
 * foot of this file. Every family / fta member keeps the boards-02/15
 * composition in <FamilyDiscover /> BYTE-FOR-BYTE.
 *
 * `useAppMode` resolves to "family" on the server and the first client paint,
 * so the family tree never flickers; a club member gets at most one
 * family-styled frame before the club branch mounts (the hook's documented
 * trade-off).
 */
export default function DiscoverClient(props: DiscoverClientProps) {
  const mode = useAppMode();
  if (mode === "club") return <ClubDiscover {...props} />;
  return <FamilyDiscover {...props} />;
}

/* ── FAMILY / FTA composition (boards 02 + 15) — unchanged ───────────────── */
function FamilyDiscover({
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
      (
        [
          { key: "foryou" as const, label: "For you" },
          ...(showScreener ? [{ key: "screener" as const, label: "Screener" }] : []),
          { key: "trending" as const, label: "Trending" },
        ] satisfies { key: Tab; label: string }[]
      ),
    [showScreener]
  );

  return (
    <div className="mx-auto max-w-2xl pb-16 lg:max-w-3xl">
      <DiscoverMasthead />

      <PillTabs
        className="mt-4"
        options={tabs}
        value={tab}
        onChange={setTab}
        ariaLabel="Discover views"
        idPrefix="discover-tab"
        panelId={PANEL_ID}
      />

      <div
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={`discover-tab-${tab}`}
        className="mt-5"
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

        {tab === "screener" && <ScreenerSurface embedded />}

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
  );
}

/* ── MASTHEAD (board 02) ─────────────────────────────────────────────────── */
/**
 * The board's head line: the surface's name, its one-line promise, and two
 * round controls. The left one opens the search field in place (the board draws
 * a magnifier, and search is what the head has always done here); the right one
 * is the Kai handoff — the board's second glyph, given the surface's own AI
 * affordance rather than a decorative one.
 */
function DiscoverMasthead() {
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
      <BoardHead
        title="discover"
        sub="Find what the Club is paying attention to"
        right={
          <>
            <RoundButton
              label={open ? "Close search" : "Search any stock"}
              active={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-4 w-4" /> : <Search className="h-[15px] w-[15px]" />}
            </RoundButton>
            <RoundButton label="Ask Kai" onClick={() => openKai({ chip: "Discover", query: null })}>
              <Sparkles className="h-[15px] w-[15px]" />
            </RoundButton>
          </>
        }
      />

      {open && (
        <form onSubmit={submit} role="search" className="mt-4">
          <BoardCard radius={14} className="flex items-center gap-2.5 px-3.5 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-soft" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ticker, company, or a theme"
              aria-label="Search stocks"
              className="min-w-0 flex-1 bg-transparent font-display text-[15px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-soft/70"
            />
            {q.trim() && (
              <button
                type="submit"
                aria-label="Open research"
                className="f0-focus f0-press shrink-0 rounded-full p-1 text-gold-700"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </BoardCard>
        </form>
      )}
    </header>
  );
}

/* ── FOR YOU (board 02) ──────────────────────────────────────────────────── */
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
  /* `change` is club_change_14d off the snapshot ledger — the row's attention
     score against the PRIOR window, which is exactly what "rising" means on
     this board. Nothing is derived here that the server did not compute. */
  const risers = useMemo(
    () =>
      rows
        .filter((r) => (r.change ?? 0) > 0)
        .sort((a, b) => (b.change ?? 0) - (a.change ?? 0)),
    [rows]
  );

  const divisive = useMemo(() => pickDivisive(rows), [rows]);

  return (
    <>
      {/* The one thing on this tab that is genuinely "for you": the names the
          member has actually liked, and how they moved. Board 02 draws no such
          section — it draws the Club's view — so this renders ONLY when the
          member has a followed set, and a member with none sees exactly the
          board. */}
      <YourNames movers={movers} rows={rows} />

      {/* The Club Index — the room's ranked community read — leads the For-You
          view. Self-contained: it reads /api/club/index itself and shows its own
          founding state below the scale floor, so it never conflicts with the
          sections below. */}
      <ClubIndex className="mb-6" />

      <RisingFast rows={risers.slice(0, 3)} loading={loading} />
      <MostDivisive row={divisive} loading={loading} />
      <BlackBeltsWatching names={beltWatch} blackBelts={blackBelts} />
      <QuietToLoud rows={risers.slice(3, 8)} loading={loading} />

      {/* The newsroom keeps its place at the foot of the surface — it is the
          one section Discover carries that board 02 does not draw, and it now
          speaks the same card language (see components/news/NewsCard.tsx). */}
      <section className="mt-8" aria-labelledby="discover-news">
        <SectionMark
          id="discover-news"
          label="News moving the Club"
          gloss="Written by AI from public market data"
          right={
            <Link href="/news" className="f0-focus rounded text-gold-700">
              See all
            </Link>
          }
        />
        <div className="mt-3">
          <NewsClient initialArticles={initialNews} embedded />
        </div>
      </section>
    </>
  );
}

/* ── YOUR NAMES ──────────────────────────────────────────────────────────── */
/**
 * The member's own followed set (a 👍 on any research page writes a row of
 * `ticker_sentiment`), ranked by the size of today's move — the personalised
 * read the old For-You segment carried, kept alive in board 15's row-card
 * language so it belongs to the same surface.
 *
 * It renders ONLY when the member actually follows something. Board 02 draws
 * the Club's view, not the member's, so a member with an empty set gets exactly
 * the board and no empty section pretending to be personalised.
 *
 * `chg_1d` comes off screener_metrics (the delayed daily mark); the live quote
 * overrides it when the batched request lands. Neither is invented, and a name
 * with no quote at all renders an honest dash.
 */
function YourNames({
  movers,
  rows,
}: {
  movers: DiscoverExtras["forYouMovers"];
  rows: TrendingRow[];
}) {
  const tickers = useMemo(
    () => movers.map((m) => m.ticker.toUpperCase()).filter(Boolean),
    [movers]
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
    <section className="mb-6" aria-labelledby="discover-yours">
      <SectionMark
        id="discover-yours"
        label="Your names"
        gloss="The tickers you follow, biggest move first"
        right={
          <Link href="/watchlist" className="f0-focus rounded">
            See all
          </Link>
        }
      />
      <div className="mt-2.5 flex flex-col gap-[7px]">
        {movers.map((mv) => {
          const t = mv.ticker.toUpperCase();
          const q = quotes[t];
          const row = intel.get(t);
          return (
            <SignalRow
              key={`yours-${t}`}
              ticker={mv.ticker}
              name={mv.name}
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
/**
 * Board 02 §1 — three white cards, each: ticker, a green delta, a sparkline,
 * and a "watching" count.
 *
 * TWO HONESTY EDITS to the drawn card:
 *  · the board's "▲ 324%" is an attention figure painted in the price green.
 *    The real number behind it is `club_change_14d`, a SCORE delta with no
 *    percent unit — so it renders as a signed score in the LIME sentiment ramp
 *    (community attention is not a price), and the gloss states the window.
 *  · the board's "1.2K watching" appears on every card. Watcher counts stay
 *    hidden below FLOORS.tickerParticipants, so a two-member club reads
 *    "New on the board" instead of a number that means nothing yet.
 * The sparkline IS a price series, so it keeps the price ramp.
 */
function RisingFast({ rows, loading }: { rows: TrendingRow[]; loading: boolean }) {
  return (
    <section aria-labelledby="discover-rising">
      <SectionMark
        id="discover-rising"
        label="Rising fast"
        gloss="Biggest gain in Club attention against the last two weeks"
        right={
          <Link href="/watchlist/community" className="f0-focus rounded">
            See all
          </Link>
        }
      />

      {loading ? (
        <div className="mt-2.5 grid grid-cols-3 gap-2.5" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <BoardCard key={i} radius={14} className="space-y-2 px-3 py-3">
              <Bone w={22} h={22} className="rounded-md" />
              <Bone w={36} h={9} />
              <Bone w={48} h={9} />
              <Bone w="100%" h={20} className="rounded-md" />
              <Bone w={54} h={7} />
            </BoardCard>
          ))}
          <span className="sr-only">Loading the names gaining attention</span>
        </div>
      ) : rows.length === 0 ? (
        <FoundingLine className="mt-3">
          No name has gained ground on the board this fortnight. Watch a ticker,
          ask Kai about it, or post a thesis — attention is the only thing that
          moves a name onto this row.
        </FoundingLine>
      ) : (
        <div className="mt-2.5 grid grid-cols-3 gap-2.5">
          {rows.map((r) => {
            const watchers = r.watchers ?? 0;
            const shown = watchers >= FLOORS.tickerParticipants;
            return (
              <BoardCard
                key={r.ticker}
                radius={14}
                className="transition-colors hover:border-accent"
              >
                <Link
                  href={`/research/${encodeURIComponent(r.ticker)}`}
                  className="f0-focus block rounded-[14px] px-3 py-[11px]"
                >
                  {/* The card led with a mono ticker and nothing else — three
                      white cards in a row identified only by four letters. The
                      real company mark does the identifying now; the ticker
                      stays, because a logo alone is not a name you can search. */}
                  <CompanyLogo
                    symbol={r.ticker}
                    size={22}
                    rounded="rounded-md"
                    className="mb-1.5"
                  />
                  <span className="block font-mono text-[12px] font-semibold text-ink">
                    {r.ticker.toUpperCase()}
                  </span>
                  <span className="mt-[3px] block font-mono text-[11px] text-sentiment">
                    ▲ +{Math.round(r.change ?? 0)}
                  </span>
                  <TickerSpark symbol={r.ticker} className="mt-1.5 block" height={22} />
                  <span className="mt-1.5 block truncate text-[9.5px] text-soft">
                    {shown ? `${watchers.toLocaleString()} watching` : "New on the board"}
                  </span>
                </Link>
              </BoardCard>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── MOST DIVISIVE ───────────────────────────────────────────────────────── */
/**
 * Board 02 §2, built as drawn: one white card, the bull share on the left, the
 * bear share on the right, and a 104px DONUT between them with the company's
 * mark punched into the middle.
 *
 * The previous pass replaced the donut with a split bar. The owner overruled
 * that; the ring is back, and it is a real conic arc at the real bull share.
 *
 * A split needs BODIES before it can be called divisive: the row must carry at
 * least DIVISIVE_MIN_POSITIONED positioned members and sit inside the contested
 * band, and the denominator always ships with the percentages — so a four-vote
 * split can never masquerade as consensus.
 */
const DIVISIVE_MIN_POSITIONED = 4;
const DIVISIVE_MAX_GAP = 20; // bullPct within 30–70

function pickDivisive(rows: TrendingRow[]): TrendingRow | null {
  let best: TrendingRow | null = null;
  let bestGap = Infinity;
  for (const r of rows) {
    const s = r.sentiment;
    if (!s || s.bullPct == null) continue;
    if (s.bull + s.neutral + s.bear < DIVISIVE_MIN_POSITIONED) continue;
    const gap = Math.abs(50 - s.bullPct);
    if (gap <= DIVISIVE_MAX_GAP && gap < bestGap) {
      best = r;
      bestGap = gap;
    }
  }
  return best;
}

function MostDivisive({ row, loading }: { row: TrendingRow | null; loading: boolean }) {
  const s = row?.sentiment;
  const positioned = s ? s.bull + s.neutral + s.bear : 0;
  const bullPct = s?.bullPct ?? null;
  const bearPct = s && positioned > 0 ? Math.round((s.bear / positioned) * 100) : null;

  return (
    <section className="mt-6" aria-labelledby="discover-divisive">
      <SectionMark
        id="discover-divisive"
        label="Most divisive"
        gloss="Biggest split in opinions"
        right={
          row ? (
            <Link
              href={`/research/${encodeURIComponent(row.ticker)}?tab=community`}
              className="f0-focus rounded text-[12px]"
              aria-label={`Open the ${row.ticker} thread`}
            >
              →
            </Link>
          ) : undefined
        }
      />

      {loading ? (
        <BoardCard radius={16} className="mt-2.5 flex items-center gap-4 p-4" aria-busy="true">
          <div className="flex flex-1 flex-col items-center gap-2">
            <Bone w={44} h={18} />
            <Bone w={38} h={7} />
          </div>
          <Bone w={104} h={104} className="shrink-0 !rounded-full" />
          <div className="flex flex-1 flex-col items-center gap-2">
            <Bone w={44} h={18} />
            <Bone w={38} h={7} />
          </div>
          <span className="sr-only">Loading the widest split</span>
        </BoardCard>
      ) : row && bullPct != null ? (
        <>
          <BoardCard radius={16} className="mt-2.5 flex items-center gap-4 p-4">
            <SplitSide
              pct={bullPct}
              label="Bullish"
              count={s!.bull}
              className="text-sentiment"
            />
            <Donut pct={bullPct} size={104} ring={7} tone="sentiment">
              <Link
                href={`/research/${encodeURIComponent(row.ticker)}?tab=community`}
                className="f0-focus flex flex-col items-center rounded"
              >
                <CompanyLogo
                  symbol={row.ticker}
                  name={row.company}
                  size={34}
                  rounded="rounded-[9px]"
                />
                <span className="mt-1 font-mono text-[10px] text-ink">
                  {row.ticker.toUpperCase()}
                </span>
              </Link>
            </Donut>
            <SplitSide
              pct={bearPct ?? 0}
              label="Bearish"
              count={s!.bear}
              className="text-ink"
            />
          </BoardCard>
          <p className="mt-1.5 text-center text-[10px] text-soft">
            {positioned.toLocaleString()} {positioned === 1 ? "opinion" : "opinions"}
            {s!.neutral > 0 ? ` · ${s!.neutral} neutral` : ""}
          </p>
        </>
      ) : (
        /* An absence with a picture in it. "Nothing is contested yet" is a
           true sentence and a dead one — the member reads it and leaves. The
           two-arrows drawing shows what is missing (two positions passing
           without meeting), and the sentence names the exact thing that would
           fill the block, so the empty state is a brief rather than a shrug.
           It sits on the section's own rule line, not inside a card. */
        <EmptyStateNote
          className="mt-1"
          art={<EmptyTwoArrows size={72} title="Two positions passing without meeting" />}
          title="Nothing is contested yet"
        >
          A split needs at least {DIVISIVE_MIN_POSITIONED} members on the same
          company taking opposite sides. Take a position on any ticker and the
          argument starts here.
        </EmptyStateNote>
      )}
    </section>
  );
}

function SplitSide({
  pct,
  label,
  count,
  className,
}: {
  pct: number;
  label: string;
  count: number;
  className: string;
}) {
  return (
    <div className="flex-1 text-center">
      <p className={`text-[22px] font-extrabold tracking-[-0.02em] ${className}`}>{pct}%</p>
      <p
        className={`mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.14em] ${className}`}
      >
        {label}
      </p>
      <p className="mt-2 font-mono text-[9.5px] tabular-nums text-soft">
        {count} {count === 1 ? "member" : "members"}
      </p>
    </div>
  );
}

/* ── BLACK BELTS ARE WATCHING ────────────────────────────────────────────── */
/**
 * Board 02 §3 — a row of 46px company discs with the ticker beneath each.
 *
 * REAL ROSTER, not a relabelled trending list: `getDiscoverExtras` derives the
 * black-belt set from `xp_leaderboard_individuals` through the same `beltForXp`
 * the belt ladder uses, then counts their `ticker_sentiment` watches. With no
 * black belts on the roster the row does not borrow a fallback — it says the
 * belt is unclaimed, which is the true and more interesting sentence.
 */
function BlackBeltsWatching({
  names,
  blackBelts,
}: {
  names: DiscoverExtras["beltWatch"];
  blackBelts: number;
}) {
  return (
    <section className="mt-6" aria-labelledby="discover-belts">
      <SectionMark
        id="discover-belts"
        label="Black belts are watching"
        right={
          <Link href="/leaderboard" className="f0-focus rounded">
            See all
          </Link>
        }
      />

      {names.length === 0 ? (
        <FoundingLine className="mt-3">
          {blackBelts === 0
            ? "No one has reached Black Belt yet. The first member who does sets this row — and everyone gets to see what they're watching."
            : "The Club's black belts haven't put anything on their watchlists yet."}
        </FoundingLine>
      ) : (
        <div className="club2-track -mx-1 mt-2.5 flex gap-[13px] overflow-x-auto px-1">
          {names.map((n) => (
            <Link
              key={n.ticker}
              href={`/research/${encodeURIComponent(n.ticker)}`}
              className="f0-focus shrink-0 rounded-lg text-center"
              title={`${n.belts} ${n.belts === 1 ? "black belt is" : "black belts are"} watching ${n.ticker}`}
            >
              <CompanyLogo
                symbol={n.ticker}
                name={n.name}
                size={46}
                rounded="rounded-full"
              />
              <span className="mt-[5px] block font-mono text-[9px] text-ink/80">
                {n.ticker}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── FROM QUIET TO LOUD ──────────────────────────────────────────────────── */
/**
 * Board 02 §4 — five bare sparklines with the ticker beneath.
 *
 * The board paints the five lines in five different hues (red, orange, amber,
 * green, green) encoding nothing. Here every line is a real 3-month price
 * series and takes the price ramp from its own direction, which is the only
 * thing a coloured line on this app may mean.
 */
function QuietToLoud({ rows, loading }: { rows: TrendingRow[]; loading: boolean }) {
  return (
    <section className="mt-6" aria-labelledby="discover-quiet">
      <SectionMark
        id="discover-quiet"
        label="From quiet to loud"
        gloss="Names the Club just woke up on"
      />

      {loading ? (
        <div className="mt-2.5 grid grid-cols-5 gap-2.5" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Bone w={20} h={20} className="mx-auto rounded-md" />
              <Bone w="100%" h={28} className="rounded-md" />
              <Bone w={30} h={7} className="mx-auto" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <FoundingLine className="mt-3">
          Nothing new has woken up behind the leaders yet. The moment a quiet
          name starts collecting watches and theses, it appears here.
        </FoundingLine>
      ) : (
        <div className="mt-2.5 grid grid-cols-5 gap-2.5">
          {rows.map((r) => (
            <Link
              key={r.ticker}
              href={`/research/${encodeURIComponent(r.ticker)}`}
              className="f0-focus rounded text-center"
            >
              {/* Five bare sparklines were five anonymous squiggles. The mark
                  above each one is what makes the row scannable. */}
              <CompanyLogo
                symbol={r.ticker}
                size={20}
                rounded="rounded-md"
                className="mx-auto"
              />
              <TickerSpark symbol={r.ticker} height={30} width={60} className="mt-1 block" />
              <span className="mt-1 block font-mono text-[10px] text-ink">
                {r.ticker.toUpperCase()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── TRENDING ────────────────────────────────────────────────────────────── */
/**
 * The ranked attention ledger, drawn in board 15's ROW-CARD language: a 26px
 * company mark, the ticker in mono, the price, the day move in the price ramp
 * and the Club's signal as a lime chip. Below it, board 15's paired "Club's
 * most bullish / most bearish" cards, then the surface's two member-authored
 * sections.
 */
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

  // ONE batched quote request covering the board + For-You universe, which the
  // trending endpoint does not price. No N+1.
  const extraTickers = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => e.ticker && s.add(e.ticker.toUpperCase()));
    movers.forEach((mv) => mv.ticker && s.add(mv.ticker.toUpperCase()));
    return Array.from(s);
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
    [entries]
  );

  const stanced = useMemo(
    () => rows.filter((r) => r.sentiment?.bullPct != null),
    [rows]
  );
  const mostBullish = useMemo(
    () =>
      [...stanced]
        .sort((a, b) => (b.sentiment!.bullPct ?? 0) - (a.sentiment!.bullPct ?? 0))
        .slice(0, 3),
    [stanced]
  );
  const mostBearish = useMemo(
    () =>
      [...stanced]
        .sort((a, b) => (a.sentiment!.bullPct ?? 0) - (b.sentiment!.bullPct ?? 0))
        .slice(0, 3),
    [stanced]
  );

  // The free cap, straight from the server's own account of it. Absent (a Club
  // member, or a response that carried no cap) → nothing extra is drawn: no
  // orphan rule, no empty line.
  const freeCap = trending?.freeCap;
  const totalCount = trending?.totalCount;
  const withheldRanks = useMemo(() => {
    if (!trending?.locked || freeCap == null || totalCount == null) return [];
    const n = totalCount - freeCap;
    if (n <= 0) return [];
    return Array.from({ length: n }, (_, i) => freeCap + i + 1);
  }, [trending?.locked, freeCap, totalCount]);

  return (
    <>
      <SectionMark
        label={
          loading
            ? "Ranked by Club signal"
            : `${rows.length} ${rows.length === 1 ? "name" : "names"} · sorted by Club signal`
        }
        gloss="Live ranking by member attention and conviction"
      />

      {loading ? (
        <div className="mt-2.5 flex flex-col gap-[7px]" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <BoardCard key={i} radius={12} className="flex items-center gap-2.5 px-[11px] py-[9px]">
              <Bone w={26} h={26} className="!rounded-lg" />
              <Bone w={44} h={9} />
              <Bone w="40%" h={9} className="ml-auto" />
            </BoardCard>
          ))}
          <span className="sr-only">Loading the ledger</span>
        </div>
      ) : rows.length === 0 ? (
        <FoundingLine className="mt-3">
          The Club hasn&apos;t formed a read yet. Rate a ticker on the{" "}
          <Link href="/watchlist/community" className="font-bold text-gold-700 underline decoration-1 underline-offset-2">
            Community Watchlist
          </Link>{" "}
          and you&apos;ll be the first signal on this board.
        </FoundingLine>
      ) : (
        <div className="mt-2.5 flex flex-col gap-[7px]">
          {rows.map((r) => (
            <SignalRow
              key={r.ticker}
              ticker={r.ticker}
              name={r.company ?? null}
              price={r.price ?? null}
              changePct={r.changePct ?? null}
              signal={r.sentiment?.bullPct ?? null}
              rank={r.rank}
            />
          ))}
        </div>
      )}

      {/* THE CAP, DRAWN HONESTLY. The server ships free callers the top 5 and
          says so (`locked` + `totalCount`/`freeCap`); the ranks it withheld are
          drawn as REDACTIONS — a real rank number beside an obscured bar — never
          as invented tickers or figures. Nothing here fetches a row the member
          could not already fetch. A Club member has no cap, so nothing renders. */}
      {withheldRanks.length > 0 && (
        <>
          <p className="sr-only">
            {withheldRanks.length} further{" "}
            {withheldRanks.length === 1 ? "rank is" : "ranks are"} withheld from
            this ledger.
          </p>
          <div
            role="presentation"
            aria-hidden
            className="pointer-events-none mt-[7px] flex flex-col gap-[7px]"
          >
            {withheldRanks.map((rank) => (
              <RedactedSignalRow key={rank} rank={rank} />
            ))}
          </div>
          <UnlockLine cta={TRENDING_WALL.cta}>
            {freeCap} of {totalCount} names shown. The Club opens{" "}
            {TRENDING_WALL_DETAIL}
          </UnlockLine>
        </>
      )}

      {rows.length > 0 && (
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-soft">
          {trending?.disclaimer ?? "Attention inside the Club — not a recommendation."}
          {" · Prices delayed ~15 min."}
        </p>
      )}

      {/* Board 15's paired conviction cards — green-tinted hairline on the bull
          card, pink on the bear card, exactly as drawn. The percentages inside
          are COMMUNITY SENTIMENT, so they take the lime ramp and an ink tint
          rather than the price green/red the board paints them in. */}
      {(mostBullish.length > 0 || mostBearish.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <ConvictionCard title="Club's most bullish" rows={mostBullish} tone="bull" />
          <ConvictionCard title="Club's most bearish" rows={mostBearish} tone="bear" />
        </div>
      )}

      {/* MOST DISCUSSED */}
      <section className="mt-7" aria-labelledby="discover-discussed">
        <SectionMark
          id="discover-discussed"
          label="Most discussed"
          gloss="Where the Club is actually talking"
        />
        {discussed.length === 0 ? (
          <FoundingLine className="mt-3">
            No thread has caught yet. Champion an idea on the{" "}
            <Link href="/watchlist/community" className="font-bold text-gold-700 underline decoration-1 underline-offset-2">
              Community Watchlist
            </Link>{" "}
            and the conversation starts here.
          </FoundingLine>
        ) : (
          <div className="mt-2.5 flex flex-col gap-[7px]">
            {discussed.map((e) => {
              const t = e.ticker.toUpperCase();
              const q = quotes[t];
              const row = intel.get(t);
              return (
                <SignalRow
                  key={e.id}
                  ticker={e.ticker}
                  name={e.company_name}
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
      <section className="mt-7" aria-labelledby="discover-research">
        <SectionMark
          id="discover-research"
          label="Top research"
          gloss="The thinking behind the names"
        />
        <ResearchCards contributions={contributions} reports={reports} />
      </section>
    </>
  );
}

/**
 * Board 15's result row, as a card: mark · ticker · sparkline · price · move ·
 * signal chip. The sparkline is a real 3-month series, deferred until the row
 * scrolls into view.
 */
function SignalRow({
  ticker,
  name,
  price,
  changePct,
  signal,
  rank,
  comments,
}: {
  ticker: string;
  name: string | null;
  price: number | null;
  changePct: number | null;
  /** community bull share — the "Club signal". null until anyone positions. */
  signal: number | null;
  rank?: number;
  comments?: number;
}) {
  const tone = changeTone(changePct ?? undefined);
  return (
    <BoardCard radius={12} className="transition-colors hover:border-accent">
      <Link
        href={`/research/${encodeURIComponent(ticker)}`}
        className="f0-focus flex items-center gap-2.5 rounded-[12px] px-[11px] py-[9px]"
      >
        {rank != null && (
          <span
            aria-hidden
            className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-soft"
          >
            {rank}
          </span>
        )}
        <CompanyLogo symbol={ticker} name={name} size={26} rounded="rounded-[8px]" />
        <span className="w-[46px] shrink-0 font-mono text-[11px] font-semibold text-ink">
          {ticker.toUpperCase()}
        </span>
        <span className="hidden w-[52px] shrink-0 sm:block">
          <TickerSpark symbol={ticker} height={18} width={52} strokeWidth={1.6} className="block" />
        </span>
        <span className="flex-1 truncate text-right font-mono text-[10.5px] tabular-nums text-ink">
          {formatPrice(price ?? undefined) || "—"}
        </span>
        <span
          className={`w-[46px] shrink-0 text-right font-mono text-[10px] tabular-nums ${
            tone === "up" ? "text-price-up" : tone === "down" ? "text-price-down" : "text-soft"
          }`}
        >
          {formatChangePct(changePct ?? undefined) || "—"}
        </span>
        {comments != null ? (
          <span className="shrink-0 rounded-[8px] bg-sand px-[7px] py-[3px] font-mono text-[10px] font-semibold tabular-nums text-soft">
            {comments}
          </span>
        ) : signal != null ? (
          <span className="shrink-0 rounded-[8px] bg-sentiment-fill/12 px-[7px] py-[3px] font-mono text-[10px] font-semibold tabular-nums text-sentiment">
            {signal}%
          </span>
        ) : (
          <span className="shrink-0 rounded-[8px] px-[7px] py-[3px] font-mono text-[10px] text-soft/70">
            —
          </span>
        )}
      </Link>
    </BoardCard>
  );
}

/**
 * A rank the free tier does not receive, drawn as a REDACTION of the row above
 * it — the real rank number, and obscured bars where the mark, ticker, price,
 * move and signal would sit. No ticker, price or score is ever invented here:
 * the point is that the member can see something was withheld, not guess at it.
 * Inert by construction (`pointer-events-none` on the wrapper, no link).
 */
function RedactedSignalRow({ rank }: { rank: number }) {
  const bar = "rounded-[4px] bg-soft/15 blur-[5px]";
  return (
    <BoardCard radius={12} className="select-none">
      <div className="flex items-center gap-2.5 px-[11px] py-[9px]">
        <span className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-soft">
          {rank}
        </span>
        <span aria-hidden className={`h-[26px] w-[26px] shrink-0 rounded-[8px] bg-soft/15 blur-[5px]`} />
        <span aria-hidden className={`h-[10px] w-[46px] shrink-0 ${bar}`} />
        <span aria-hidden className={`hidden h-[10px] w-[52px] shrink-0 sm:block ${bar}`} />
        <span aria-hidden className={`ml-auto h-[10px] w-[54px] ${bar}`} />
        <span aria-hidden className={`h-[10px] w-[34px] shrink-0 ${bar}`} />
        <span aria-hidden className={`h-[10px] w-[26px] shrink-0 ${bar}`} />
      </div>
    </BoardCard>
  );
}

/** Board 15's paired conviction cards. */
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
  return (
    <div
      className={`rounded-[16px] border bg-card px-3.5 py-[13px] ${
        tone === "bull" ? "border-sentiment/40" : "border-sand"
      }`}
    >
      <p
        className={`font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em] ${
          tone === "bull" ? "text-sentiment" : "text-soft"
        }`}
      >
        {title}
      </p>
      <div className="mt-2.5 flex flex-col gap-2">
        {rows.map((r) => (
          <Link
            key={r.ticker}
            href={`/research/${encodeURIComponent(r.ticker)}?tab=community`}
            className="f0-focus flex items-center justify-between rounded"
          >
            <span className="font-mono text-[11px] font-semibold text-ink">
              {r.ticker.toUpperCase()}
            </span>
            <span
              className={`font-mono text-[10.5px] tabular-nums ${
                tone === "bull" ? "text-sentiment" : "text-ink"
              }`}
            >
              {tone === "bull"
                ? `${r.sentiment!.bullPct}%`
                : `${100 - (r.sentiment!.bullPct ?? 0)}%`}
            </span>
          </Link>
        ))}
      </div>
    </div>
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
      <FoundingLine className="mt-3">
        The best deep-dives land here as members post them. Be first — drop a
        thesis on any idea&apos;s{" "}
        <Link href="/community" className="font-bold text-gold-700 underline decoration-1 underline-offset-2">
          research page
        </Link>
        .
      </FoundingLine>
    );
  }

  return (
    <div className="mt-2.5 flex flex-col gap-2.5">
      {contributions.map((c) => {
        const meta = contributionMeta(c.contribution_type);
        const stamp = timeAgoAt(c.created_at, now);
        return (
          <BoardCard key={c.id} radius={16} className="transition-colors hover:border-accent">
            <Link
              href={`/research/${encodeURIComponent(c.ticker)}`}
              className="f0-focus block rounded-[16px] px-[15px] py-[14px]"
            >
              <div className="flex items-center gap-2">
                <Avatar
                  name={c.author?.display_name}
                  avatarUrl={c.author?.avatar_url}
                  role={c.author?.role}
                  size="sm"
                />
                <span className="truncate font-display text-[12.5px] font-bold text-ink">
                  {c.author?.username
                    ? `@${c.author.username}`
                    : c.author?.display_name || "A member"}
                </span>
                <AgeBadge role={c.author?.role} ageGroup={c.author?.age_group} />
                <span className="shrink-0 font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-soft">
                  {meta.label}
                </span>
                {stamp && (
                  <span className="ml-auto shrink-0 font-mono text-[9.5px] text-soft">
                    {stamp}
                  </span>
                )}
              </div>
              <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-ink">
                {c.snippet}
              </p>
              <p className="mt-2 font-mono text-[10px] font-semibold text-gold-700">
                ${c.ticker.toUpperCase()}
              </p>
            </Link>
          </BoardCard>
        );
      })}

      {reports.map((r) => {
        const stamp = timeAgoAt(r.generated_at, now);
        return (
          <BoardCard
            key={`kai-${r.ticker}`}
            radius={16}
            className="transition-colors hover:border-accent"
          >
            <Link
              href={`/research/${encodeURIComponent(r.ticker)}`}
              className="f0-focus block rounded-[16px] px-[15px] py-[14px]"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-kai-500/12 text-kai-600 dark:bg-kai-500/22 dark:text-kai-300">
                  <Bot className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-display text-[12.5px] font-bold text-ink">Kai</span>
                <span className="shrink-0 font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-kai-600 dark:text-kai-300">
                  AI deep-dive
                </span>
                {stamp && (
                  <span className="ml-auto shrink-0 font-mono text-[9.5px] text-soft">
                    {stamp}
                  </span>
                )}
              </div>
              <p className="mt-2.5 font-display text-[15px] font-bold leading-snug text-ink">
                {r.company_name
                  ? `${r.company_name} — full research report`
                  : "Full research report"}
              </p>
              <p className="mt-2 font-mono text-[10px] font-semibold text-gold-700">
                ${r.ticker.toUpperCase()}
              </p>
            </Link>
          </BoardCard>
        );
      })}
    </div>
  );
}

/* ── live club data ──────────────────────────────────────────────────────── */
/**
 * Discover reads the one endpoint it needs rather than the nine-section
 * /api/club/home batch. It fails soft to null — every section renders a
 * designed founding state instead of a spinner or a fabricated number — and
 * LOADING IS NOT EMPTY: the flag is what keeps a slow ledger from painting
 * "the Club hasn't formed a read yet".
 */
function useClubLedger() {
  const [trending, setTrending] = useState<TrendingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/club/trending", {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    })
      .then((res) => (res.ok ? (res.json() as Promise<TrendingResponse>) : null))
      .then((d) => {
        if (d) setTrending(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  return { trending, loading };
}

/* ════════════════════════════════════════════════════════════════════════════
 * CLUB MODE — the owner's mockup board, object for object.
 *
 * SOURCE OF TRUTH: the Discover phone of the club board
 * `~/Downloads/mobile-app-design-consultation/uploads/ChatGPT Image Aug 7,
 * 2026 at 10_07_23 AM.png` (second phone, top row — verified by cropping the
 * board and itemizing the screen at 4×). WHAT THE PHONE DRAWS, TOP TO BOTTOM:
 *
 *   app bar      "DISCOVER" wordmark · a violet "◈ AI" pill · a round search
 *   headline     "What are you looking for?"
 *   query bar    one rounded card, the worked ask "Show me profitable AI
 *                companies under $20B growing revenue over 20%." with a MIC
 *                glyph in the right slot
 *   KAI INTERPRETATION
 *                a card labeled in violet small caps, holding plain-phrase
 *                chips: "Market Cap < $20B" · "Profitable" · "Revenue
 *                Growth > 20%" · "Industry: AI"
 *   tabs         Screens · Top Matches · Trending · Saved — the live one in
 *                violet with a violet underline. SCREENS leads and is the
 *                default: the screener is the primary surface of Discover
 *                now, so the board opens on the full universe rather than a
 *                curated list (kid registers, with no Screens door, still
 *                open on Top Matches).
 *   result rows  round company mark · bold name · line 2 "$7.2B  Rev +46%
 *                YoY" · line 3 "Profitable · 87% Bullish" in green · the
 *                ticker in mono · the price bold right · a green sparkline ·
 *                a gold star at the far edge
 *
 * TOKEN MAP (board paint → app token): phone paper→--paper · row/query
 * cards→bg-card · chip ground→bg-sand · white→text-ink · the violet (AI pill,
 * KAI label, live tab)→--kai-blue / text-kai-* · the green bullish line→
 * text-sentiment (community, never the price ramp) · sparkline→price tokens
 * (TickerSpark tints by real sign) · the gold star→gold-700, the accent
 * ramp's readable end. Nothing hard-coded; club-light flips free.
 *
 * HONESTY ADAPTATIONS (real data only — nothing invented):
 *  · The board paints a worked ask at rest. Until the member asks, the bar
 *    carries the board's sentence as the PLACEHOLDER and the KAI
 *    INTERPRETATION card doesn't exist; a real ask is parsed by the same
 *    deterministic src/lib/screener-nl.ts the screener runs, so the chips are
 *    exactly the filters applied. The parser has no "Profitable" / revenue-
 *    growth facts (no fundamentals feed), so those chips appear only if a
 *    future parse produces them — never as decoration.
 *  · Result rows: line 2's "$7.2B" is the REAL market cap (screener_metrics);
 *    its "Rev +46% YoY" has no data source, so the slot carries the real 3-
 *    month price move instead. Line 3's "87% Bullish" is the ledger's real
 *    bull share (absent = not drawn); "Profitable" is omitted — no feed.
 *  · At rest the row list is the ranked community-attention ledger
 *    (/api/club/trending) — real floors, the server's free cap redactions,
 *    the unlock line and the verbatim compliance disclaimer. An ask swaps in
 *    real screener matches from the top of the market-cap universe, with the
 *    coverage stated and the full screener one tap away (Screens tab).
 *  · The mic has no voice backend — the glyph is the Kai handoff. The star is
 *    the family-watchlist add (the same write the screener's own star makes);
 *    with no family to write to, no star is drawn.
 *  · Free-tier meters and the kid walls are unchanged: kids get no Screens /
 *    Saved doors and a plain-English ask stays shut, exactly as the server
 *    resolved `showScreener`.
 * ══════════════════════════════════════════════════════════════════════════*/

type ClubTab = "matches" | "trending" | "screens" | "saved";

const CLUB_PANEL_ID = "club-discover-panel";

/** Ticker-shaped asks go straight to research, like the family masthead's. */
const TICKERISH = /^[A-Za-z][A-Za-z.\-]{0,5}$/;

/** The board's worked ask, verbatim — as the INVITATION, never as data. */
const CLUB_ASK_PLACEHOLDER =
  "Show me profitable AI companies under $20B growing revenue over 20%.";

function ClubDiscover({ board, extras, showScreener = true }: DiscoverClientProps) {
  const router = useRouter();
  const { openKai } = useKaiSheet();
  const askRef = useRef<HTMLInputElement>(null);

  const entries = useMemo(() => board?.entries ?? [], [board]);
  const contributions = extras?.contributions ?? [];
  const reports = extras?.reports ?? [];

  const { trending, loading } = useClubLedger();
  const rows = useMemo(() => trending?.rows ?? [], [trending]);

  // SCREENS is the default door — the screener is Discover's primary surface.
  // A kid register has no Screens tab, so the `activeTab` fallback below lands
  // them on Top Matches without ever mounting the walled surface.
  const [tab, setTab] = useState<ClubTab>("screens");
  const [draft, setDraft] = useState("");
  /** The last plain-English ask. null = none yet — the honest default state. */
  const [query, setQuery] = useState<string | null>(null);
  const [seedScreenId, setSeedScreenId] = useState<string | null>(null);

  const parsed = useMemo(
    () => (query ? parseScreenerQuery(query) : null),
    [query]
  );

  // The board's result rows, run against the REAL top-of-universe page.
  const matches = useClubMatches(query, parsed, showScreener);
  // The board's gold star — the family-watchlist add, shared by every row.
  const star = useWatchStar();

  /** ticker → ledger row, for the green "% Bullish" line on match rows. */
  const intel = useMemo(() => {
    const m = new Map<string, TrendingRow>();
    for (const r of rows) m.set(r.ticker.toUpperCase(), r);
    return m;
  }, [rows]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    if (TICKERISH.test(t)) {
      router.push(`/research/${encodeURIComponent(t.toUpperCase())}`);
      return;
    }
    // Kid wall: the screener door stays shut, exactly as the server resolved.
    if (!showScreener) return;
    setQuery(t);
    setTab("matches");
  }

  function clearAsk() {
    setDraft("");
    setQuery(null);
  }

  function runSavedScreen(id: string) {
    setSeedScreenId(id);
    setTab("screens");
  }

  // Screens leads (and is the default active tab); Saved keeps the tail.
  // Kid registers get neither door, exactly as the server resolved.
  const tabs: { key: ClubTab; label: string }[] = [
    ...(showScreener ? [{ key: "screens" as const, label: "Screens" }] : []),
    { key: "matches", label: "Top Matches" },
    { key: "trending", label: "Trending" },
    ...(showScreener ? [{ key: "saved" as const, label: "Saved" }] : []),
  ];
  const activeTab: ClubTab = tabs.some((t) => t.key === tab) ? tab : "matches";

  return (
    <div className="mx-auto max-w-2xl pb-16 lg:max-w-3xl">
      {/* ── the board's app bar: wordmark · violet AI pill · round search ── */}
      <header className="flex items-center justify-between gap-3">
        <span className="font-display text-[13px] font-bold uppercase tracking-[0.24em] text-ink">
          Discover
        </span>
        <span className="flex items-center gap-2">
          {/* The "◈ AI" pill — the Kai handoff, in Kai's own violet. */}
          <button
            type="button"
            onClick={() => openKai({ chip: "Discover", query: null })}
            aria-label="Ask Kai"
            className="f0-focus f0-press flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[12px] font-bold text-kai-600 dark:text-kai-300"
            style={{
              backgroundColor: "var(--kai-blue-soft)",
              borderColor: "color-mix(in srgb, var(--kai-blue) 40%, transparent)",
            }}
          >
            <Bot className="h-3.5 w-3.5" aria-hidden />
            AI
          </button>
          <RoundButton label="Search" onClick={() => askRef.current?.focus()}>
            <Search className="h-4 w-4" aria-hidden />
          </RoundButton>
        </span>
      </header>

      {/* ── headline ── */}
      <h1 className="mt-4 font-display text-[24px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink">
        What are you looking for?
      </h1>

      {/* ── the query bar: one rounded card, mic in the right slot. The
          board's worked ask is the PLACEHOLDER; the mic (no voice backend
          exists) is the Kai handoff; a typed ask swaps in the run arrow. ── */}
      <form onSubmit={submit} role="search" className="mt-4">
        <div className="flex items-center gap-2.5 rounded-[16px] border border-sand bg-card px-[15px] py-[13px]">
          <input
            ref={askRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={CLUB_ASK_PLACEHOLDER}
            aria-label="Search a ticker, or describe a screen in plain English"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-soft/80"
          />
          {query && (
            <button
              type="button"
              onClick={clearAsk}
              aria-label="Clear the ask"
              className="f0-focus shrink-0 rounded-full p-1 text-soft transition-colors hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {draft.trim() ? (
            <button
              type="submit"
              aria-label="Run it"
              className="f0-focus f0-press shrink-0 rounded-full p-1 text-gold-700"
            >
              <ArrowRight className="h-[17px] w-[17px]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openKai({ chip: "Discover", query: null })}
              aria-label="Ask Kai"
              className="f0-focus f0-press shrink-0 rounded-full p-1 text-soft transition-colors hover:text-ink"
            >
              <Mic className="h-[17px] w-[17px]" aria-hidden />
            </button>
          )}
        </div>
      </form>

      {/* ── KAI INTERPRETATION — ONLY once a real ask exists. The chips are
          the same deterministic parse the match run applies. ── */}
      {query && parsed && <KaiInterpretation query={query} parsed={parsed} />}

      <ClubTabs tabs={tabs} value={activeTab} onChange={setTab} />

      <div
        id={CLUB_PANEL_ID}
        role="tabpanel"
        aria-labelledby={`club-discover-tab-${activeTab}`}
        className="mt-4"
      >
        {activeTab === "matches" &&
          (query && parsed && showScreener ? (
            <ClubMatchesPanel
              matches={matches}
              intel={intel}
              star={star}
              onOpenScreener={() => setTab("screens")}
            />
          ) : (
            <ClubLedgerList trending={trending} rows={rows} loading={loading} star={star} />
          ))}

        {activeTab === "trending" && (
          <ClubTrendingPanel
            trending={trending}
            rows={rows}
            loading={loading}
            entries={entries}
            contributions={contributions}
            reports={reports}
          />
        )}

        {/* The full screener lives whole behind the board's Screens tab — now
            the FIRST and default tab, so it mounts on arrival (the universe
            read is the price of being the primary surface; leaving the tab
            unmounts it again). Seeded with the standing ask / saved screen so
            the two views never disagree. */}
        {activeTab === "screens" && showScreener && (
          <ScreenerSurface
            embedded
            nlSeed={query ?? undefined}
            seedScreenId={seedScreenId}
          />
        )}

        {activeTab === "saved" && showScreener && (
          <ClubSavedScreens onRun={runSavedScreen} />
        )}
      </div>
    </div>
  );
}

/* ── the underline tab row ───────────────────────────────────────────────── */
/**
 * The board: four labels on a hairline, the live one VIOLET with a violet
 * underline (this screen's active color is Kai's — the AI pill, the KAI
 * INTERPRETATION mark and the live tab all take the same --kai-blue family).
 * The label uses the kai text ramp (`text-kai-600 dark:text-kai-300`) for
 * contrast; the underline takes the full token.
 */
function ClubTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: ClubTab; label: string }[];
  value: ClubTab;
  onChange: (t: ClubTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Discover views"
      className="club2-track mt-5 flex gap-5 overflow-x-auto border-b border-sand"
    >
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            id={`club-discover-tab-${t.key}`}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls={CLUB_PANEL_ID}
            onClick={() => onChange(t.key)}
            className={`f0-focus -mb-px shrink-0 border-b-2 border-transparent pb-2.5 text-[13px] font-semibold transition-colors ${
              on
                ? "text-kai-600 dark:text-kai-300"
                : "text-soft hover:text-ink"
            }`}
            style={on ? { borderBottomColor: "var(--kai-blue)" } : undefined}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── KAI INTERPRETATION ──────────────────────────────────────────────────── */
/**
 * The board: a card under the query bar — "KAI INTERPRETATION" in violet small
 * caps over plain-phrase chips ("Market Cap < $20B" · "Industry: AI"). The
 * query itself stays in the bar above (the board keeps it there too), and each
 * chip is one whole phrase on the sand ground — card on paper, chip on card,
 * the board's three-layer stack. Chips are DERIVED from the same deterministic
 * parse the match run applies, so what the card claims is what actually ran.
 */
function KaiInterpretation({
  query,
  parsed,
}: {
  query: string;
  parsed: ParsedScreen;
}) {
  const pairs = clubFilterPairs(parsed);
  return (
    <section
      aria-label="Kai's interpretation of your ask"
      className="mt-3 rounded-[16px] border bg-card p-3.5"
      style={{
        borderColor: "color-mix(in srgb, var(--kai-blue) 40%, var(--sand))",
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-kai-600 dark:text-kai-300">
        Kai interpretation
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {pairs.length > 0 ? (
          pairs.map((p) => (
            <span
              key={`${p.k}-${p.v}`}
              className="rounded-[10px] border border-sand bg-sand px-3 py-[7px] text-[12px] font-medium text-ink"
            >
              {p.k} {p.v}
            </span>
          ))
        ) : (
          // Nothing structured was recognised — the run falls back to a name
          // search, and the chip says so instead of inventing a filter.
          <span className="rounded-[10px] border border-sand bg-sand px-3 py-[7px] text-[12px] font-medium text-ink">
            Search &ldquo;{query}&rdquo;
          </span>
        )}
      </div>
    </section>
  );
}

/**
 * The machine form of a parse — one key·value pair per filter it produced,
 * matching src/lib/screener-nl.ts output field for field. Purely derived;
 * nothing here can disagree with what the screener applies.
 */
function clubFilterPairs(parsed: ParsedScreen): { k: string; v: string }[] {
  const f = parsed.filters;
  const out: { k: string; v: string }[] = [];
  const usd = (n: number) => (n >= 1e6 ? fmtMcap(n) : `$${n.toLocaleString()}`);
  const range = (
    min: number | null | undefined,
    max: number | null | undefined
  ) =>
    min != null && max != null
      ? `${usd(min)}–${usd(max)}`
      : min != null
        ? `> ${usd(min)}`
        : `< ${usd(max as number)}`;
  if (f.sector)
    out.push({
      k: "Sector",
      v: f.subsector ? `${f.sector} · ${f.subsector}` : f.sector,
    });
  if (f.type)
    out.push({ k: "Type", v: f.type === "etf" ? "ETFs" : "Common stock" });
  if (f.exchange) out.push({ k: "Exchange", v: f.exchange });
  if (f.minMcap != null || f.maxMcap != null)
    out.push({ k: "Mkt cap", v: range(f.minMcap, f.maxMcap) });
  if (f.minPrice != null || f.maxPrice != null)
    out.push({ k: "Price", v: range(f.minPrice, f.maxPrice) });
  if (f.minChg1d != null) out.push({ k: "1d move", v: `> ${f.minChg1d}%` });
  if (f.minChg5d != null) out.push({ k: "5d move", v: `> ${f.minChg5d}%` });
  if (f.minChg1m != null) out.push({ k: "1m move", v: `> ${f.minChg1m}%` });
  if (f.minChg3m != null) out.push({ k: "3m move", v: `> ${f.minChg3m}%` });
  if (f.minVolRatio != null)
    out.push({ k: "Rel vol", v: `> ${f.minVolRatio}×` });
  if (f.rsiMax != null) out.push({ k: "RSI", v: `< ${f.rsiMax}` });
  if (f.rsiMin != null) out.push({ k: "RSI", v: `> ${f.rsiMin}` });
  if (f.emaTrend) out.push({ k: "Trend", v: EMA_LABELS[f.emaTrend] });
  if (f.nearHigh) out.push({ k: "52w", v: "Near high" });
  if (f.nearLow) out.push({ k: "52w", v: "Near low" });
  if (f.minGap != null) out.push({ k: "Gap", v: `> ${f.minGap}%` });
  if (f.maxGap != null) out.push({ k: "Gap", v: `< ${f.maxGap}%` });
  const kw = (parsed.leftover || "").replace(/\s+/g, " ").trim();
  if (kw && parsed.matched.length > 0) out.push({ k: "Keyword", v: kw });
  return out;
}

const EMA_LABELS: Record<NonNullable<CustomFilters["emaTrend"]>, string> = {
  above20: "> 20-day EMA",
  below20: "< 20-day EMA",
  above50: "> 50-day EMA",
  below50: "< 50-day EMA",
  above2050: "> 20 & 50 EMA",
};

/* ── the match run ───────────────────────────────────────────────────────── */
/**
 * The board's result rows, run for real. One page of the same
 * `screener_metrics` read the full screener opens with (top of the universe by
 * market cap — the columns and ordering are that surface's own, copied small
 * rather than importing its whole engine), filtered by the SAME
 * matchesCustom() the screener applies and ranked by club heat (like_count,
 * the screener's club-mode default sort). The coverage is STATED under the
 * list and the whole universe is one tap away on the Screens tab — a match
 * list that quietly scanned 8% of the market and said nothing would be a lie
 * of omission.
 *
 * Kid RLS note: `enabled` is the server-resolved `showScreener`, so a kid
 * register never even issues the read that migration 137 walls off.
 */
const MATCH_COLS =
  "ticker, name, sector, exchange, type, mcap, price, chg_1d, chg_5d, chg_1m, chg_3m, vol, avg_vol_20, vol_ratio, dist_52w_high, dist_52w_low, rsi14, ema20_state, ema50_state, gap_pct, like_count";
const MATCH_SCAN_ROWS = 1000;
const MATCH_LIMIT = 12;

interface ClubMatchesState {
  rows: ScreenerRow[] | null; // null = no completed run yet
  scanned: number | null;
  loading: boolean;
  error: string | null;
}

function useClubMatches(
  query: string | null,
  parsed: ParsedScreen | null,
  enabled: boolean
): ClubMatchesState {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<ClubMatchesState>({
    rows: null,
    scanned: null,
    loading: false,
    error: null,
  });

  /* eslint-disable react-hooks/set-state-in-effect -- syncing to a NEW ask
     from the host IS an external-input sync (same contract as the screener's
     own seed effects): one reset per distinct query, then the async read. */
  useEffect(() => {
    if (!query || !parsed || !enabled) {
      setState({ rows: null, scanned: null, loading: false, error: null });
      return;
    }
    let live = true;
    setState({ rows: null, scanned: null, loading: true, error: null });
    supabase
      .from("screener_metrics")
      .select(MATCH_COLS)
      .not("price", "is", null)
      .order("mcap", { ascending: false, nullsFirst: false })
      .order("ticker", { ascending: true })
      .range(0, MATCH_SCAN_ROWS - 1)
      .then(({ data, error }) => {
        if (!live) return;
        if (error) {
          setState({
            rows: null,
            scanned: null,
            loading: false,
            error:
              "The market universe couldn't be read just now. Try again, or open the full screener.",
          });
          return;
        }
        const all = (data as unknown as ScreenerRow[]) ?? [];
        // Same graceful degrade as the screener's own NL box: a parse with no
        // recognised filters becomes a name/ticker search, never a guess.
        const f: CustomFilters =
          parsed.matched.length > 0
            ? { ...parsed.filters, q: parsed.leftover || null }
            : { q: query };
        const hit = all.filter((r) => matchesCustom(r, f));
        setState({
          rows: sortRows(hit, "like_count", "desc").slice(0, MATCH_LIMIT),
          scanned: all.length,
          loading: false,
          error: null,
        });
      });
    return () => {
      live = false;
    };
  }, [supabase, query, parsed, enabled]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return state;
}

/* ── the gold star ───────────────────────────────────────────────────────── */
/**
 * The board draws a gold star on every result row. The one real write a star
 * can make here is the same one the screener's own row action makes: a
 * `family_watchlist` insert (status "watch", the member as champion — the
 * pattern copied small from ScreenerSurface.addToFamily). Already-watched
 * tickers render the star filled; a member with no family gets NO star rather
 * than a dead control. Adds only — removing a watchlist row can carry research
 * and notes away with it, so that stays on the Watchlist surface.
 */
interface WatchStar {
  canStar: boolean;
  watched: Set<string>;
  busy: string | null;
  add: (ticker: string, name: string | null, price: number | null) => void;
}

function useWatchStar(): WatchStar {
  const supabase = useMemo(() => createClient(), []);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || !live) return;
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .maybeSingle();
      const fid =
        (profile as { family_id?: string | null } | null)?.family_id ?? null;
      if (!live) return;
      setFamilyId(fid);
      if (!fid) return;
      const { data } = await supabase
        .from("family_watchlist")
        .select("ticker")
        .eq("family_id", fid);
      if (!live || !data) return;
      setWatched(
        new Set(
          (data as { ticker: string }[]).map((r) => r.ticker.toUpperCase())
        )
      );
    })();
    return () => {
      live = false;
    };
  }, [supabase]);

  const add = useCallback(
    async (ticker: string, name: string | null, price: number | null) => {
      if (!familyId || !userId || busy) return;
      const t = ticker.toUpperCase();
      if (watched.has(t)) return;
      setBusy(t);
      const { error } = await supabase.from("family_watchlist").insert({
        family_id: familyId,
        company_name: name || t,
        ticker: t,
        status: "watch",
        champion_id: userId,
        snapshot_price: price,
        snapshot_at: new Date().toISOString(),
      });
      if (!error) setWatched((prev) => new Set(prev).add(t));
      setBusy(null);
    },
    [supabase, familyId, userId, busy, watched]
  );

  return { canStar: familyId != null, watched, busy, add };
}

/* ── one result row, exactly as the board draws it ───────────────────────── */
/**
 * Anatomy, left to right: 40px round mark · bold name over a soft mono line 2
 * over a green "% Bullish" line 3 · the mono ticker and the bold price on one
 * baseline · a real sparkline under the price (TickerSpark — daily closes,
 * tinted by their true sign) · the gold star at the edge. Line 2 and line 3
 * carry only what a feed carries — see the branch header for what the board's
 * "Rev +46% YoY" / "Profitable" honestly become.
 */
interface ClubRowData {
  ticker: string;
  name: string | null;
  price: number | null;
  /** The soft mono line-2 (mcap · 3m move, or the ledger's watcher count). */
  sub: string | null;
  /** The green line-3, only when someone has really positioned. */
  bullPct: number | null;
}

function ClubMatchRow({ row, star }: { row: ClubRowData; star: WatchStar }) {
  const t = row.ticker.toUpperCase();
  const on = star.watched.has(t);
  return (
    <div className="relative">
      <Link
        href={`/research/${encodeURIComponent(row.ticker)}`}
        className={`f0-focus flex items-center gap-3 rounded-[16px] border border-sand bg-card p-[13px] transition-colors hover:border-accent ${
          star.canStar ? "pr-11" : ""
        }`}
      >
        <CompanyLogo
          symbol={row.ticker}
          name={row.name}
          size={40}
          rounded="rounded-full"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[14.5px] font-bold leading-tight text-ink">
            {row.name ?? t}
          </span>
          {row.sub && (
            <span className="mt-[3px] block truncate font-mono text-[11px] text-soft">
              {row.sub}
            </span>
          )}
          {row.bullPct != null && (
            <span className="mt-[3px] flex items-center gap-1.5 text-[11.5px] font-semibold text-sentiment">
              <span
                aria-hidden
                className="h-[5px] w-[5px] shrink-0 rounded-full"
                style={{ backgroundColor: "var(--sentiment-fill)" }}
              />
              {row.bullPct}% Bullish
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className="flex items-baseline justify-end gap-2.5">
            <span className="font-mono text-[11px] uppercase text-soft">
              {t}
            </span>
            <span className="font-mono text-[14px] font-semibold tabular-nums text-ink">
              {formatPrice(row.price)}
            </span>
          </span>
          <TickerSpark
            symbol={row.ticker}
            width={76}
            height={18}
            className="ml-auto mt-[7px] block w-[76px]"
          />
        </span>
      </Link>
      {star.canStar && (
        <button
          type="button"
          disabled={on || star.busy === t}
          onClick={() => star.add(row.ticker, row.name, row.price)}
          aria-label={
            on ? `${t} is on your watchlist` : `Add ${t} to your watchlist`
          }
          className="f0-focus f0-press absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5"
        >
          <Star
            aria-hidden
            className={`h-4 w-4 ${
              on
                ? "fill-current text-gold-700"
                : "text-soft transition-colors hover:text-gold-700"
            }`}
          />
        </button>
      )}
    </div>
  );
}

/* ── Top Matches with an ask standing ────────────────────────────────────── */
function ClubMatchesPanel({
  matches,
  intel,
  star,
  onOpenScreener,
}: {
  matches: ClubMatchesState;
  intel: Map<string, TrendingRow>;
  star: WatchStar;
  onOpenScreener: () => void;
}) {
  if (matches.loading) {
    return (
      <div className="flex flex-col gap-2.5" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-[16px] border border-sand bg-card p-[13px]"
          >
            <Bone w={40} h={40} className="!rounded-full" />
            <span className="flex-1">
              <Bone w={130} h={11} />
              <Bone w={90} h={9} className="mt-2" />
            </span>
            <Bone w={54} h={11} />
          </div>
        ))}
        <span className="sr-only">Running your screen</span>
      </div>
    );
  }

  if (matches.error) {
    return (
      <FoundingLine>
        {matches.error}{" "}
        <button
          type="button"
          onClick={onOpenScreener}
          className="font-bold text-gold-700 underline decoration-1 underline-offset-2"
        >
          Open the full screener
        </button>
      </FoundingLine>
    );
  }

  const rows = matches.rows ?? [];
  const scanned = matches.scanned ?? 0;

  if (rows.length === 0) {
    return (
      <FoundingLine>
        No matches in the top {scanned.toLocaleString()} companies by market
        cap.{" "}
        <button
          type="button"
          onClick={onOpenScreener}
          className="font-bold text-gold-700 underline decoration-1 underline-offset-2"
        >
          Screen the whole universe
        </button>{" "}
        or loosen the ask.
      </FoundingLine>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const sub = [
            r.mcap != null ? fmtMcap(r.mcap) : null,
            r.chg_3m != null ? `${formatChangePct(r.chg_3m)} 3m` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <ClubMatchRow
              key={r.ticker}
              star={star}
              row={{
                ticker: r.ticker,
                name: r.name,
                price: r.price,
                sub: sub || null,
                bullPct:
                  intel.get(r.ticker.toUpperCase())?.sentiment?.bullPct ?? null,
              }}
            />
          );
        })}
      </div>
      {/* Coverage, stated — never implied. */}
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-soft">
        {rows.length === MATCH_LIMIT
          ? `Top ${MATCH_LIMIT} matches`
          : `${rows.length} ${rows.length === 1 ? "match" : "matches"}`}{" "}
        in the top {scanned.toLocaleString()} by market cap · by Club signal ·{" "}
        <button
          type="button"
          onClick={onOpenScreener}
          className="font-bold text-gold-700 underline decoration-1 underline-offset-2"
        >
          Open in full screener
        </button>
      </p>
    </>
  );
}

/* ── Top Matches at rest: the attention ledger in the board's rows ───────── */
/**
 * No ask yet, so the honest "top matches" are the names the Club itself is
 * paying attention to — /api/club/trending, rank order, with the server's free
 * cap drawn as redacted rows + the unlock line, and the verbatim compliance
 * disclaimer. Line 2 is the floor-gated watcher count; line 3 the real bull
 * share.
 */
function ClubLedgerList({
  trending,
  rows,
  loading,
  star,
}: {
  trending: TrendingResponse | null;
  rows: TrendingRow[];
  loading: boolean;
  star: WatchStar;
}) {
  const freeCap = trending?.freeCap;
  const totalCount = trending?.totalCount;
  const withheldRanks = useMemo(() => {
    if (!trending?.locked || freeCap == null || totalCount == null) return [];
    const n = totalCount - freeCap;
    if (n <= 0) return [];
    return Array.from({ length: n }, (_, i) => freeCap + i + 1);
  }, [trending?.locked, freeCap, totalCount]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2.5" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-[16px] border border-sand bg-card p-[13px]"
          >
            <Bone w={40} h={40} className="!rounded-full" />
            <span className="flex-1">
              <Bone w={130} h={11} />
              <Bone w={90} h={9} className="mt-2" />
            </span>
            <Bone w={54} h={11} />
          </div>
        ))}
        <span className="sr-only">Loading the ledger</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <FoundingLine>
        The Club hasn&apos;t formed a read yet. Rate a ticker on the{" "}
        <Link
          href="/watchlist/community"
          className="font-bold text-gold-700 underline decoration-1 underline-offset-2"
        >
          Community Watchlist
        </Link>{" "}
        and you&apos;ll be the first signal on this board.
      </FoundingLine>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const watchers = r.watchers ?? 0;
          const shown = watchers >= FLOORS.tickerParticipants;
          return (
            <ClubMatchRow
              key={r.ticker}
              star={star}
              row={{
                ticker: r.ticker,
                name: r.company ?? null,
                price: r.price ?? null,
                sub: shown
                  ? `${watchers.toLocaleString()} watching`
                  : "New on the board",
                bullPct: r.sentiment?.bullPct ?? null,
              }}
            />
          );
        })}
      </div>

      {/* THE CAP, DRAWN HONESTLY — real rank numbers beside obscured bars,
          never invented tickers. */}
      {withheldRanks.length > 0 && (
        <>
          <p className="sr-only">
            {withheldRanks.length} further{" "}
            {withheldRanks.length === 1 ? "rank is" : "ranks are"} withheld from
            this ledger.
          </p>
          <div
            role="presentation"
            aria-hidden
            className="pointer-events-none mt-[7px] flex flex-col gap-[7px]"
          >
            {withheldRanks.map((rank) => (
              <RedactedSignalRow key={rank} rank={rank} />
            ))}
          </div>
          <UnlockLine cta={TRENDING_WALL.cta}>
            {freeCap} of {totalCount} names shown. The Club opens{" "}
            {TRENDING_WALL_DETAIL}
          </UnlockLine>
        </>
      )}

      <p className="mt-3 font-mono text-[10px] leading-relaxed text-soft">
        {trending?.disclaimer ??
          "Attention inside the Club — not a recommendation."}
        {" · Prices delayed ~15 min."}
      </p>
    </>
  );
}

/* ── TRENDING, in the prototype's result language ────────────────────────── */
/**
 * The same ranked attention ledger the family branch reads, drawn as the
 * prototype's results: a Cards|Table segmented toggle, result cards (38px mark
 * · Sora name + mono sym · why line · price/chg), or a ruled five-column table.
 * The free-cap redactions, the unlock line, the compliance disclaimer and the
 * conviction / discussed / research tails are IDENTICAL data to the family
 * panel — only the drawing changed.
 */
function ClubTrendingPanel({
  trending,
  rows,
  loading,
  entries,
  contributions,
  reports,
}: {
  trending: TrendingResponse | null;
  rows: TrendingRow[];
  loading: boolean;
  entries: CommunityBoardSeed["entries"];
  contributions: DiscoverExtras["contributions"];
  reports: DiscoverExtras["reports"];
}) {
  const [view, setView] = useState<"cards" | "table">("cards");

  const intel = useMemo(() => {
    const m = new Map<string, TrendingRow>();
    for (const r of rows) m.set(r.ticker.toUpperCase(), r);
    return m;
  }, [rows]);

  // ONE batched quote request for the discussed rows the ledger doesn't price.
  const extraTickers = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => e.ticker && s.add(e.ticker.toUpperCase()));
    return Array.from(s);
  }, [entries]);

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
    [entries]
  );

  const stanced = useMemo(
    () => rows.filter((r) => r.sentiment?.bullPct != null),
    [rows]
  );
  const mostBullish = useMemo(
    () =>
      [...stanced]
        .sort((a, b) => (b.sentiment!.bullPct ?? 0) - (a.sentiment!.bullPct ?? 0))
        .slice(0, 3),
    [stanced]
  );
  const mostBearish = useMemo(
    () =>
      [...stanced]
        .sort((a, b) => (a.sentiment!.bullPct ?? 0) - (b.sentiment!.bullPct ?? 0))
        .slice(0, 3),
    [stanced]
  );

  // The free cap, straight from the server's own account of it — same
  // redaction contract as the family branch.
  const freeCap = trending?.freeCap;
  const totalCount = trending?.totalCount;
  const withheldRanks = useMemo(() => {
    if (!trending?.locked || freeCap == null || totalCount == null) return [];
    const n = totalCount - freeCap;
    if (n <= 0) return [];
    return Array.from({ length: n }, (_, i) => freeCap + i + 1);
  }, [trending?.locked, freeCap, totalCount]);

  return (
    <>
      {/* Prototype toolbar: the 132px segmented Cards|Table on a sand well.
          The prototype hangs a "Sort ▾" beside it; this ledger's order is the
          server's rank, so the line STATES the sort instead of faking a menu. */}
      <div className="flex items-center gap-2.5">
        <div
          role="group"
          aria-label="Result layout"
          className="flex w-[132px] gap-1 rounded-[11px] bg-sand p-[3px]"
        >
          {(["cards", "table"] as const).map((v) => {
            const on = view === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                onClick={() => setView(v)}
                className={`f0-focus flex-1 rounded-[9px] py-[7px] text-[11.5px] font-semibold transition-colors ${
                  on ? "bg-card text-ink" : "text-soft hover:text-ink"
                }`}
              >
                {v === "cards" ? "Cards" : "Table"}
              </button>
            );
          })}
        </div>
        <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.14em] text-soft">
          {loading
            ? "By Club signal"
            : `${rows.length} ${rows.length === 1 ? "name" : "names"} · by Club signal`}
        </span>
      </div>

      {loading ? (
        <div className="mt-3.5 flex flex-col gap-2.5" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-[15px] border border-sand bg-card p-[13px]"
            >
              <Bone w={38} h={38} className="!rounded-[12px]" />
              <span className="flex-1">
                <Bone w={120} h={11} />
                <Bone w={90} h={9} className="mt-2" />
              </span>
              <Bone w={54} h={11} />
            </div>
          ))}
          <span className="sr-only">Loading the ledger</span>
        </div>
      ) : rows.length === 0 ? (
        <FoundingLine className="mt-3.5">
          The Club hasn&apos;t formed a read yet. Rate a ticker on the{" "}
          <Link
            href="/watchlist/community"
            className="font-bold text-gold-700 underline decoration-1 underline-offset-2"
          >
            Community Watchlist
          </Link>{" "}
          and you&apos;ll be the first signal on this board.
        </FoundingLine>
      ) : view === "cards" ? (
        <div className="mt-3.5 flex flex-col gap-2.5">
          {rows.map((r) => (
            <ClubResultCard key={r.ticker} r={r} />
          ))}
        </div>
      ) : (
        <ClubLedgerTable rows={rows} />
      )}

      {/* THE CAP, DRAWN HONESTLY — identical contract to the family branch:
          real rank numbers beside obscured bars, never invented tickers. */}
      {withheldRanks.length > 0 && (
        <>
          <p className="sr-only">
            {withheldRanks.length} further{" "}
            {withheldRanks.length === 1 ? "rank is" : "ranks are"} withheld from
            this ledger.
          </p>
          <div
            role="presentation"
            aria-hidden
            className="pointer-events-none mt-[7px] flex flex-col gap-[7px]"
          >
            {withheldRanks.map((rank) => (
              <RedactedSignalRow key={rank} rank={rank} />
            ))}
          </div>
          <UnlockLine cta={TRENDING_WALL.cta}>
            {freeCap} of {totalCount} names shown. The Club opens{" "}
            {TRENDING_WALL_DETAIL}
          </UnlockLine>
        </>
      )}

      {rows.length > 0 && (
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-soft">
          {trending?.disclaimer ??
            "Attention inside the Club — not a recommendation."}
          {" · Prices delayed ~15 min."}
        </p>
      )}

      {(mostBullish.length > 0 || mostBearish.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <ConvictionCard title="Club's most bullish" rows={mostBullish} tone="bull" />
          <ConvictionCard title="Club's most bearish" rows={mostBearish} tone="bear" />
        </div>
      )}

      {/* MOST DISCUSSED — same data and rows as the family branch. */}
      <section className="mt-7" aria-labelledby="club-discover-discussed">
        <SectionMark
          id="club-discover-discussed"
          label="Most discussed"
          gloss="Where the Club is actually talking"
        />
        {discussed.length === 0 ? (
          <FoundingLine className="mt-3">
            No thread has caught yet. Champion an idea on the{" "}
            <Link
              href="/watchlist/community"
              className="font-bold text-gold-700 underline decoration-1 underline-offset-2"
            >
              Community Watchlist
            </Link>{" "}
            and the conversation starts here.
          </FoundingLine>
        ) : (
          <div className="mt-2.5 flex flex-col gap-[7px]">
            {discussed.map((e) => {
              const t = e.ticker.toUpperCase();
              const q = quotes[t];
              const row = intel.get(t);
              return (
                <SignalRow
                  key={e.id}
                  ticker={e.ticker}
                  name={e.company_name}
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

      {/* TOP RESEARCH — reused wholesale. */}
      <section className="mt-7" aria-labelledby="club-discover-research">
        <SectionMark
          id="club-discover-research"
          label="Top research"
          gloss="The thinking behind the names"
        />
        <ResearchCards contributions={contributions} reports={reports} />
      </section>
    </>
  );
}

/**
 * The prototype's result card: 38px mark · Sora-bold name with the mono sym on
 * its baseline · a soft why-line · price and day move right-aligned in mono.
 * The why-line is REAL: watcher count (floor-gated, "New on the board" below
 * the floor) and the bull share when anyone has positioned. Grey on purpose —
 * green/red stay reserved for the price move beside it.
 */
function ClubResultCard({ r }: { r: TrendingRow }) {
  const tone = changeTone(r.changePct ?? undefined);
  const watchers = r.watchers ?? 0;
  const shown = watchers >= FLOORS.tickerParticipants;
  const why = [
    shown ? `${watchers.toLocaleString()} watching` : "New on the board",
    r.sentiment?.bullPct != null ? `${r.sentiment.bullPct}% bullish` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={`/research/${encodeURIComponent(r.ticker)}`}
      className="f0-focus flex items-center gap-3 rounded-[15px] border border-sand bg-card p-[13px] transition-colors hover:border-accent"
    >
      <CompanyLogo
        symbol={r.ticker}
        name={r.company}
        size={38}
        rounded="rounded-[12px]"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-[7px]">
          <span className="truncate font-display text-[14px] font-bold leading-tight text-ink">
            {r.company ?? r.ticker.toUpperCase()}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-soft">
            {r.ticker.toUpperCase()}
          </span>
        </span>
        <span className="mt-1 block truncate text-[11.5px] leading-snug text-soft">
          {why}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-[13px] font-semibold tabular-nums text-ink">
          {formatPrice(r.price ?? undefined) || "—"}
        </span>
        <span
          className={`mt-[5px] block font-mono text-[11px] tabular-nums ${
            tone === "up"
              ? "text-price-up"
              : tone === "down"
                ? "text-price-down"
                : "text-soft"
          }`}
        >
          {formatChangePct(r.changePct ?? undefined) || "—"}
        </span>
      </span>
    </Link>
  );
}

/**
 * The prototype's table view — one carded grid, 9px uppercase headers, mono
 * right-aligned readings. Its Cap/Growth columns aren't in the trending
 * contract, so the table carries what the ledger really knows: Watching
 * (floor-gated → an honest dash) and Signal (the lime sentiment ramp — never
 * the price colours).
 */
const LEDGER_GRID =
  "grid grid-cols-[1.2fr_1fr_0.8fr_0.9fr_0.8fr] items-center gap-1.5";

function ClubLedgerTable({ rows }: { rows: TrendingRow[] }) {
  return (
    <div className="mt-3.5 overflow-hidden rounded-[16px] border border-sand bg-card">
      <div className={`${LEDGER_GRID} border-b border-sand px-[13px] py-[11px]`}>
        {(["Ticker", "Price", "Chg", "Watching", "Signal"] as const).map(
          (h, i) => (
            <span
              key={h}
              className={`font-mono text-[9px] uppercase tracking-[0.1em] text-soft ${
                i > 0 ? "text-right" : ""
              }`}
            >
              {h}
            </span>
          )
        )}
      </div>
      {rows.map((r) => {
        const tone = changeTone(r.changePct ?? undefined);
        const watchers = r.watchers ?? 0;
        const shown = watchers >= FLOORS.tickerParticipants;
        return (
          <Link
            key={r.ticker}
            href={`/research/${encodeURIComponent(r.ticker)}`}
            className={`f0-focus ${LEDGER_GRID} border-b border-sand px-[13px] py-3 transition-colors last:border-b-0 hover:bg-sand/40`}
          >
            <span className="flex min-w-0 items-center gap-[7px]">
              <CompanyLogo
                symbol={r.ticker}
                name={r.company}
                size={22}
                rounded="rounded-[7px]"
              />
              <span className="truncate font-display text-[12px] font-bold text-ink">
                {r.ticker.toUpperCase()}
              </span>
            </span>
            <span className="text-right font-mono text-[11.5px] tabular-nums text-ink">
              {formatPrice(r.price ?? undefined) || "—"}
            </span>
            <span
              className={`text-right font-mono text-[11.5px] tabular-nums ${
                tone === "up"
                  ? "text-price-up"
                  : tone === "down"
                    ? "text-price-down"
                    : "text-soft"
              }`}
            >
              {formatChangePct(r.changePct ?? undefined) || "—"}
            </span>
            <span className="text-right font-mono text-[11.5px] tabular-nums text-soft">
              {shown ? watchers.toLocaleString() : "—"}
            </span>
            <span
              className={`text-right font-mono text-[11.5px] tabular-nums ${
                r.sentiment?.bullPct != null ? "text-sentiment" : "text-soft"
              }`}
            >
              {r.sentiment?.bullPct != null
                ? `${r.sentiment.bullPct}%`
                : "—"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/* ── SAVED SCREENS ───────────────────────────────────────────────────────── */
/**
 * The prototype's saved-screen cards: name over a mono meta line, a mono badge
 * on an accent-tinted ground. Every row is a REAL screener_saved_screens read
 * (own-row RLS; free members keep reading what they saved — only new writes
 * are metered, at the save control inside the screener). The prototype badges
 * "14 matches · 3 new"; no endpoint computes a saved screen's match count, so
 * the meta line carries the screen's real shape instead and the badge is the
 * action. Running one hands the id to the screener, which re-applies it
 * through the same path as its own "Your screens" chips.
 */
interface SavedScreenLite {
  id: string;
  name: string;
  filters: CustomFilters;
  sort_key: string;
  sort_dir: "asc" | "desc";
}

const CLUB_SORT_LABELS: Record<string, string> = {
  like_count: "Club signal",
  mcap: "market cap",
  price: "price",
  chg_1d: "1-day move",
  chg_5d: "5-day move",
  chg_1m: "1-month move",
  chg_3m: "3-month move",
  vol_ratio: "relative volume",
  rsi14: "RSI",
  ticker: "ticker",
};

function countClubFilters(f: CustomFilters): number {
  return (Object.keys(f) as (keyof CustomFilters)[]).filter(
    (k) => k !== "q" && f[k] != null && f[k] !== false
  ).length;
}

function ClubSavedScreens({ onRun }: { onRun: (id: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  // null = not read yet (skeleton) — distinct from an honest empty list.
  const [saved, setSaved] = useState<SavedScreenLite[] | null>(null);

  useEffect(() => {
    let live = true;
    supabase
      .from("screener_saved_screens")
      .select("id, name, filters, sort_key, sort_dir")
      .order("used_at", { ascending: false })
      .then(({ data, error }) => {
        if (!live) return;
        setSaved(error ? [] : ((data as SavedScreenLite[]) ?? []));
      });
    return () => {
      live = false;
    };
  }, [supabase]);

  if (saved === null) {
    return (
      <div className="flex flex-col gap-[9px]" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-[15px] border border-sand bg-card px-3.5 py-[13px]"
          >
            <span className="flex-1">
              <Bone w={130} h={11} />
              <Bone w={90} h={9} className="mt-2" />
            </span>
            <Bone w={44} h={22} className="!rounded-[7px]" />
          </div>
        ))}
        <span className="sr-only">Loading your saved screens</span>
      </div>
    );
  }

  if (saved.length === 0) {
    return (
      <FoundingLine>
        Nothing kept yet. Build a screen on the Screens tab and{" "}
        <span className="font-semibold text-ink">Save screen</span> keeps it
        here to re-run any day.
      </FoundingLine>
    );
  }

  return (
    <>
      <SectionMark
        label="Saved screens"
        gloss="Your kept scans — run one against today's market"
      />
      <div className="mt-3 flex flex-col gap-[9px]">
        {saved.map((s) => {
          const n = countClubFilters(s.filters);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onRun(s.id)}
              className="f0-focus f0-press flex w-full items-center gap-3 rounded-[15px] border border-sand bg-card px-3.5 py-[13px] text-left transition-colors hover:border-accent"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold leading-tight text-ink">
                  {s.name}
                </span>
                <span className="mt-[5px] block font-mono text-[11px] text-soft">
                  {n === 1 ? "1 filter" : `${n} filters`} · by{" "}
                  {CLUB_SORT_LABELS[s.sort_key] ?? s.sort_key}
                </span>
              </span>
              <span className="shrink-0 rounded-[7px] bg-accent/12 px-2 py-[5px] font-mono text-[10.5px] font-semibold text-gold-700">
                Run
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
