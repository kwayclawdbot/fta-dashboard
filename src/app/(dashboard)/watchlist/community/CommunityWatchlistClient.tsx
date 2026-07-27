"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "@/lib/motion";
import {
  Users2,
  Trophy,
  ShieldCheck,
  ArrowRight,
  Heart,
  ChevronDown,
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
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import Tabs from "@/components/ui/Tabs";
import SocialBar from "@/components/research/SocialBar";
import TickerThread from "@/components/research/TickerThread";
import { fetchFavorites, type Favorite, type Vote } from "@/lib/research/social";
import type { CommunityBoardSeed, LikeCount } from "@/lib/community-watchlist-board";
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
 * COMMUNITY WATCHLIST — canvas rebuild (light-primary club system).
 *
 * This is the club's shared, wiki-style research board: one entry per company,
 * researched in the open, credited to whoever brought it. The old surface was a
 * two- and three-column grid of bordered cards — the exact equal-column card
 * grid the brand register bans, and it made a communal ledger read as a
 * marketplace. It is now ONE hairline ledger per section, with the single dark
 * object on the surface reserved for the board's real performance record.
 *
 * COLOUR LAW here is doing real work, because a row carries two independent
 * signals at once:
 *   • price / % since added → green + red (price-up / price-down), mono, ONLY
 *   • what the club thinks   → LIME (SentimentDots), never a second green/red
 *   • orange                 → brand + action only
 * Before this split, a row's sentiment and its price were both green and a
 * reader genuinely could not tell which was which.
 *
 * Preserved wiring: the server seed + client fallback load, batched quotes,
 * batched like counts and the viewer's own votes, the inline canonical
 * TickerThread, SocialBar voting, the Favorites window switch, the free-tier
 * gate, and the snapshot-based performance maths that the daily cron awards
 * performance XP from (pctSinceAdded / PERF_MILESTONES).
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

/** Section marker — charged tick + eyebrow + hairline to the edge. */
function SectionRule({
  label,
  icon: Icon,
  meta,
}: {
  label: string;
  icon?: React.ElementType;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-1 flex items-center gap-3">
      <h2 className="f0-section-rule flex-1">
        <span className="flex items-center gap-1.5 font-display text-eyebrow font-bold uppercase text-ink">
          {Icon && <Icon className="h-3.5 w-3.5 text-gold-700" />}
          {label}
        </span>
      </h2>
      {meta}
    </div>
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
    return <DashboardSkeleton variant="board" title="Community Watchlist" />;
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
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <m.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="font-mono text-eyebrow font-semibold uppercase text-soft">
          One board · the whole club
        </p>
        <h1 className="mt-2 font-display text-display-1 font-extrabold uppercase text-ink">
          Community
          <br className="sm:hidden" /> Watchlist
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-soft">
          Every company here was brought by someone and is researched in the
          open — one shared entry per ticker, credited to whoever put it on the
          board, and tracked from the day it landed.
        </p>

        {howToHint.show ? (
          <div className="f0-rule-top mt-6 flex items-start gap-3 pt-4">
            <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-soft">
              Promote a company from your own watchlist and the whole club can
              research it with you — notes, questions and the club&apos;s read
              all live on the ticker, not on your copy of it.{" "}
              <span className="text-soft/75">
                Prices are delayed ~15 min. Not investment advice.
              </span>
            </p>
            <HintDismiss onClick={howToHint.dismiss} className="mt-0.5" />
          </div>
        ) : (
          <p className="f0-rule-top mt-6 flex flex-wrap items-center gap-2 pt-4 text-[12px] leading-relaxed text-soft">
            Prices are delayed ~15 min. Not investment advice.
            <HintReopen
              onClick={howToHint.reopen}
              label="How the community board works"
            />
          </p>
        )}
      </m.header>

      {/* ── The one dark object: the board's own record ───────────────────── */}
      {entries.length > 0 && (
        <section className="f0-hero-field f0-grain mt-8 px-5 py-6 sm:px-7">
          <p className="font-mono text-eyebrow font-semibold uppercase text-volt-300">
            The board&apos;s record
          </p>
          <dl className="mt-5 flex flex-wrap items-end gap-x-10 gap-y-5">
            <BoardStat label="Companies" value={String(entries.length)} />
            <BoardStat
              label="Our research"
              value={String(adminPicks.length)}
            />
            <BoardStat
              label="Brought by members"
              value={String(memberPicks.length)}
            />
            <BoardStat
              label="Contributors"
              value={contributors > 0 ? String(contributors) : "—"}
            />
            <BoardStat
              label="Best since added"
              value={best[0] ? `$${best[0].e.ticker}` : "—"}
              note={best[0] ? formatPct(best[0].pct) : undefined}
              noteTone={best[0] ? pctTone(best[0].pct) : "flat"}
            />
          </dl>
          <p className="mt-5 max-w-lg text-[11.5px] leading-relaxed opacity-55">
            Measured from the price on the day each company landed on the board.
            A record of what the club studied — never a track record of advice.
          </p>
        </section>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs
        className="mt-8"
        ariaLabel="Community board views"
        active={tab}
        onSelect={setTab}
        tabs={[
          { key: "board" as Tab, label: "The board", icon: Users2 },
          { key: "favorites" as Tab, label: "Club favourites", icon: Heart },
          { key: "record" as Tab, label: "Performance", icon: Trophy },
        ]}
      />

      {tab === "board" ? (
        <div className="mt-7 space-y-9">
          {entries.length === 0 && (
            <div className="f0-rule-top py-10">
              <p className="font-mono text-eyebrow font-semibold uppercase text-soft">
                Nothing on the board yet
              </p>
              <h2 className="mt-2.5 max-w-md font-display text-display-3 font-extrabold text-ink">
                The board starts with one company
              </h2>
              <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-soft">
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
            </div>
          )}

          {/* Our research (admin-curated) */}
          {adminPicks.length > 0 && (
            <section>
              <SectionRule
                label="Our research"
                icon={ShieldCheck}
                meta={
                  <span className="font-mono text-[11px] tabular-nums text-soft/70">
                    {adminPicks.length}
                  </span>
                }
              />
              <p className="mb-3 mt-2 max-w-prose text-[12.5px] leading-relaxed text-soft">
                Companies the team is studying in the open — open one for the
                full write-up, the reasoning behind it and what we&apos;re
                watching next. Studied, never recommended.
              </p>
              <div className="f0-ledger f0-stagger border-t border-sand/70">
                {adminPicks.map((e, i) => (
                  <EntryRow key={e.id} entry={e} index={i} featured {...rowProps} />
                ))}
              </div>
            </section>
          )}

          {/* Brought by the club (member-promoted) */}
          {memberPicks.length > 0 && (
            <section>
              <SectionRule
                label="Brought by the club"
                icon={Users2}
                meta={
                  <span className="inline-flex items-center gap-3">
                    {(["newest", "liked"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSortMode(s)}
                        className={`font-mono text-[10px] uppercase tracking-[0.12em] transition ${
                          sortMode === s
                            ? "text-gold-700"
                            : "text-soft/70 hover:text-ink"
                        }`}
                      >
                        {s === "newest" ? "Newest" : "Club's pick"}
                      </button>
                    ))}
                  </span>
                }
              />
              <div className="f0-ledger f0-stagger border-t border-sand/70">
                {memberPicks.map((e, i) => (
                  <EntryRow key={e.id} entry={e} index={i} {...rowProps} />
                ))}
              </div>
            </section>
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

/** One reading of the board, inside the dark field. Mono, no container. */
function BoardStat({
  label,
  value,
  note,
  noteTone = "flat",
}: {
  label: string;
  value: string;
  note?: string;
  noteTone?: "up" | "down" | "flat";
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-55">
        {label}
      </dt>
      <dd className="mt-1.5 flex items-baseline gap-2">
        <span className="font-mono text-[20px] font-semibold tabular-nums">
          {value}
        </span>
        {note && (
          <span
            className={`font-mono text-[12px] font-semibold tabular-nums ${
              noteTone === "up"
                ? "text-price-up"
                : noteTone === "down"
                  ? "text-price-down"
                  : "opacity-60"
            }`}
          >
            {note}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * One company on the shared board. The row carries the glanceable facts; the
 * expansion carries the communal part — the thesis, the chart, the club's vote
 * and the canonical per-ticker thread.
 */
function EntryRow({
  entry,
  index,
  featured = false,
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
  featured?: boolean;
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
  const open = openId === entry.id;
  const researchHref = `/research/${encodeURIComponent(entry.ticker)}`;
  const attribution =
    entry.kind === "admin"
      ? "Our research"
      : entry.family_name || entry.promoter_name || "A member";

  return (
    <div style={{ ["--i" as string]: index }}>
      <div
        className="f0-ledger-row cursor-pointer"
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
      >
        <CompanyLogo
          symbol={entry.ticker}
          name={entry.company_name}
          size={34}
          rounded="rounded-lg"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[15px] font-extrabold tracking-tight text-ink">
              ${entry.ticker}
            </span>
            <span className="min-w-0 truncate text-[12.5px] text-soft">
              {entry.company_name}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <SentimentDots
              net={like?.net ?? 0}
              votes={(like?.likes ?? 0) + (like?.unlikes ?? 0)}
            />
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-soft/75">
              {entry.kind === "admin" && (
                <ShieldCheck className="h-3 w-3 text-gold-700" />
              )}
              {attribution}
              {entry.promoter_age_group && (
                <AgeBadge ageGroup={entry.promoter_age_group} />
              )}
            </span>
          </div>
        </div>

        {/* price + move since it landed — mono, never on a fill */}
        <div className="shrink-0 text-right">
          {price != null ? (
            <div className="font-mono text-[15px] font-semibold tabular-nums text-ink">
              {price.toFixed(2)}
            </div>
          ) : (
            <div className="font-mono text-[11px] text-soft/50">no quote</div>
          )}
          <div className="mt-0.5">
            <SincePct pct={pct} />
          </div>
        </div>

        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-soft/60 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-5 pl-[3.1rem] pr-1">
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

              <div className="mt-3 max-w-md">
                <Sparkline symbol={entry.ticker} height={52} />
              </div>

              {entry.snapshot_price != null && (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-soft/70">
                  On the board at {entry.snapshot_price.toFixed(2)}
                </p>
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
    </div>
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
    <Link href={`/research/${encodeURIComponent(entry.ticker)}`} className="f0-ledger-row">
      <CompanyLogo
        symbol={entry.ticker}
        name={entry.company_name}
        size={30}
        rounded="rounded-lg"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[14px] font-extrabold tracking-tight text-ink">
            ${entry.ticker}
          </span>
          <span className="min-w-0 truncate text-[12px] text-soft">
            {entry.company_name}
          </span>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-soft/75">
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
    </Link>
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
    <section className="mt-7">
      <SectionRule
        label="What the club likes most"
        meta={
          <span className="inline-flex items-center gap-3">
            {(["all", "7d"] as const).map((w) => (
              <button
                key={w}
                onClick={() => setFavWindow(w)}
                className={`font-mono text-[10px] uppercase tracking-[0.12em] transition ${
                  favWindow === w ? "text-gold-700" : "text-soft/70 hover:text-ink"
                }`}
              >
                {w === "all" ? "All time" : "This week"}
              </button>
            ))}
          </span>
        }
      />
      <p className="mb-3 mt-2 max-w-prose text-[12.5px] leading-relaxed text-soft">
        Ranked by the club&apos;s net vote — a read on conviction across the
        membership, not a measure of what any company is worth.
      </p>

      {favorites.length === 0 ? (
        <p className="f0-rule-top py-8 text-[13.5px] leading-relaxed text-soft">
          No favourites yet. As members vote on companies across the board, the
          club&apos;s strongest reads rise here.
        </p>
      ) : (
        <div className="f0-ledger f0-stagger border-t border-sand/70">
          {favorites.map((f, i) => (
            <Link
              key={f.ticker}
              href={`/research/${encodeURIComponent(f.ticker)}`}
              className="f0-ledger-row"
              style={{ ["--i" as string]: i }}
            >
              <span className="w-5 shrink-0 text-center font-mono text-[12px] tabular-nums text-soft/70">
                {i + 1}
              </span>
              <CompanyLogo
                symbol={f.ticker}
                name={f.company_name}
                size={30}
                rounded="rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[14px] font-extrabold tracking-tight text-ink">
                    ${f.ticker}
                  </span>
                  <span className="min-w-0 truncate text-[12px] text-soft">
                    {f.company_name}
                  </span>
                </div>
              </div>
              {/* community sentiment = LIME, always and only */}
              <span className="inline-flex shrink-0 items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 fill-lime-500 text-lime-600 dark:text-lime-400" />
                <span className="font-mono text-[13px] font-semibold tabular-nums text-lime-700 dark:text-lime-400">
                  {favWindow === "7d" ? f.score : f.net}
                </span>
              </span>
            </Link>
          ))}
        </div>
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
      <div className="f0-rule-top mt-7 py-10">
        <p className="font-mono text-eyebrow font-semibold uppercase text-soft">
          No record yet
        </p>
        <h2 className="mt-2.5 max-w-md font-display text-display-3 font-extrabold text-ink">
          A record needs a starting price
        </h2>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-soft">
          Once a company has a snapshot from the day it landed and at least one
          daily close after it, its move shows up here.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-7 space-y-9">
      <section>
        <SectionRule label="Furthest ahead" />
        <div className="f0-ledger f0-stagger border-t border-sand/70">
          {best.map((r) => (
            <RecordRow key={r.e.id} entry={r.e} pct={r.pct} quotes={quotes} />
          ))}
        </div>
      </section>
      <section>
        <SectionRule label="Watching closely" />
        <div className="f0-ledger f0-stagger border-t border-sand/70">
          {worst.map((r) => (
            <RecordRow key={r.e.id} entry={r.e} pct={r.pct} quotes={quotes} />
          ))}
        </div>
      </section>
      <p className="max-w-prose text-[11.5px] leading-relaxed text-soft">
        Measured from the price on the day each company landed on the board.
        These are study outcomes, not positions — nobody here is being told to
        buy or sell anything.
      </p>
    </div>
  );
}
