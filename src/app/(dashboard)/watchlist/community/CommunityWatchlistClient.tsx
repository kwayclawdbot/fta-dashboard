"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "@/lib/motion";
import {
  Users2,
  ShieldCheck,
  ArrowRight,
  Heart,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, LOAD_TIMEOUT_MS } from "@/lib/async";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import { fetchQuotes, type MarketQuote } from "@/lib/market/client";
import CompanyLogo from "@/components/fic/CompanyLogo";
import Sparkline from "@/components/fic/Sparkline";
import SentimentDots from "@/components/fic/SentimentDots";
import AgeBadge from "@/components/community/AgeBadge";
import UpsellCard from "@/components/dashboard/UpsellCard";
import WatchRail from "@/components/watch/WatchRail";
import { SegmentedRail, TickerTile, TickerTileStrip } from "@/components/canvas2";
import {
  Card,
  CardLink,
  AccentCard,
  Dial,
  MetricChip,
  BoardSkeleton,
  Eyebrow as BoardEyebrow,
  BoardLead,
  SectionPills,
} from "@/components/alerts/board";
import SocialBar from "@/components/research/SocialBar";
import TickerThread from "@/components/research/TickerThread";
import { fetchFavorites, type Favorite, type Vote } from "@/lib/research/social";
import type {
  CommunityBoardSeed,
  LikeCount,
  StanceShift,
} from "@/lib/community-watchlist-board";
import {
  pctSinceAdded,
  formatPct,
  pctTone,
  toParagraphs,
  COMMUNITY_DISCLAIMER,
  type CommunityEntry,
} from "@/lib/community-watchlist";

type SortMode = "newest" | "liked";
import {
  useNewMemberHints,
  HintReopen,
  HintDismiss,
} from "@/components/hints/useNewMemberHints";

type Tab = "board" | "favorites" | "record";

/**
 * CLUB PICKS — the club's shared board. CANVAS BOARD 17 ("Watchlist · Club
 * Picks").
 *
 * The board is a stack of pick CARDS: the logo tile, the ticker with its price
 * and move, the "brought by · on the board at · since" sub-line, a ring on the
 * right, a sparkline across the middle, then a hairline and the champion's own
 * words with their attribution tag. The strongest pick gets the tinted card;
 * the rest are white. Under them, the board's own summary.
 *
 * The obsidian "board's record" slab that used to open this screen is on no
 * board and is gone — board 17 puts that reading at the BOTTOM, as one summary
 * card, which is where it now lives.
 *
 * COLOUR LAW is doing real work here, because a card carries two independent
 * signals at once:
 *   • price / % since it landed → green + red (price-up / price-down), mono
 *   • what the club thinks      → LIME — the ring and SentimentDots both
 *   • orange                    → brand + action only
 * The canvas paints its featured card green because its #1 pick is up. We tint
 * with the ACCENT instead: a green field behind a green number, inches from a
 * lime ring, is the exact unreadable pairing the law was written after.
 *
 * Preserved wiring: the server seed + client fallback load, batched quotes,
 * batched like counts and the viewer's own votes, the inline canonical
 * TickerThread, SocialBar voting, the Favorites window switch, the free-tier
 * gate, the aggregate-only stance shifts, and the snapshot-based performance
 * maths the daily cron awards performance XP from (pctSinceAdded).
 */

/** Best "current" price for a ticker: live/delayed quote, else latest daily close. */
function currentPrice(
  entry: CommunityEntry,
  quotes: Record<string, MarketQuote>
): number | null {
  const q = quotes[entry.ticker];
  if (q && q.price != null) return q.price;
  return entry.latest_close ?? null;
}

/** % since it landed on the board — mono, price-coloured, never on a fill. */
function SincePct({ pct }: { pct: number | null }) {
  const tone = pctTone(pct);
  return (
    <span
      title="Change since it landed on the board"
      className={`font-mono text-[12px] font-semibold tabular-nums ${
        tone === "up"
          ? "text-price-up"
          : tone === "down"
            ? "text-price-down"
            : "text-soft/70"
      }`}
    >
      {formatPct(pct)}
    </span>
  );
}

