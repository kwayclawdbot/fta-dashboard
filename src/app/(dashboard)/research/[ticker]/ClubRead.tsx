"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * THE CLUB READ — what the club actually thinks about this ticker, drawn as a
 * PHYSICAL BAR with the members' own faces standing in their side of it.
 *
 * Why a bar and not another donut: a donut is a chart of a percentage. This is
 * a room of people who have taken a side, and the bar lets those people be
 * literally present — portraits sit inside the segment they voted for, so the
 * split reads as a crowd rather than as a statistic.
 *
 * COLOUR LAW — this section is SENTIMENT, so it is LIME. Green and red are
 * reserved for price and appear nowhere in here, no matter how tempting
 * "bullish = green" is. Bull is lime; bear is charcoal; neutral is sand.
 *
 * SOURCES (real, floor-gated, never fabricated):
 *   • get_ticker_community_stats  (migration 132) — the bull/neutral/bear tally
 *     over positioned feed posts, plus watchers and this week's discussions.
 *   • ticker_intel_snapshots via /api/club/intel/[ticker] (migration 141) —
 *     the canonical derived object; used to enrich `watchers` (distinct members
 *     ever watching) and as the sentiment fallback when the RPC has no tally.
 *   • feed_posts → profiles — the actual portraits behind the tally. The same
 *     rows the RPC counts, so the faces and the numbers can never disagree.
 *
 * FLOORS: the split only draws once SPLIT_FLOOR members have positioned. Below
 * that the section degrades to the honest attention line (or renders nothing at
 * all when the ticker is genuinely cold) — a founding club never sees a 100%
 * bullish bar built from one person.
 *
 * KID WALL: sentiment is an adults+teens surface everywhere else in the club
 * (the debate, /api/club/intel). `showSentiment={false}` keeps that wall intact
 * here — kids still get the attention line.
 */

const SPLIT_FLOOR = 4; // positioned members required before the split draws
const WATCHERS_FLOOR = 3;

/* THE BEAR SEGMENT is the "heavy opposite pole" of lime, and it has to stay
   distinct from the PAGE in both themes. A fixed charcoal reads on cream and
   disappears on obsidian, so the segment rides `midnight-100` — the text-cluster
   ramp, which inverts with the theme (near-black on paper, near-white on dark).
   Neutral rides `sand`, the surface ramp, so it always sits between the two. */
const BEAR_FILL = "bg-midnight-100";
const NEUTRAL_FILL = "bg-sand";


interface CommunityStats {
  watching: number;
  discussions_week: number;
  bull: number;
  neutral: number;
  bear: number;
  positioned: number;
}

interface Portrait {
  id: string;
  name: string;
  avatar: string | null;
  side: "bull" | "bear";
}

interface IntelResponse {
  active?: boolean;
  watchers?: number;
  participants?: number;
  sentiment?: { bullish: number; neutral: number; bearish: number } | null;
}

function Face({ p, size = 30 }: { p: Portrait; size?: number }) {
  const dim = { width: size, height: size };
  const ring =
    "shrink-0 rounded-full ring-2 ring-paper object-cover shadow-[0_1px_3px_rgba(16,24,40,0.25)]";
  if (p.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.avatar} alt={p.name} title={p.name} style={dim} className={ring} />;
  }
  const initials = p.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <span
      style={dim}
      title={p.name}
      className={`${ring} flex items-center justify-center bg-ink font-mono text-[10px] font-bold text-paper`}
    >
      {initials || "?"}
    </span>
  );
}

