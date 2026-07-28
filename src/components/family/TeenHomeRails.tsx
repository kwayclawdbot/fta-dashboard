"use client";

/**
 * TEEN HOME RAILS — the household's live objects, on the teen's own Home.
 *
 * The audit finding this fixes: a teen in a family household landed on a Home
 * that showed them lessons and belts and nothing their FAMILY was doing. The
 * parent surfaces (/family, /family/watchlist) carry the two objects a teen
 * actually has a stake in — tonight's watchlist vote and the paper challenge —
 * and a teen had no door to either from Home.
 *
 * Both rails read the SAME data the parent surfaces read:
 *   • family_watchlist + family_watchlist_votes for tonight's pick
 *     (mirrors /family/watchlist: one vote per member per `vote_night`, the
 *     leader is the highest tally, the night key is the UTC date so the two
 *     surfaces always agree on which night they are counting).
 *   • the `family_paper_standings(p_family)` definer RPC for the challenge
 *     (mirrors /family). sim_portfolios RLS is strictly own-row, so this RPC is
 *     the only sanctioned family-scoped window — and it is granted to
 *     `authenticated`, gated only on `p_family = get_my_family_id()`. A minor in
 *     the household passes that check exactly like a parent does; nothing here
 *     needs a parent role.
 *
 * PROGRESSIVE, NEVER GATING: the fetch is kicked off after mount and every call
 * is timeout-capped. Until it resolves this component renders NOTHING — loading
 * is not an empty state, and an unresolved rail must never push a placeholder
 * into the teen's Home.
 *
 * KID-SAFE: a minor is never shown a price. The standings RPC returns `balance`
 * in dollars alongside `return_pct`; only the PERCENT is read here (the same
 * choice /family makes), and the dollar figure is deliberately never destructured
 * out of the payload.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, LOAD_TIMEOUT_MS } from "@/lib/async";
import { Meter } from "@/components/f0/parts";

/* The vote night, as a stable snapshot. `new Date()` in a render body is both an
   impure read and a hydration mismatch (the server's date can be the viewer's
   yesterday), so the date arrives through useSyncExternalStore exactly like the
   greeting clock in DashboardHomeClient: null on the server and on the first
   client render, filled in immediately after. The UTC slice is deliberate — it
   is byte-for-byte what /family/watchlist writes into `vote_night`. */
const SUBSCRIBE = () => () => {};
const CLIENT_NIGHT = () => new Date().toISOString().slice(0, 10);
const SERVER_NIGHT = () => null;

interface Vote {
  user_id: string;
  ticker: string;
}

interface Standing {
  user_id: string;
  display_name: string | null;
  return_pct: number | null;
}

