"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, Search, Sparkles, X } from "lucide-react";

import NewsClient from "../news/NewsClient";
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
import { designV2Enabled as isDesignV2 } from "@/lib/design-flag";
import DiscoverClientV2 from "./DiscoverClientV2";
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
export const TRENDING_WALL = wallFor("trending_full");
export const TRENDING_WALL_DETAIL =
  TRENDING_WALL.body.split("Club members get ")[1] ?? TRENDING_WALL.body;

/* ── flag dispatcher ─────────────────────────────────────────────────────────
 * OFF (default) → the v1 surface below, byte-identical. ON → the cc-canvas v2
 * surface, same props. The check is build-constant (NEXT_PUBLIC_* is inlined),
 * so this early return is stable across renders — no conditional-hook hazard. */
export default function DiscoverClient(props: DiscoverClientProps) {
  if (isDesignV2()) return <DiscoverClientV2 {...props} />;
  return <DiscoverClientV1 {...props} />;
}

/* ── the surface (v1) ────────────────────────────────────────────────────── */
function DiscoverClientV1({
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
export const DIVISIVE_MIN_POSITIONED = 4;
const DIVISIVE_MAX_GAP = 20; // bullPct within 30–70

export function pickDivisive(rows: TrendingRow[]): TrendingRow | null {
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
export function useClubLedger() {
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