export default function CommunityWatchlistClient({
  initialData = null,
}: {
  initialData?: CommunityBoardSeed | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const seeded = initialData != null;
  const [loading, setLoading] = useState(!seeded);
  const [tier, setTier] = useState<FamilyTier>(initialData?.tier ?? "fic");
  const [tierResolved, setTierResolved] = useState(seeded);
  const [entries, setEntries] = useState<CommunityEntry[]>(initialData?.entries ?? []);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, LikeCount>>(
    initialData?.likeCounts ?? {}
  );
  const [myVotes, setMyVotes] = useState<Record<string, Vote>>({});
  const [favorites, setFavorites] = useState<Favorite[]>(initialData?.favorites ?? []);
  const [favWindow, setFavWindow] = useState<"all" | "7d">("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [userId, setUserId] = useState(initialData?.userId ?? "");
  const [ageGroup, setAgeGroup] = useState<string | null>(initialData?.ageGroup ?? null);
  const [role, setRole] = useState<string | null>(initialData?.role ?? null);
  const [tab, setTab] = useState<Tab>("board");
  const [openId, setOpenId] = useState<string | null>(null);
  // Canvas 06 "Opinion Changes" — real, aggregate-only (migration 195).
  const [stanceShifts, setStanceShifts] = useState<StanceShift[]>(
    initialData?.stanceShifts ?? []
  );
  // The "how to use the board" hint expires after the new-member window; the
  // delayed-price / not-advice compliance line below it stays permanent (Lane 7A).
  const howToHint = useNewMemberHints("watchlist-community-howto");

  // Fetch the live/user-specific bits (delayed quotes + the viewer's own votes)
  // for a set of board tickers. Split out so the seeded first-paint path can pull
  // just these without re-running the full board/tier load.
  const hydrateLive = useCallback(
    (uid: string, tickers: string[]) => {
      if (!tickers.length) return;
      fetchQuotes(tickers).then((q) => setQuotes((prev) => ({ ...prev, ...q })));
      supabase
        .from("ticker_sentiment")
        .select("ticker, vote")
        .eq("user_id", uid)
        .in("ticker", tickers)
        .then(({ data }) => {
          const map: Record<string, Vote> = {};
          for (const r of data || []) map[r.ticker as string] = r.vote as Vote;
          setMyVotes(map);
        });
    },
    [supabase]
  );

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setTierResolved(true);
      return;
    }
    setUserId(user.id);

    // Resolve tier for the members-only gate (never flash the board to free).
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id, age_group, role")
      .eq("id", user.id)
      .maybeSingle();
    setAgeGroup(profile?.age_group ?? null);
    setRole(profile?.role ?? null);
    const t = await getClubTier(supabase, profile?.family_id);
    setTier(t);
    setTierResolved(true);
    if (t === "free") {
      setLoading(false);
      return;
    }

    const { data: raw } = await withTimeout(
      supabase.rpc("get_community_board"),
      LOAD_TIMEOUT_MS,
      { data: null } as { data: unknown }
    );
    const board = (raw || {}) as { entries?: CommunityEntry[] };
    const list = board.entries || [];
    setEntries(list);
    setLoading(false);

    // Community Favorites strip (independent of the board tickers).
    fetchFavorites(supabase, "all", 5).then(setFavorites);

    // Opinion changes in the last 24h — counts only, never identities.
    supabase
      .rpc("get_stance_shifts", { p_hours: 24 })
      .then(({ data }) => setStanceShifts((data ?? []) as StanceShift[]));

    const tickers = Array.from(new Set(list.map((e) => e.ticker).filter(Boolean)));
    if (tickers.length) {
      fetchQuotes(tickers).then((q) => setQuotes((prev) => ({ ...prev, ...q })));
      // Batched social — ONE query for counts, ONE for my votes (never N+1).
      supabase
        .from("ticker_like_counts")
        .select("ticker, likes, unlikes, net")
        .in("ticker", tickers)
        .then(({ data }) => {
          const map: Record<string, LikeCount> = {};
          for (const r of data || []) {
            map[r.ticker as string] = { likes: r.likes, unlikes: r.unlikes, net: r.net };
          }
          setLikeCounts(map);
        });
      supabase
        .from("ticker_sentiment")
        .select("ticker, vote")
        .eq("user_id", user.id)
        .in("ticker", tickers)
        .then(({ data }) => {
          const map: Record<string, Vote> = {};
          for (const r of data || []) map[r.ticker as string] = r.vote as Vote;
          setMyVotes(map);
        });
    }
  }, [supabase]);

  useEffect(() => {
    if (tab !== "favorites" || tier === "free") return;
    fetchFavorites(supabase, favWindow, 10).then(setFavorites);
  }, [favWindow, tab, tier, supabase]);

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (seeded) {
      // Server already seeded tier + board + likes + favorites. Only pull the
      // live/user bits (quotes + my votes) for the seeded tickers.
      if ((initialData?.tier ?? "fic") !== "free") {
        const tickers = Array.from(
          new Set((initialData?.entries ?? []).map((e) => e.ticker).filter(Boolean))
        );
        hydrateLive(initialData!.userId, tickers);
      }
    } else {
      load();
    }
  }, [seeded, initialData, hydrateLive, load]);

  const adminPicks = useMemo(
    () => entries.filter((e) => e.kind === "admin"),
    [entries]
  );
  const memberPicks = useMemo(() => {
    const list = entries.filter((e) => e.kind === "member");
    if (sortMode === "liked") {
      return [...list].sort(
        (a, b) => (likeCounts[b.ticker]?.net ?? 0) - (likeCounts[a.ticker]?.net ?? 0)
      );
    }
    return list;
  }, [entries, sortMode, likeCounts]);

  // Pick Record: rank every entry by "% since added".
  const ranked = useMemo(() => {
    return entries
      .map((e) => ({ e, pct: pctSinceAdded(e.snapshot_price, currentPrice(e, quotes)) }))
      .filter((r): r is { e: CommunityEntry; pct: number } => r.pct != null)
      .sort((a, b) => b.pct - a.pct);
  }, [entries, quotes]);
  const best = ranked.slice(0, 5);
  const worst = ranked.slice(-5).reverse();

  // Contributing households — a real count off the board, not a vanity number.
  const contributors = useMemo(
    () =>
      new Set(
        entries
          .filter((e) => e.kind === "member")
          .map((e) => e.family_id || e.promoted_by)
          .filter(Boolean) as string[]
      ).size,
    [entries]
  );

  // ── Free-tier gate ─────────────────────────────────────────────────────────
  if (tierResolved && tier === "free") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <UpsellCard context="watchlist" />
      </div>
    );
  }
  if ((loading || !tierResolved) && entries.length === 0) {
    return <BoardSkeleton label="the club\u2019s board" />;
  }

  const rowProps = {
    quotes,
    supabase,
    userId,
    ageGroup,
    role,
    canVote: tier !== "free",
    likeCounts,
    myVotes,
    openId,
    setOpenId,
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      {/* ── Board head — canvas 17: wordmark, pill rail, then the eyebrow that
          says whose board this is. */}
      <m.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <BoardLead
          word="watch"
          sub="Every company here was brought by someone and is researched in the open — one shared entry per ticker, credited to whoever put it on the board, and tracked from the day it landed."
        />

        {/* /alerts hard-redirects kids and teens, so the cell is omitted for
            them rather than offered and then bounced. */}
        <WatchRail
          active="community"
          showKai={ageGroup !== "kids" && ageGroup !== "teens" && role !== "child"}
          className="mt-4"
        />

        {howToHint.show ? (
          <Card className="mt-4 flex items-start gap-3">
            <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-soft">
              Promote a company from your own watchlist and the whole club can
              research it with you — notes, questions and the club&apos;s read
              all live on the ticker, not on your copy of it.{" "}
              <span className="text-soft/75">
                Prices are delayed ~15 min. Not investment advice.
              </span>
            </p>
            <HintDismiss onClick={howToHint.dismiss} className="mt-0.5" />
          </Card>
        ) : (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-[11.5px] leading-relaxed text-soft">
            Prices are delayed ~15 min. Not investment advice.
            <HintReopen
              onClick={howToHint.reopen}
              label="How the community board works"
            />
          </p>
        )}
      </m.header>

      <SectionPills<Tab>
        ariaLabel="Community board views"
        active={tab}
        onSelect={setTab}
        className="mb-7 mt-6"
        tabs={[
          { key: "board", label: "The board", count: entries.length },
          { key: "favorites", label: "Club favourites" },
          { key: "record", label: "Performance" },
        ]}
      />

      {tab === "board" ? (
        <div className="space-y-8">
          {/* Every company on the board, as one strip (canvas 17's tile object).
              The delta is the move SINCE IT LANDED, which is the only number
              this board has ever claimed to measure — not the day's change.
              Padded to nine slots: a club of nine names should look like a
              board filling up, not a broken row. */}
          {entries.length > 0 && (
            <section>
              <BoardEyebrow
                className="mb-3"
                meta={
                  <span className="font-mono text-[10px] tabular-nums text-soft/70">
                    {entries.length}
                  </span>
                }
              >
                Since it landed
              </BoardEyebrow>
              <TickerTileStrip minSlots={9} size="md">
                {entries.map((e) => (
                  <TickerTile
                    key={e.id}
                    ticker={e.ticker}
                    changePct={pctSinceAdded(
                      e.snapshot_price,
                      currentPrice(e, quotes)
                    )}
                    href={`/research/${encodeURIComponent(e.ticker)}`}
                  />
                ))}
              </TickerTileStrip>
            </section>
          )}

          {stanceShifts.length > 0 && <OpinionChanges rows={stanceShifts} />}

          {entries.length === 0 && (
            <Card className="px-4 py-6">
              <BoardEyebrow>Nothing on the board yet</BoardEyebrow>
              <h2 className="mt-2.5 max-w-md font-display text-[18px] font-extrabold text-ink">
                The board starts with one company
              </h2>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-soft">
                Promote a company from your own watchlist and it becomes the
                club&apos;s to research — everyone&apos;s notes, one entry.
              </p>
              <Link
                href="/watchlist"
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-gold-700 transition hover:text-gold-600"
              >
                Open your watchlist
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Card>
          )}

          {/* Our research (admin-curated) — the canvas's OFFICIAL CLUB PICKS
              block, tinted card first. */}
          {adminPicks.length > 0 && (
            <section className="space-y-2.5">
              <div className="mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <BoardEyebrow accent>Official club picks</BoardEyebrow>
                  <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-[0.1em] text-gold-700">
                    {monthLabel()}
                  </span>
                </div>
                <p className="mt-1.5 max-w-prose text-[11px] text-soft/85">
                  Companies the team is studying in the open — open one for the
                  full write-up and what we&apos;re watching next. Studied,
                  never recommended.
                </p>
              </div>
              {adminPicks.map((e, i) => (
                <EntryCard
                  key={e.id}
                  entry={e}
                  index={i}
                  rank={i + 1}
                  featured
                  tinted={i === 0}
                  {...rowProps}
                />
              ))}
            </section>
          )}

          {/* Brought by the club (member-promoted) */}
          {memberPicks.length > 0 && (
            <section className="space-y-2.5">
              <div className="mb-3">
                <BoardEyebrow
                  meta={
                    <span className="font-mono text-[10px] tabular-nums text-soft/70">
                      {memberPicks.length}
                    </span>
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Users2 className="h-3.5 w-3.5" /> Brought by the club
                  </span>
                </BoardEyebrow>
                {/* One-of-N goes through the shared rail so the keyboard model
                    (radiogroup, roving tabindex, arrow keys) is the same one
                    every other selector in the app uses. The bar is LIME:
                    "Club's pick" ranks by the club's net vote, which is
                    community sentiment by law — ordering the board by it is a
                    sentiment control, not an action. */}
                <SegmentedRail<SortMode>
                  ariaLabel="Sort the club's board"
                  size="sm"
                  value={sortMode}
                  onChange={setSortMode}
                  barClassName="bg-sentiment-fill"
                  activeTextClassName="text-ink"
                  className="mt-2"
                  options={[
                    { id: "newest", label: "Newest" },
                    { id: "liked", label: "Club's pick" },
                  ]}
                />
              </div>
              {memberPicks.map((e, i) => (
                <EntryCard key={e.id} entry={e} index={i} {...rowProps} />
              ))}
            </section>
          )}

          {/* ── The board's own record — the canvas's footer summary card. */}
          {ranked.length > 0 && (
            <BoardRecordCard
              entries={entries.length}
              admin={adminPicks.length}
              members={memberPicks.length}
              contributors={contributors}
              ranked={ranked}
            />
          )}
        </div>
      ) : tab === "favorites" ? (
        <FavoritesTab
          favorites={favorites}
          favWindow={favWindow}
          setFavWindow={setFavWindow}
        />
      ) : (
        <PickRecord best={best} worst={worst} quotes={quotes} />
      )}

      <footer className="mt-10 border-t border-sand pt-5">
        <p className="max-w-prose text-[11px] leading-relaxed text-soft">
          {COMMUNITY_DISCLAIMER}
        </p>
      </footer>
    </div>
  );
}

