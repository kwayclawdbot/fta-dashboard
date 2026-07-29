"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  Card,
  SectionMark,
  StatCard,
} from "@/components/research/board";
import { CollectiveSignal } from "@/components/collective";

/**
 * WHERE THE CLUB STANDS — board 03's sentiment block, built as drawn.
 *
 * The mockup composes this as: a brand-orange section mark with a quiet
 * suffix, then a three-column measure — BULLISH % and its dot tally on the
 * left, a big radial in the middle, BEARISH % and its tally on the right —
 * with a four-up row of stat cards underneath. A previous pass replaced the
 * radial with a horizontal bar; the owner's canvas draws the radial, so the
 * radial is what ships.
 *
 * WHAT THE MIDDLE NUMBER ACTUALLY IS. The board labels it "78% WEIGHTED
 * SIGNAL". We do compute a weighted club figure — `club_score` on
 * ticker_intel_snapshots, the same number the Club Score surfaces everywhere
 * else — so that is what the ring reads, under the label CLUB SIGNAL and with
 * its own explaining sub-line. Nothing is invented to fill the ring: when the
 * snapshot has no score the ring draws its track, the centre reads "—", and
 * the sub-line says the club hasn't scored this name yet.
 *
 * ── WHICH STORE THE SPLIT ACTUALLY COMES FROM (stance-pipeline repair) ──────
 * This block's centrepiece floored out on EVERY ticker, permanently, and the
 * reason was a plumbing mismatch rather than a quiet club:
 *
 *   • it counted `feed_posts.position` (via get_ticker_community_stats, mig
 *     132) — a column with ZERO rows in production, because nothing members
 *     actually use writes it;
 *   • members DO declare stances, through the "Changed My Mind" flow, and those
 *     land in `ticker_stances` (mig 151) where nothing on this page read them;
 *   • the snapshot fallback (`/api/club/intel`) does bridge stances (mig 160),
 *     but it only exists for tickers already inside club_trending and it is
 *     walled for free members and for kids — so it could never be the floor.
 *
 * So the hook now reads the stance store DIRECTLY (get_ticker_stance_summary,
 * the same RPC the stance picker beside it already uses) and picks the single
 * RICHEST source rather than mixing two definitions of "positioned". Mixing
 * would double-count the member who both posted a position and holds a stance;
 * picking one keeps every percentage a statement about one well-defined set.
 *
 * SOURCES (real, floor-gated, never fabricated):
 *   • get_ticker_stance_summary (migration 151) — bull/bear/neutral over
 *     `ticker_stances`. THE STORE WITH DATA, and the one the picker writes.
 *   • get_ticker_community_stats (migration 132) — the same tally over
 *     positioned feed posts, plus watchers and this week's discussions.
 *   • ticker_intel_snapshots via /api/club/intel/[ticker] (migration 141/160) —
 *     club score, rank, watchers, participants, the 24h sentiment shift.
 *   • feed_posts / ticker_stances → profiles — the portraits behind the tally,
 *     surfaced by the canvas head as the "N watching now" stack.
 *
 * FLOORS: the split only draws once SPLIT_FLOOR members have positioned.
 * Below that the section shows the DESIGNED PRE-FLOOR state — "N of 4 members
 * positioned" with the tally drawn as filled/empty slots — rather than
 * disappearing. A block that vanishes teaches nothing; a block that says how
 * far off the read is turns the floor into an invitation. A founding club still
 * never sees a 100% bullish ring built from one person.
 *
 * KID WALL: sentiment is an adults+teens surface everywhere else in the club.
 * `showSentiment={false}` keeps that wall intact here.
 *
 * COLOUR: the board draws bullish green and bearish pink, and its hexes
 * (#0BA05A / #D92652) ARE the club-mode values of --price-up / --price-down —
 * so the tokens reproduce the board exactly and flip for dark on their own.
 */

const SPLIT_FLOOR = 4; // positioned members required before the split draws
const WATCHERS_FLOOR = 3;

/**
 * THE SETTLE DEADLINE. Three independent reads feed this block, and a single one
 * that never answers used to leave a brand-orange section mark standing over an
 * animated grey nothing for the life of the page — a heading with no body, which
 * is the one shape a section must never take. After this long the block gives up
 * waiting and renders whatever DID arrive, honestly.
 */
const SETTLE_MS = 4000;