interface Resolved {
  /** Does the household have anything on its board to vote on? */
  hasBallot: boolean;
  votesCast: number;
  viewerVoted: boolean;
  leader: string | null;
  standings: Standing[];
}

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export default function TeenHomeRails({
  familyId,
  viewerId,
}: {
  familyId: string;
  viewerId: string;
}) {
  const night = useSyncExternalStore(SUBSCRIBE, CLIENT_NIGHT, SERVER_NIGHT);
  const [data, setData] = useState<Resolved | null>(null);

  useEffect(() => {
    if (!night || !familyId) return;
    let live = true;
    const supabase = createClient();

    void (async () => {
      const [ballot, votes, standings] = await Promise.all([
        withTimeout<{ data: { id: string }[] | null }>(
          supabase.from("family_watchlist").select("id").eq("family_id", familyId).limit(1),
          LOAD_TIMEOUT_MS,
          { data: null }
        ),
        withTimeout<{ data: Vote[] | null }>(
          supabase
            .from("family_watchlist_votes")
            .select("user_id, ticker")
            .eq("family_id", familyId)
            .eq("vote_night", night),
          LOAD_TIMEOUT_MS,
          { data: null }
        ),
        withTimeout<{ data: Standing[] | null }>(
          supabase.rpc("family_paper_standings", { p_family: familyId }),
          LOAD_TIMEOUT_MS,
          { data: null }
        ),
      ]);
      if (!live) return;

      const rows = (votes.data ?? []) as Vote[];
      const tally = new Map<string, number>();
      for (const v of rows) tally.set(v.ticker, (tally.get(v.ticker) ?? 0) + 1);
      const leader = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      setData({
        hasBallot: (ballot.data ?? []).length > 0,
        votesCast: rows.length,
        viewerVoted: rows.some((v) => v.user_id === viewerId),
        leader,
        standings: ((standings.data ?? []) as Standing[]).filter(Boolean),
      });
    })().catch(() => {
      /* best-effort rail: a failure renders nothing, never a fake standing */
    });

    return () => {
      live = false;
    };
  }, [familyId, viewerId, night]);

  // Unresolved → nothing. See the header note: loading is not empty.
  if (!data) return null;

  const inChallenge = data.standings.filter((s) => s.return_pct != null);
  const leaderStanding = inChallenge[0] ?? null;
  const mine = inChallenge.find((s) => s.user_id === viewerId) ?? null;
  const best = Math.max(1, ...inChallenge.map((s) => Math.abs(s.return_pct ?? 0)));

  // The vote is OPEN for this teen when the household has a board and they
  // haven't cast tonight's vote. It is DECIDED once a leader exists. If neither
  // is true there is genuinely nothing tonight, and nothing renders.
  const voteOpen = data.hasBallot && !data.viewerVoted;
  const showVote = voteOpen || !!data.leader;

  if (!showVote && inChallenge.length === 0) return null;

  return (
    <>
      {showVote && (
        <section className="f0-rule-top pt-4" aria-labelledby="teen-tonight">
          <h2
            id="teen-tonight"
            className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink"
          >
            <span>Tonight at home</span>
          </h2>

          {voteOpen ? (
            <Link
              href="/family/watchlist"
              className="club-b-card f0-ledger-row f0-focus group mt-2"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--accent-solid)_12%,transparent)] text-gold-700">
                <CalendarClock className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[14.5px] font-bold text-ink">
                  Vote night is on — cast yours
                </span>
                <span className="mt-0.5 block text-[12.5px] text-soft">
                  {data.votesCast > 0
                    ? `${data.votesCast} vote${data.votesCast === 1 ? "" : "s"} in. Pick the company the family studies tonight.`
                    : "Pick the company the family studies tonight."}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-soft transition-all group-hover:translate-x-0.5 group-hover:text-gold-700 motion-reduce:transform-none" />
            </Link>
          ) : (
            data.leader && (
              <>
                <p className="mt-3 font-display text-display-3 font-extrabold leading-snug text-ink">
                  The family picked{" "}
                  <span className="font-mono">{data.leader}</span> for tonight
                </p>
                <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-soft">
                  Come to the table knowing something. The 3-minute read is the
                  whole company in one page.
                </p>
                <div className="club-b-stack mt-3">
                  <Link
                    href={`/research/${encodeURIComponent(data.leader)}`}
                    className="club-b-card f0-ledger-row f0-focus group"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-700">
                        3-minute read
                      </span>
                      <span className="mt-1 block font-display text-[14.5px] font-bold text-ink">
                        Read up on {data.leader} first
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-gold-700 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                  </Link>
                  <Link
                    href="/family/watchlist"
                    className="club-b-card f0-ledger-row f0-focus group"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[14.5px] font-bold text-ink">
                        See how the family voted
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-soft">
                        {data.votesCast} vote{data.votesCast === 1 ? "" : "s"} on
                        the board tonight
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-soft transition-all group-hover:translate-x-0.5 group-hover:text-gold-700 motion-reduce:transform-none" />
                  </Link>
                </div>
              </>
            )
          )}
        </section>
      )}

      {inChallenge.length > 0 && (
        <section className="f0-rule-top pt-4" aria-labelledby="teen-challenge">
          <div className="flex items-end justify-between gap-3">
            <h2
              id="teen-challenge"
              className="min-w-0 flex-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink"
            >
              <span>The family challenge</span>
            </h2>
            <Link
              href="/family"
              className="f0-focus f0-press inline-flex shrink-0 items-center gap-1 rounded-md font-display text-[13px] font-bold text-gold-700 hover:text-gold-600"
            >
              Standings <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>

          <div className="club-b-stack mt-2">
            {mine ? (
              <div className="club-b-card f0-ledger-row">
                <Trophy className="h-4 w-4 shrink-0 self-start text-gold-700" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[14.5px] font-bold text-ink">You</p>
                  <Meter
                    pct={(Math.abs(mine.return_pct ?? 0) / best) * 100}
                    className="mt-2 max-w-xs"
                  />
                </div>
                <span
                  className={`shrink-0 font-mono text-[12px] font-semibold tabular-nums ${
                    (mine.return_pct ?? 0) >= 0 ? "text-price-up" : "text-price-down"
                  }`}
                >
                  {pct(mine.return_pct)}
                </span>
              </div>
            ) : (
              <Link href="/simulator" className="club-b-card f0-ledger-row f0-focus group">
                <Trophy className="h-4 w-4 shrink-0 self-start text-gold-700" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[14.5px] font-bold text-ink">
                    You&apos;re not in the challenge yet
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-soft">
                    Open a paper account — practice money only — and your bar
                    joins the household&apos;s.
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-soft transition-all group-hover:translate-x-0.5 group-hover:text-gold-700 motion-reduce:transform-none" />
              </Link>
            )}

            {leaderStanding && leaderStanding.user_id !== viewerId && (
              <div className="club-b-card f0-ledger-row">
                <span className="f0-rank shrink-0" aria-hidden>
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[14.5px] font-bold text-ink">
                    {leaderStanding.display_name || "Member"} leads
                  </p>
                  <Meter
                    pct={(Math.abs(leaderStanding.return_pct ?? 0) / best) * 100}
                    className="mt-2 max-w-xs"
                  />
                </div>
                <span
                  className={`shrink-0 font-mono text-[12px] font-semibold tabular-nums ${
                    (leaderStanding.return_pct ?? 0) >= 0
                      ? "text-price-up"
                      : "text-price-down"
                  }`}
                >
                  {pct(leaderStanding.return_pct)}
                </span>
              </div>
            )}

            {leaderStanding && leaderStanding.user_id === viewerId && (
              <p className="mt-1 text-[12.5px] text-soft">
                You&apos;re leading the household right now.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
