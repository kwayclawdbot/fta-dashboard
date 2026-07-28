"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  Card,
  Donut,
  DotTally,
  SectionMark,
  StatCard,
} from "@/components/research/board";

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
 * SOURCES (real, floor-gated, never fabricated) — unchanged from the version
 * this replaces:
 *   • get_ticker_community_stats (migration 132) — the bull/neutral/bear tally
 *     over positioned feed posts, plus watchers and this week's discussions.
 *   • ticker_intel_snapshots via /api/club/intel/[ticker] (migration 141) —
 *     club score, rank, watchers, participants, the 24h sentiment shift, and
 *     the sentiment fallback when the RPC has no tally.
 *   • feed_posts → profiles — the portraits behind the tally, surfaced by the
 *     canvas head as the "N watching now" stack.
 *
 * FLOORS: the split only draws once SPLIT_FLOOR members have positioned.
 * Below that the section degrades to the honest attention line (or renders
 * nothing at all when the ticker is genuinely cold) — a founding club never
 * sees a 100% bullish ring built from one person.
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

export interface Portrait {
  id: string;
  name: string;
  avatar: string | null;
  side: "bull" | "bear";
  /** epoch ms of the post — the canvas head places its marks with this. */
  at: number;
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
  const [faces, setFaces] = useState<Portrait[]>([]);

  useEffect(() => {
    let on = true;

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
    };
  }, [supabase, ticker]);

  // The RPC tally wins (it is the same rows the portraits come from); the
  // snapshot fills in when the RPC has no tally.
  const st = stats?.for === ticker ? stats.row : null;
  const it = intel?.for === ticker ? intel.row : null;
  const snapSent = it?.sentiment ?? null;
  const bull = st?.positioned ? st.bull : snapSent?.bullish ?? 0;
  const neutral = st?.positioned ? st.neutral : snapSent?.neutral ?? 0;
  const bear = st?.positioned ? st.bear : snapSent?.bearish ?? 0;

  return {
    resolved: stats?.for === ticker && intel?.for === ticker,
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
}: {
  data?: ClubReadData;
  /** false for kids — the same sentiment wall the debate and intel API apply */
  showSentiment?: boolean;
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

  // Genuinely cold ticker, nothing verified to say → say nothing.
  if (!hasSplit && !hasAttention) return null;

  const bullPct = hasSplit ? Math.round((bull / positioned) * 100) : 0;
  const neutralPct = hasSplit ? Math.round((neutral / positioned) * 100) : 0;
  const bearPct = hasSplit ? Math.max(0, 100 - bullPct - neutralPct) : 0;

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
          <div className="mt-3 flex items-center gap-3.5">
            <div className="min-w-0 flex-1 text-center">
              <p className="font-display text-[24px] font-extrabold leading-none tracking-tight text-price-up">
                {bullPct}%
              </p>
              <p className="mt-1 font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em] text-price-up">
                Bullish
              </p>
              <DotTally pct={bullPct} tone="up" ariaLabel={`${bullPct}% bullish`} />
            </div>

            <Donut
              pct={score}
              size={116}
              thickness={9}
              glow
              label={
                score != null
                  ? `Club signal ${score} out of 100`
                  : "Club signal not yet scored"
              }
            >
              <span className="block font-display text-[26px] font-extrabold leading-none tracking-tight text-ink">
                {score ?? "—"}
                {score != null && <span className="text-[14px] text-soft">%</span>}
              </span>
              <span className="mt-1 block font-mono text-[7px] font-semibold uppercase leading-[1.25] tracking-[0.12em] text-gold-700">
                Club
                <br />
                signal
              </span>
            </Donut>

            <div className="min-w-0 flex-1 text-center">
              <p className="font-display text-[24px] font-extrabold leading-none tracking-tight text-price-down">
                {bearPct}%
              </p>
              <p className="mt-1 font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em] text-price-down">
                Bearish
              </p>
              <DotTally pct={bearPct} tone="down" ariaLabel={`${bearPct}% bearish`} />
            </div>
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
        <Card radius="md" className="mt-3 p-[14px_15px]">
          <p className="text-[13px] leading-relaxed text-soft">
            The club hasn&apos;t formed a read on this name yet
            {showSentiment
              ? " — take a side below and you'll be the first signal on this board."
              : "."}
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
    </section>
  );
}