/**
 * OPINION CHANGES — canvas board 06, "4 tickers shifted today".
 *
 * The strongest thing this club can show is not that people voted; it is that
 * people CHANGED THEIR MIND, which is the same instinct behind Changed My Mind
 * on the feed. `ticker_sentiment` has always recorded it (updated_at moving past
 * created_at on a re-vote) and nothing could read it — migration 195 added the
 * index and an aggregate-only function.
 *
 * It is COUNTS ONLY, deliberately: `get_stance_shifts` returns no user ids, so
 * this can never out an individual member's position or their reversal. The
 * count is community sentiment, so it is lime, and the number next to it is a
 * net vote — never a price, never a performance figure.
 */
function OpinionChanges({ rows }: { rows: StanceShift[] }) {
  const total = rows.reduce((n, r) => n + r.shifts, 0);
  return (
    <section className="space-y-2">
      <div className="mb-3">
        <BoardEyebrow
          meta={
            <span className="font-mono text-[10px] tabular-nums text-soft/70">
              {total}
            </span>
          }
        >
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-sentiment" />
            Opinion changes · last 24 hours
          </span>
        </BoardEyebrow>
        <p className="mt-1.5 max-w-prose text-[11px] leading-relaxed text-soft/85">
          Members who had already taken a side and moved off it. The club rewards
          the update, not the ego — so the reversal is the headline, and who made
          it stays private.
        </p>
      </div>
      {rows.map((r) => (
        <CardLink key={r.ticker} href={`/research/${encodeURIComponent(r.ticker)}`}>
          <div className="flex items-center gap-3">
            <CompanyLogo symbol={r.ticker} name={r.ticker} size={30} rounded="rounded-[9px]" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[14px] font-extrabold tracking-tight text-ink">
                ${r.ticker}
              </p>
              <p className="truncate text-[11.5px] text-soft">
                {r.shifts === 1 ? "one member" : `${r.shifts} members`} re-thought
                this one
              </p>
            </div>
            <MetricChip>
              <span className="uppercase tracking-[0.1em]">Net</span>
              <span className="text-sentiment">
                {r.net_now > 0 ? "+" : ""}
                {r.net_now}
              </span>
            </MetricChip>
            <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-soft/50" />
          </div>
        </CardLink>
      ))}
    </section>
  );
}