export default function ClubRead({
  supabase,
  ticker,
  showSentiment = true,
}: {
  supabase: SupabaseClient;
  ticker: string;
  /** false for kids — the same sentiment wall the debate and intel API apply */
  showSentiment?: boolean;
}) {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [intel, setIntel] = useState<IntelResponse | null>(null);
  const [faces, setFaces] = useState<Portrait[]>([]);

  useEffect(() => {
    let on = true;

    supabase.rpc("get_ticker_community_stats", { p_ticker: ticker }).then(
      ({ data }) => {
        if (!on) return;
        const row = Array.isArray(data) ? data[0] : data;
        if (row) setStats(row as CommunityStats);
      },
      () => {}
    );

    fetch(`/api/club/intel/${encodeURIComponent(ticker)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: IntelResponse | null) => {
        if (on && d?.active) setIntel(d);
      })
      .catch(() => {});

    // The faces behind the tally — the same positioned posts the RPC counts.
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
              author:
                | { id: string; display_name: string | null; avatar_url: string | null }
                | { id: string; display_name: string | null; avatar_url: string | null }[]
                | null;
            };
            const a = Array.isArray(row.author) ? row.author[0] : row.author;
            if (!a?.id || seen.has(a.id)) continue;
            seen.add(a.id);
            out.push({
              id: a.id,
              name: a.display_name || "Member",
              avatar: a.avatar_url,
              side: row.position,
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

  // Merge the two sanctioned sources. The RPC tally wins (it is the same rows
  // the portraits come from); the snapshot fills in when the RPC has no tally.
  const snapSent = intel?.sentiment ?? null;
  const bull = stats?.positioned ? stats.bull : snapSent?.bullish ?? 0;
  const neutral = stats?.positioned ? stats.neutral : snapSent?.neutral ?? 0;
  const bear = stats?.positioned ? stats.bear : snapSent?.bearish ?? 0;
  const positioned = bull + neutral + bear;

  const watchers = intel?.watchers ?? stats?.watching ?? 0;
  const discussions = stats?.discussions_week ?? 0;

  const hasSplit = showSentiment && positioned >= SPLIT_FLOOR;
  const hasAttention = watchers >= WATCHERS_FLOOR || discussions >= 1;

  // Genuinely cold ticker, nothing verified to say → say nothing.
  if (!hasSplit && !hasAttention) return null;

  const bullPct = hasSplit ? Math.round((bull / positioned) * 100) : 0;
  const neutralPct = hasSplit ? Math.round((neutral / positioned) * 100) : 0;
  const bearPct = hasSplit ? Math.max(0, 100 - bullPct - neutralPct) : 0;

  const bullFaces = faces.filter((f) => f.side === "bull").slice(0, 5);
  const bearFaces = faces.filter((f) => f.side === "bear").slice(0, 4);

  const attention = [
    watchers >= WATCHERS_FLOOR ? `${watchers.toLocaleString()} watching` : null,
    discussions >= 1
      ? `${discussions} ${discussions === 1 ? "discussion" : "discussions"} this week`
      : null,
    hasSplit ? `${positioned.toLocaleString()} positioned` : null,
  ].filter(Boolean) as string[];

  return (
    <section aria-labelledby="club-read">
      <h2 id="club-read" className="f0-section-rule">
        <span className="font-display text-eyebrow font-bold uppercase text-ink">
          The club read
        </span>
      </h2>

      {hasSplit ? (
        <>
          <p className="mt-4 font-display text-display-3 font-extrabold text-ink">
            <span className="font-mono tabular-nums">{bullPct}%</span> of the club leans bullish
          </p>

          {/* ── the physical bar ──────────────────────────────────────────
              Lime = bullish, sand = neutral, the inverting text ramp = bearish.
              The inset top highlight (white at low alpha, theme-invariant) is
              what makes this read as an OBJECT rather than a coloured div; the
              drop shadow simply stops registering on the dark page, which is
              correct — dark surfaces don't cast onto themselves. */}
          <div
            className="mt-4 flex h-16 w-full overflow-hidden rounded-xl shadow-[0_10px_22px_-16px_rgba(16,24,40,0.5),inset_0_1px_0_rgba(255,255,255,0.45)]"
            role="img"
            aria-label={`${bullPct}% bullish, ${neutralPct}% neutral, ${bearPct}% bearish, from ${positioned} members`}
          >
            <div
              className="relative flex items-center overflow-hidden bg-lime-400 px-3"
              style={{ width: `${bullPct}%` }}
            >
              <span className="flex items-center">
                {bullFaces.map((f, i) => (
                  <span key={f.id} className={i > 0 ? "-ml-2.5" : ""}>
                    <Face p={f} />
                  </span>
                ))}
              </span>
            </div>
            {neutralPct > 0 && (
              <div className={NEUTRAL_FILL} style={{ width: `${neutralPct}%` }} aria-hidden />
            )}
            <div
              className={`relative flex items-center justify-end overflow-hidden px-3 ${BEAR_FILL}`}
              style={{ width: `${bearPct}%` }}
            >
              <span className="flex items-center">
                {bearFaces.map((f, i) => (
                  <span key={f.id} className={i > 0 ? "-ml-2.5" : ""}>
                    <Face p={f} />
                  </span>
                ))}
              </span>
            </div>
          </div>

          {/* ledger under the bar — hairline columns, mono counts */}
          <div className="mt-4 flex border-y border-sand">
            {[
              { label: "Bullish", pct: bullPct, n: bull, swatch: "bg-lime-400" },
              { label: "Neutral", pct: neutralPct, n: neutral, swatch: NEUTRAL_FILL },
              { label: "Bearish", pct: bearPct, n: bear, swatch: BEAR_FILL },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`min-w-0 flex-1 py-3 ${i > 0 ? "border-l border-sand pl-3.5" : "pr-3.5"}`}
              >
                <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-soft">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${s.swatch}`} aria-hidden />
                  {s.label}
                </p>
                <p className="mt-1.5 font-mono text-[14.5px] font-semibold tabular-nums text-ink">
                  {s.pct}%
                  <span className="ml-1.5 text-[11px] font-medium text-soft">
                    {s.n.toLocaleString()}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-[13.5px] leading-relaxed text-soft">
          The club hasn&apos;t formed a read on ${ticker} yet
          {showSentiment ? " — take a side below and you'll be the first signal on this board." : "."}
        </p>
      )}

      {attention.length > 0 && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
          {attention.join(" · ")}
        </p>
      )}
    </section>
  );
}