export interface Portrait {
  id: string;
  name: string;
  avatar: string | null;
  side: "bull" | "bear";
  /** epoch ms of the post — the canvas head places its marks with this. */
  at: number;
}

/** `get_ticker_stance_summary` (mig 151) — the tally over `ticker_stances`. */
interface StanceTally {
  bull: number | null;
  bear: number | null;
  neutral: number | null;
  mind_changes?: number | null;
}

interface CommunityStats {
  watching: number;
  discussions_week: number;
  bull: number;
  neutral: number;
  bear: number;
  positioned: number;
}

interface IntelResponse {
  active?: boolean;
  rank?: number | null;
  clubScore?: number | null;
  scoreChange24h?: number | null;
  watchers?: number;
  participants?: number;
  sentiment?: {
    bullish: number;
    neutral: number;
    bearish: number;
    change24h?: number;
  } | null;
}

/** Everything the ticker page knows about what the club thinks of one name. */
export interface ClubReadData {
  /** false until BOTH reads have settled — loading is not emptiness. */
  resolved: boolean;
  bull: number;
  neutral: number;
  bear: number;
  positioned: number;
  watchers: number;
  discussions: number;
  participants: number | null;
  rank: number | null;
  clubScore: number | null;
  sentimentShift24h: number | null;
  faces: Portrait[];
}

const EMPTY: ClubReadData = {
  resolved: false,
  bull: 0,
  neutral: 0,
  bear: 0,
  positioned: 0,
  watchers: 0,
  discussions: 0,
  participants: null,
  rank: null,
  clubScore: null,
  sentimentShift24h: null,
  faces: [],
};

/**
 * One read of the club's position on a ticker, shared by the canvas head (the
 * watching stack) and this section (the ring). Lifting it into a hook is what
 * keeps the faces on the head and the numbers in the ring from coming out of
 * two different fetches — they are the same rows, so they can never disagree.
 */