/** Which month the official picks belong to — the canvas's "JULY" chip. */
function monthLabel(): string {
  return new Date().toLocaleDateString(undefined, { month: "long" }).toUpperCase();
}

/**
 * The board's own record — canvas 17's footer summary object ("June picks
 * graded: 3W · 1L · avg +7.2%"), built from the same snapshot maths the rest of
 * the board uses. Ahead/behind, never won/lost: nobody took a position.
 */
function BoardRecordCard({
  entries,
  admin,
  members,
  contributors,
  ranked,
}: {
  entries: number;
  admin: number;
  members: number;
  contributors: number;
  ranked: { e: CommunityEntry; pct: number }[];
}) {
  const ahead = ranked.filter((r) => r.pct > 0).length;
  const behind = ranked.filter((r) => r.pct < 0).length;
  const avg = ranked.reduce((n, r) => n + r.pct, 0) / ranked.length;
  const best = ranked[0];

  return (
    <AccentCard>
      <BoardEyebrow accent>The board&apos;s record</BoardEyebrow>
      <div className="mt-3 flex items-center gap-4">
        <Dial
          value={ahead / ranked.length}
          size={68}
          ring={6}
          tone={avg >= 0 ? "price-up" : "price-down"}
          center={`${ahead}/${ranked.length}`}
          centerClassName="text-[13px]"
          label={`${ahead} of ${ranked.length} companies are ahead of the price they landed at`}
        />
        <dl className="flex min-w-0 flex-1 flex-wrap items-end gap-x-7 gap-y-3">
          <RecordStat label="Companies" value={String(entries)} />
          <RecordStat label="Our research" value={String(admin)} />
          <RecordStat label="From members" value={String(members)} />
          <RecordStat
            label="Contributors"
            value={contributors > 0 ? String(contributors) : "—"}
          />
        </dl>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-sand pt-3">
        <MetricChip>
          <span className="uppercase tracking-[0.1em]">Ahead</span>
          <span className="text-price-up">{ahead}</span>
        </MetricChip>
        <MetricChip>
          <span className="uppercase tracking-[0.1em]">Behind</span>
          <span className="text-price-down">{behind}</span>
        </MetricChip>
        <MetricChip>
          <span className="uppercase tracking-[0.1em]">Average</span>
          <span className={avg >= 0 ? "text-price-up" : "text-price-down"}>
            {formatPct(avg)}
          </span>
        </MetricChip>
        {best && (
          <MetricChip>
            <span className="uppercase tracking-[0.1em]">Best</span>
            <span className="text-ink">${best.e.ticker}</span>
            <span className={pctTone(best.pct) === "down" ? "text-price-down" : "text-price-up"}>
              {formatPct(best.pct)}
            </span>
          </MetricChip>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-soft/80">
        Measured from the price on the day each company landed on the board. A
        record of what the club studied — never a track record of advice.
      </p>
    </AccentCard>
  );
}

function RecordStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-soft/70">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-[18px] font-semibold leading-none tabular-nums text-ink">
        {value}
      </dd>
    </div>
  );
}

