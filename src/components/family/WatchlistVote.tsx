"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { awardXp, hasXpForRef } from "@/lib/xp";
import { TickerTile } from "@/components/canvas2";
import Avatar from "@/components/Avatar";
import type { CircleVote, FamilyMember, WatchlistEntry } from "@/lib/family/queries";
import { FoundingState, XpTag } from "@/components/family/canvas";

/** What a vote pays. Kept next to the code that actually inserts it. */
const VOTE_XP = 10;

/**
 * F6 · "Which company should we learn about tonight?"
 *
 * A real write: one row per member per night in family_watchlist_votes, with a
 * unique constraint that makes changing your mind an update rather than a
 * second ballot. The tally is a COMMUNITY reading, so it is lime by law —
 * never green, which belongs to price alone.
 *
 * The cast-your-vote avatars are the canvas's own device and they are the
 * honest thing to draw here: at household scale you can see every single voter,
 * so a count would be a worse answer than the faces themselves.
 */
export default function WatchlistVote({
  familyId,
  viewerId,
  members,
  options,
  seed,
  night,
}: {
  familyId: string;
  viewerId: string;
  members: FamilyMember[];
  options: WatchlistEntry[];
  seed: CircleVote[];
  night: string;
}) {
  const [votes, setVotes] = useState<CircleVote[]>(seed);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mine = votes.find((v) => v.user_id === viewerId) ?? null;

  async function cast(entry: WatchlistEntry) {
    if (busy) return;
    setBusy(entry.ticker);
    setError(null);

    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("family_watchlist_votes")
      .upsert(
        {
          family_id: familyId,
          user_id: viewerId,
          ticker: entry.ticker,
          company_name: entry.company_name,
          vote_night: night,
        },
        { onConflict: "family_id,user_id,vote_night" }
      )
      .select("id, user_id, ticker, company_name, vote_night")
      .single();

    setBusy(null);
    if (err || !data) {
      setError(
        "That vote did not save. If a guardrail is active right now — downtime, or the daily limit — voting reopens when it lifts."
      );
      return;
    }
    setVotes((prev) => [
      ...prev.filter((v) => v.user_id !== viewerId),
      data as CircleVote,
    ]);

    // The XP the screen promises is actually paid — once per member per night,
    // guarded by ref so changing your mind does not farm it. If the copy says
    // ten XP, ten XP lands in xp_events.
    const ref = `family_vote:${night}`;
    if (!(await hasXpForRef(supabase, viewerId, "community", ref))) {
      await awardXp(supabase, viewerId, "community", VOTE_XP, ref);
    }
  }

  if (options.length === 0) {
    return (
      <FoundingState
        title="No companies to vote on yet"
        body="The ballot is built from the family watchlist. Add one company somebody in the house already knows — a brand they wear, a game they play — and tonight has a subject."
      />
    );
  }

  const tally = new Map<string, number>();
  for (const v of votes) tally.set(v.ticker, (tally.get(v.ticker) ?? 0) + 1);
  const leadCount = Math.max(0, ...tally.values());

  return (
    <div>
      <div className="club2-track -m-1 flex gap-3 overflow-x-auto p-1">
        {options.map((o) => {
          const count = tally.get(o.ticker) ?? 0;
          const picked = mine?.ticker === o.ticker;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => cast(o)}
              disabled={busy !== null}
              aria-pressed={picked}
              className="f0-focus f0-press flex shrink-0 flex-col items-center gap-2 rounded-lg p-1 disabled:opacity-45"
            >
              <TickerTile ticker={o.ticker} changePct={null} showDelta={false} />
              <span
                className={`f0-chip ${picked ? "f0-chip-on" : ""} text-[11px] font-display font-bold uppercase tracking-[0.06em]`}
              >
                {picked ? "Your vote" : "Vote"}
              </span>
              <span
                className={`text-[12px] font-display font-bold tabular-nums ${
                  count > 0 && count === leadCount ? "text-sentiment" : "text-soft"
                }`}
              >
                {count === 0 ? "—" : count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="f0-rule-left mt-5 py-1 pl-4 text-[14px] leading-relaxed text-ink" role="alert">
          {error}
        </p>
      )}

      {/* Everyone's voice matters — the household roster, marked as it lands. */}
      <div className="mt-8">
        <p className="text-eyebrow font-display font-bold uppercase text-soft">
          Everyone&rsquo;s voice matters
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          {members.map((m) => {
            const v = votes.find((x) => x.user_id === m.id);
            return (
              <span key={m.id} className="inline-flex items-center gap-2">
                <Avatar
                  name={m.display_name}
                  avatarUrl={m.avatar_url}
                  role={m.role}
                  xp={m.xp}
                  size="sm"
                  className={v ? "" : "opacity-45"}
                />
                <span className="text-[13px] text-soft">
                  {m.display_name || "Member"}
                  {v ? (
                    <span className="ml-1.5 font-display font-bold text-sentiment">
                      {v.ticker}
                    </span>
                  ) : (
                    <span className="ml-1.5">…</span>
                  )}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <p className="mt-6 text-[13px] text-soft">
        Casting a vote pays <XpTag amount={VOTE_XP} /> — one per member per night.
      </p>
    </div>
  );
}