export function useClubRead(supabase: SupabaseClient, ticker: string): ClubReadData {
  // Each lane stores WHICH TICKER it settled for rather than a bare boolean.
  // Switching ticker then invalidates the read for free, with no setState in
  // the effect body (which would cascade a render on every mount).
  const [stats, setStats] = useState<{ for: string; row: CommunityStats | null } | null>(null);
  const [intel, setIntel] = useState<{ for: string; row: IntelResponse | null } | null>(null);
  const [stance, setStance] = useState<{ for: string; row: StanceTally | null } | null>(null);
  const [faces, setFaces] = useState<Portrait[]>([]);
  const [settled, setSettled] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let on = true;

    // The deadline. Cleared on unmount / ticker change so it can never fire for
    // a ticker the member has already left.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (on) setSettled(ticker);
    }, SETTLE_MS);

    // THE STORE WITH DATA. Same RPC the stance picker writes through, so what
    // the ring counts and what a member just clicked are the same rows.
    supabase.rpc("get_ticker_stance_summary", { p_ticker: ticker }).then(
      ({ data }) => {
        if (!on) return;
        const d = (data ?? null) as StanceTally | null;
        setStance({ for: ticker, row: d });
      },
      () => on && setStance({ for: ticker, row: null })
    );

    supabase.rpc("get_ticker_community_stats", { p_ticker: ticker }).then(
      ({ data }) => {
        if (!on) return;
        const row = Array.isArray(data) ? data[0] : data;
        setStats({ for: ticker, row: (row as CommunityStats) ?? null });
      },
      () => on && setStats({ for: ticker, row: null })
    );

    fetch(`/api/club/intel/${encodeURIComponent(ticker)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: IntelResponse | null) => {
        if (!on) return;
        setIntel({ for: ticker, row: d?.active ? d : null });
      })
      .catch(() => on && setIntel({ for: ticker, row: null }));

    supabase
      .from("feed_posts")
      .select(
        "id, position, created_at, author:profiles!feed_posts_author_id_fkey(id, display_name, avatar_url)"
      )
      .contains("ticker_tags", [ticker])
      .in("position", ["bull", "bear"])
      .order("created_at", { ascending: false })
      .limit(60)
      .then(
        ({ data }) => {
          if (!on || !data) return;
          const seen = new Set<string>();
          const out: Portrait[] = [];
          for (const raw of data as unknown[]) {
            const row = raw as {
              position: "bull" | "bear";
              created_at: string | null;
              author:
                | { id: string; display_name: string | null; avatar_url: string | null }
                | { id: string; display_name: string | null; avatar_url: string | null }[]
                | null;
            };
            const a = Array.isArray(row.author) ? row.author[0] : row.author;
            if (!a?.id || seen.has(a.id)) continue;
            const at = row.created_at ? Date.parse(row.created_at) : NaN;
            seen.add(a.id);
            out.push({
              id: a.id,
              name: a.display_name || "Member",
              avatar: a.avatar_url,
              side: row.position,
              at: Number.isFinite(at) ? at : 0,
            });
          }
          setFaces(out);
        },
        () => {}
      );

    return () => {
      on = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [supabase, ticker]);

  const st = stats?.for === ticker ? stats.row : null;
  const it = intel?.for === ticker ? intel.row : null;
  const ss = stance?.for === ticker ? stance.row : null;
  const snapSent = it?.sentiment ?? null;

  /* ONE SOURCE, NOT A BLEND. Three stores answer the same question over
     overlapping populations, so summing them would count one member twice and
     make the denominator meaningless. The richest single tally wins — it is the
     fullest true statement available, and every percentage printed below is
     then a statement about ONE well-defined set of members. */
  const candidates = [
    ss ? { bull: ss.bull ?? 0, neutral: ss.neutral ?? 0, bear: ss.bear ?? 0 } : null,
    st ? { bull: st.bull, neutral: st.neutral, bear: st.bear } : null,
    snapSent
      ? { bull: snapSent.bullish, neutral: snapSent.neutral, bear: snapSent.bearish }
      : null,
  ].filter(Boolean) as { bull: number; neutral: number; bear: number }[];
  const best =
    candidates.sort(
      (a, b) => b.bull + b.neutral + b.bear - (a.bull + a.neutral + a.bear)
    )[0] ?? { bull: 0, neutral: 0, bear: 0 };
  const { bull, neutral, bear } = best;

  const allIn =
    stats?.for === ticker && intel?.for === ticker && stance?.for === ticker;

  return {
    // Resolved when every lane has answered OR the settle deadline has passed —
    // "still waiting" is a state with an end, not a permanent one.
    resolved: allIn || settled === ticker,
    bull,
    neutral,
    bear,
    positioned: bull + neutral + bear,
    watchers: it?.watchers ?? st?.watching ?? 0,
    discussions: st?.discussions_week ?? 0,
    participants: it?.participants ?? null,
    rank: it?.rank ?? null,
    clubScore: it?.clubScore ?? null,
    sentimentShift24h: snapSent?.change24h ?? it?.scoreChange24h ?? null,
    faces,
  };
}

export default function ClubRead({
  data = EMPTY,
  showSentiment = true,
  stance,
}: {
  data?: ClubReadData;
  /** false for kids — the same sentiment wall the debate and intel API apply */
  showSentiment?: boolean;
  /**
   * The member's OWN stance control, rendered inside this block. It used to be
   * its own section further down the page, which meant the club's read and the
   * member's contribution to it were two unrelated objects with a debate widget
   * (carrying a third sentiment bar) between them. One question, one object.
   */
  stance?: ReactNode;
}) {
  const { resolved, bull, neutral, positioned, watchers, discussions } = data;

  const hasSplit = showSentiment && positioned >= SPLIT_FLOOR;
  const hasAttention = watchers >= WATCHERS_FLOOR || discussions >= 1;

  // LOADING IS NOT EMPTY: hold the block's shape until both reads land, so a
  // busy ticker never flashes "the club hasn't formed a read".
  if (!resolved) {
    return (
      <section aria-busy="true" aria-label="Reading the club">
        <SectionMark>Where the club stands</SectionMark>
        <div className="mt-3 flex items-center gap-3.5">
          <div className="flex-1 space-y-2">
            <div className="mx-auto h-6 w-14 rounded-full bg-ink/10 motion-safe:animate-pulse" />
            <div className="mx-auto h-2 w-16 rounded-full bg-ink/10 motion-safe:animate-pulse" />
          </div>
          <div className="h-[116px] w-[116px] shrink-0 rounded-full bg-ink/[0.07] motion-safe:animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="mx-auto h-6 w-14 rounded-full bg-ink/10 motion-safe:animate-pulse" />
            <div className="mx-auto h-2 w-16 rounded-full bg-ink/10 motion-safe:animate-pulse" />
          </div>
        </div>
        <div className="mt-3.5 flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <StatCard key={i} value="" label="" loading />
          ))}
        </div>
      </section>
    );
  }

  // Genuinely cold ticker AND no stance control to offer → say nothing. (With
  // a control to offer, the pre-floor state below is the better answer: it tells
  // the member exactly how far the read is from unlocking.)
  if (!hasSplit && !hasAttention && positioned === 0 && !stance) return null;

  const bullPct = hasSplit ? Math.round((bull / positioned) * 100) : 0;
  const neutralPct = hasSplit ? Math.round((neutral / positioned) * 100) : 0;
  const score = data.clubScore != null ? Math.round(data.clubScore) : null;
  const shift = data.sentimentShift24h;
  const opinions = positioned || data.participants || 0;

  return (
    <section aria-labelledby="club-read">
      <SectionMark id="club-read" suffix="Raw sentiment">
        Where the club stands
      </SectionMark>

      {hasSplit ? (
        <>
          <div className="mt-4">
            <CollectiveSignal raw={bullPct} weighted={score ?? bullPct} opinions={opinions} />
          </div>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-soft">
            {score != null ? (
              <>
                Club signal is this name&apos;s weighted attention-and-conviction
                score. {bullPct}% of {positioned.toLocaleString()} positioned members
                lean bullish, {neutralPct}% are neutral.
              </>
            ) : (
              <>
                {positioned.toLocaleString()} members have taken a side — {neutralPct}%
                of them are neutral. The club hasn&apos;t scored this name yet.
              </>
            )}
          </p>

          {/* The four-up measure row the board draws under the ring. Every one
              of these is a stored number; a source that resolved to nothing
              renders an em-dash rather than a plausible stand-in. */}
          <div className="mt-3.5 flex gap-2">
            <StatCard value={opinions ? opinions.toLocaleString() : "—"} label="Total opinions" />
            <StatCard
              value={shift == null ? "—" : `${shift > 0 ? "+" : ""}${Math.round(shift)}`}
              label="Shift today"
              tone={shift == null ? "ink" : shift > 0 ? "up" : shift < 0 ? "down" : "ink"}
            />
            <StatCard
              value={watchers >= WATCHERS_FLOOR ? watchers.toLocaleString() : "—"}
              label="Watching"
            />
            <StatCard
              value={data.rank != null ? `#${data.rank}` : "—"}
              label="Club rank"
              tone={data.rank != null ? "brand" : "ink"}
              href={data.rank != null ? "/discover" : undefined}
            />
          </div>
        </>
      ) : (
        /* ── THE PRE-FLOOR STATE ──────────────────────────────────────────
           Designed, not omitted. The block used to disappear below the floor,
           which on a founding club meant it disappeared everywhere — the
           centrepiece of this page was invisible in production and nobody could
           tell whether that was a quiet club or a broken feature. It now COUNTS
           DOWN: the slots show how many members have positioned against how many
           the split needs, so the floor reads as a threshold you can move rather
           than a section that failed to load. */
        <Card radius="md" className="mt-3 p-[15px_16px]">
          <div className="flex items-center gap-2.5" aria-hidden>
            {Array.from({ length: SPLIT_FLOOR }).map((_, i) => (
              <span
                key={i}
                className={`h-[9px] flex-1 rounded-full ${
                  i < Math.min(positioned, SPLIT_FLOOR) ? "bg-volt-500" : "bg-sand"
                }`}
              />
            ))}
          </div>
          <p className="mt-3 font-display text-[15px] font-extrabold leading-snug text-ink">
            {positioned > 0 ? (
              <>
                <span className="font-mono tabular-nums">{positioned}</span> of{" "}
                <span className="font-mono tabular-nums">{SPLIT_FLOOR}</span> members
                positioned
              </>
            ) : (
              <>Nobody has taken a side on this name yet</>
            )}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-soft">
            {showSentiment
              ? `The club's read unlocks at ${SPLIT_FLOOR} — a split built from one or two people isn't a read, it's an anecdote.`
              : "The club's read on this name isn't published on your account."}
          </p>
          {(watchers >= WATCHERS_FLOOR || discussions >= 1) && (
            <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
              {[
                watchers >= WATCHERS_FLOOR ? `${watchers.toLocaleString()} watching` : null,
                discussions >= 1
                  ? `${discussions} ${discussions === 1 ? "discussion" : "discussions"} this week`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </Card>
      )}

      {/* The member's own stance — the same question, answered by them. */}
      {stance && <div className="f0-rule-top mt-5 pt-5">{stance}</div>}
    </section>
  );
}