/**
 * ONE PICK — canvas board 17's card.
 *
 * The board's anatomy, in order: the pick number and month eyebrow (carried by
 * the section above), then logo tile · ticker + price + move · the "brought by ·
 * on the board at · since" sub-line · the ring on the right, then the sparkline
 * across the middle, then a hairline and the champion's own words with their
 * attribution tag. Expanding the card adds the communal part: the full thesis,
 * the club's vote and the canonical per-ticker thread.
 *
 * THE RING IS THE CLUB'S CONVICTION, and it is LIME, because that is what lime
 * means here. It is only drawn when there are votes to draw it from — an empty
 * ring at 0% would be a claim about a company nobody has read yet.
 */
function EntryCard({
  entry,
  index,
  rank,
  featured = false,
  tinted = false,
  quotes,
  supabase,
  userId,
  ageGroup,
  role,
  canVote,
  likeCounts,
  myVotes,
  openId,
  setOpenId,
}: {
  entry: CommunityEntry;
  index: number;
  rank?: number;
  featured?: boolean;
  tinted?: boolean;
  quotes: Record<string, MarketQuote>;
  supabase: ReturnType<typeof createClient>;
  userId: string;
  ageGroup: string | null;
  role: string | null;
  canVote: boolean;
  likeCounts: Record<string, LikeCount>;
  myVotes: Record<string, Vote>;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}) {
  const [threadOpen, setThreadOpen] = useState(false);
  const [count, setCount] = useState<number>(entry.comment_count ?? 0);

  const price = currentPrice(entry, quotes);
  const pct = pctSinceAdded(entry.snapshot_price, price);
  const like = likeCounts[entry.ticker];
  const votes = (like?.likes ?? 0) + (like?.unlikes ?? 0);
  // Share of the club's votes that are positive — a real fraction of real
  // votes, never a score we invented.
  const conviction = votes > 0 ? (like?.likes ?? 0) / votes : null;
  const open = openId === entry.id;
  const researchHref = `/research/${encodeURIComponent(entry.ticker)}`;
  const attribution =
    entry.kind === "admin"
      ? "Our research"
      : entry.family_name || entry.promoter_name || "A member";
  const dayPct = quotes[entry.ticker]?.changePercent ?? null;

  const Shell = tinted ? AccentCard : Card;

  return (
    <Shell>
      <div
        className="f0-focus cursor-pointer"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpenId(open ? null : entry.id)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            setOpenId(open ? null : entry.id);
          }
        }}
        style={{ ["--i" as string]: index }}
      >
        <div className="flex items-center gap-3">
          <CompanyLogo
            symbol={entry.ticker}
            name={entry.company_name}
            size={40}
            rounded="rounded-[11px]"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-display text-[15px] font-extrabold tracking-tight text-ink">
                {entry.ticker}
              </span>
              {price != null && (
                <span className="font-mono text-[12px] tabular-nums text-ink">
                  {price.toFixed(2)}
                </span>
              )}
              {dayPct != null && (
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    dayPct >= 0 ? "text-price-up" : "text-price-down"
                  }`}
                >
                  {dayPct >= 0 ? "▲" : "▼"}
                  {Math.abs(dayPct).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[10px] text-soft/85">
              {rank ? `Pick #${rank} · ` : ""}
              {entry.snapshot_price != null
                ? `on the board at ${entry.snapshot_price.toFixed(2)} · `
                : ""}
              <SincePct pct={pct} /> since
            </p>
          </div>

          {conviction != null ? (
            <Dial
              value={conviction}
              size={46}
              ring={5}
              tone="sentiment"
              center={`${Math.round(conviction * 100)}%`}
              centerClassName="text-[10.5px]"
              label={`${Math.round(conviction * 100)} percent of the club's ${votes} votes on ${entry.ticker} are positive`}
            />
          ) : (
            <ChevronDown
              aria-hidden
              className={`h-4 w-4 shrink-0 text-soft/60 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          )}
        </div>

        <div className="mt-2.5">
          <Sparkline symbol={entry.ticker} height={38} />
        </div>

        {/* the champion's words + their tag — the canvas's card footer */}
        <div className="mt-2.5 flex items-center gap-2.5 border-t border-sand pt-2.5">
          <SentimentDots net={like?.net ?? 0} votes={votes} showLabel={false} />
          <p className="min-w-0 flex-1 truncate text-[11px] italic leading-relaxed text-soft">
            {entry.blurb || entry.headline || entry.thesis || "Researched in the open."}
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[4px] bg-ink px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.06em] text-paper">
            {entry.kind === "admin" && <ShieldCheck className="h-2.5 w-2.5" />}
            {attribution}
          </span>
          {entry.promoter_age_group && <AgeBadge ageGroup={entry.promoter_age_group} />}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-sand pt-3.5">
              {/* The full long-form thesis lives here now: Team Picks was
                  retired into this board (migration 098) and the real pick's
                  1,200-word-class write-up came with it. It gets a genuine
                  reading measure and real paragraphs, not a clamped card
                  preview. Member entries show their own short blurb. */}
              {featured && entry.headline && (
                <p className="max-w-[65ch] font-display text-display-3 font-extrabold leading-tight tracking-tight text-ink">
                  {entry.headline}
                </p>
              )}
              {featured && entry.thesis ? (
                <div className="mt-3 max-w-[65ch] space-y-3">
                  {toParagraphs(entry.thesis).map((para, pi) => (
                    <p key={pi} className="text-[14px] leading-relaxed text-ink/85">
                      {para}
                    </p>
                  ))}
                </div>
              ) : (
                (entry.blurb || entry.thesis) && (
                  <p className="mt-2 max-w-[65ch] text-[13.5px] leading-relaxed text-ink/85">
                    {entry.blurb || entry.thesis}
                  </p>
                )
              )}


              <div
                className="mt-3 flex flex-wrap items-center justify-between gap-3"
                onClick={(ev) => ev.stopPropagation()}
              >
                <SocialBar
                  supabase={supabase}
                  ticker={entry.ticker}
                  variant="card"
                  userId={userId}
                  ageGroup={ageGroup}
                  canVote={canVote}
                  commentActive={threadOpen}
                  commentCount={count}
                  onCommentClick={() => setThreadOpen((v) => !v)}
                  initial={{
                    likes: like?.likes ?? 0,
                    unlikes: like?.unlikes ?? 0,
                    net: like?.net ?? 0,
                    commentCount: entry.comment_count,
                    myVote: myVotes[entry.ticker] ?? null,
                  }}
                />
                <Link
                  href={researchHref}
                  className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-gold-700 transition hover:text-gold-600"
                >
                  Research ${entry.ticker}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Inline canonical thread — lazy-mounted on expand, no navigation. */}
              {threadOpen && (
                <div
                  className="mt-4 border-t border-sand/70 pt-3"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  <TickerThread
                    supabase={supabase}
                    ticker={entry.ticker}
                    userId={userId}
                    role={role}
                    canPost={canVote}
                    onCountChange={setCount}
                  />
                </div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}

function RecordRow({
  entry,
  pct,
  quotes,
}: {
  entry: CommunityEntry;
  pct: number;
  quotes: Record<string, MarketQuote>;
}) {
  const price = currentPrice(entry, quotes);
  return (
    <CardLink href={`/research/${encodeURIComponent(entry.ticker)}`}>
      <div className="flex items-center gap-3">
        <CompanyLogo
          symbol={entry.ticker}
          name={entry.company_name}
          size={32}
          rounded="rounded-[10px]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[14px] font-extrabold tracking-tight text-ink">
              {entry.ticker}
            </span>
            <span className="min-w-0 truncate text-[11.5px] text-soft">
              {entry.company_name}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-soft/75">
            {entry.kind === "admin"
              ? "Our research"
              : entry.family_name || entry.promoter_name || "A member"}
          </p>
        </div>
        {price != null && (
          <span className="shrink-0 font-mono text-[13px] tabular-nums text-ink">
            {price.toFixed(2)}
          </span>
        )}
        <SincePct pct={pct} />
      </div>
    </CardLink>
  );
}

function FavoritesTab({
  favorites,
  favWindow,
  setFavWindow,
}: {
  favorites: Favorite[];
  favWindow: "all" | "7d";
  setFavWindow: (w: "all" | "7d") => void;
}) {
  return (
    <section className="space-y-2">
      <div className="mb-3">
        <BoardEyebrow>What the club likes most</BoardEyebrow>
        <SegmentedRail<"all" | "7d">
          ariaLabel="Favourites window"
          size="sm"
          value={favWindow}
          onChange={setFavWindow}
          barClassName="bg-sentiment-fill"
          activeTextClassName="text-ink"
          className="mt-2"
          options={[
            { id: "all", label: "All time" },
            { id: "7d", label: "This week" },
          ]}
        />
        <p className="mt-2.5 max-w-prose text-[11.5px] leading-relaxed text-soft">
          Ranked by the club&apos;s net vote — a read on conviction across the
          membership, not a measure of what any company is worth.
        </p>
      </div>

      {favorites.length === 0 ? (
        <Card className="px-4 py-5">
          <p className="text-[13px] leading-relaxed text-soft">
            No favourites yet. As members vote on companies across the board, the
            club&apos;s strongest reads rise here.
          </p>
        </Card>
      ) : (
        favorites.map((f, i) => (
          <CardLink key={f.ticker} href={`/research/${encodeURIComponent(f.ticker)}`}>
            <div className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-center font-mono text-[12px] tabular-nums text-soft/70">
                {i + 1}
              </span>
              <CompanyLogo
                symbol={f.ticker}
                name={f.company_name}
                size={32}
                rounded="rounded-[10px]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[14px] font-extrabold tracking-tight text-ink">
                    {f.ticker}
                  </span>
                  <span className="min-w-0 truncate text-[11.5px] text-soft">
                    {f.company_name}
                  </span>
                </div>
              </div>
              {/* Community sentiment = LIME, always and only — through the
                  canonical token, never a hand-written dark: variant. */}
              <span className="inline-flex shrink-0 items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 fill-sentiment-fill text-sentiment" />
                <span className="font-mono text-[13px] font-semibold tabular-nums text-sentiment">
                  {favWindow === "7d" ? f.score : f.net}
                </span>
              </span>
            </div>
          </CardLink>
        ))
      )}
    </section>
  );
}

function PickRecord({
  best,
  worst,
  quotes,
}: {
  best: { e: CommunityEntry; pct: number }[];
  worst: { e: CommunityEntry; pct: number }[];
  quotes: Record<string, MarketQuote>;
}) {
  if (best.length === 0) {
    return (
      <Card className="px-4 py-6">
        <BoardEyebrow>No record yet</BoardEyebrow>
        <h2 className="mt-2.5 max-w-md font-display text-[18px] font-extrabold text-ink">
          A record needs a starting price
        </h2>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-soft">
          Once a company has a snapshot from the day it landed and at least one
          daily close after it, its move shows up here.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <BoardEyebrow className="mb-3">Furthest ahead</BoardEyebrow>
        {best.map((r) => (
          <RecordRow key={r.e.id} entry={r.e} pct={r.pct} quotes={quotes} />
        ))}
      </section>
      <section className="space-y-2">
        <BoardEyebrow className="mb-3">Watching closely</BoardEyebrow>
        {worst.map((r) => (
          <RecordRow key={r.e.id} entry={r.e} pct={r.pct} quotes={quotes} />
        ))}
      </section>
      <p className="max-w-prose text-[11px] leading-relaxed text-soft">
        Measured from the price on the day each company landed on the board.
        These are study outcomes, not positions — nobody here is being told to
        buy or sell anything.
      </p>
    </div>
  );
}
