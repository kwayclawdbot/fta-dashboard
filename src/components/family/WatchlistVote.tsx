"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { awardXp, hasXpForRef } from "@/lib/xp";
import Avatar from "@/components/Avatar";
import type { CircleVote, FamilyMember, WatchlistEntry } from "@/lib/family/queries";
import { FoundingState, FamilyCard, Chip, Eyebrow } from "@/components/family/canvas";
import { GUARDRAIL_VOTE_BLOCKED } from "@/lib/family/guardrails";

/** What a vote pays. Kept next to the code that actually inserts it. */
const VOTE_XP = 10;

/* Board geometry: one big centred orb for the leading pick, the rest on a ring
   around it, joined by dashed spokes. */
const FIELD = 264;
const RADIUS = 98;
const LEAD_SIZE = 88;
const ORB_SIZE = 64;

/**
 * F6 · "Which company should we learn about tonight?" — board tile
 * "F6 Family Watchlist", built as the constellation it is drawn as.
 *
 * Every orb is the control: tapping one casts your vote for that company. The
 * centre orb is whichever name is currently leading, which is exactly what the
 * board draws (a lit-up NVDA in the middle with the also-rans around it) and it
 * is real — the leader is computed from the votes actually in the table.
 *
 * A real write: one row per member per night in family_watchlist_votes, with a
 * unique constraint that makes changing your mind an update rather than a
 * second ballot. The tally is a COMMUNITY reading, so it is lime by law — never
 * green, which belongs to price alone.
 *
 * NOT DRAWN: the dashed "+ Add vote" slot. It implies adding a company to the
 * ballot from here, and there is no family-watchlist insert path on this
 * surface — a slot that opens nothing is worse than no slot.
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
      setError(GUARDRAIL_VOTE_BLOCKED);
      return;
    }
    setVotes((prev) => [...prev.filter((v) => v.user_id !== viewerId), data as CircleVote]);

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

  // The centre orb is the name in the lead; ties fall back to watchlist order.
  const ranked = [...options].sort(
    (a, b) => (tally.get(b.ticker) ?? 0) - (tally.get(a.ticker) ?? 0)
  );
  const lead = ranked[0];
  const ring = ranked.slice(1, 7);
  const leadCount = tally.get(lead.ticker) ?? 0;

  return (
    <div>
      {/* ── The constellation ────────────────────────────────────────────*/}
      <div
        className="relative mx-auto"
        style={{ width: FIELD, height: FIELD }}
        role="group"
        aria-label="Cast your vote for tonight's company"
      >
        {/* Dashed spokes — one per satellite, drawn out from the centre. */}
        {ring.map((o, i) => {
          const angle = -90 + (360 / Math.max(1, ring.length)) * i;
          return (
            <span
              key={`spoke-${o.id}`}
              aria-hidden
              className="absolute left-1/2 top-1/2 origin-left"
              style={{
                width: RADIUS,
                height: 0,
                borderTop: "1.5px dashed var(--sand)",
                transform: `rotate(${angle}deg)`,
              }}
            />
          );
        })}

        <Orb
          entry={lead}
          size={LEAD_SIZE}
          lead
          count={leadCount}
          picked={mine?.ticker === lead.ticker}
          busy={busy !== null}
          onPick={cast}
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {ring.map((o, i) => {
          const angle = (-90 + (360 / Math.max(1, ring.length)) * i) * (Math.PI / 180);
          return (
            <Orb
              key={o.id}
              entry={o}
              size={ORB_SIZE}
              count={tally.get(o.ticker) ?? 0}
              picked={mine?.ticker === o.ticker}
              busy={busy !== null}
              onPick={cast}
              style={{
                left: `calc(50% + ${Math.cos(angle) * RADIUS}px)`,
                top: `calc(50% + ${Math.sin(angle) * RADIUS}px)`,
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        })}
      </div>

      {error && (
        <p
          className="mt-4 rounded-xl border border-sand bg-card p-3 text-[13px] leading-relaxed text-ink shadow-soft"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* ── Cast your vote ───────────────────────────────────────────────*/}
      <FamilyCard className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-[15px] font-extrabold text-ink">Cast your vote</p>
          <Chip tone="accent">Vote = ⚡ +{VOTE_XP}</Chip>
        </div>
        <Eyebrow className="mt-1">Everyone&rsquo;s voice matters</Eyebrow>

        <div className="mt-3 flex flex-wrap gap-4">
          {members.map((m) => {
            const v = votes.find((x) => x.user_id === m.id);
            return (
              <div key={m.id} className="w-[68px] text-center">
                <div className="flex justify-center">
                  <Avatar
                    name={m.display_name}
                    avatarUrl={m.avatar_url}
                    role={m.role}
                    xp={m.xp}
                    size="lg"
                    className={v ? "" : "opacity-45"}
                  />
                </div>
                <p className="mt-1.5 truncate text-[10px] text-soft">
                  {m.display_name || "Member"} {v ? "✓" : "…"}
                </p>
                {v && (
                  <p className="truncate font-mono text-[9.5px] font-bold text-sentiment">
                    {v.ticker}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </FamilyCard>
    </div>
  );
}

/* ── The orb ──────────────────────────────────────────────────────────────
   A round company mark that IS the ballot button. The leading orb wears the
   dark field + accent ring the board gives it; the rest are card stock. The
   tally beneath is a community reading, so it is lime by law. */
function Orb({
  entry,
  size,
  lead = false,
  count,
  picked,
  busy,
  onPick,
  style,
}: {
  entry: WatchlistEntry;
  size: number;
  lead?: boolean;
  count: number;
  picked: boolean;
  busy: boolean;
  onPick: (e: WatchlistEntry) => void;
  style: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(entry)}
      disabled={busy}
      aria-pressed={picked}
      aria-label={`Vote for ${entry.company_name || entry.ticker}${
        count ? ` — ${count} ${count === 1 ? "vote" : "votes"}` : ""
      }`}
      className="f0-focus f0-press absolute grid place-items-center rounded-full disabled:opacity-60"
      style={{
        ...style,
        width: size,
        height: size,
        ...(lead
          ? {
              boxShadow: picked
                ? "0 0 0 3px var(--accent-solid), 0 0 22px color-mix(in srgb, var(--accent-solid) 40%, transparent)"
                : "0 0 0 3px var(--accent-solid)",
            }
          : {
              border: picked ? "2px solid var(--accent-solid)" : "2px solid var(--sand)",
              background: "var(--card)",
            }),
      }}
    >
      <span
        className={`grid h-full w-full place-items-center rounded-full text-center ${
          lead ? "f0-tile-field" : ""
        }`}
      >
        <span>
          <span
            className={`block font-display font-black leading-none ${
              lead ? "text-[24px]" : "text-[17px] text-ink"
            }`}
          >
            {entry.ticker.slice(0, 1)}
          </span>
          <span
            className={`mt-0.5 block font-mono text-[8px] ${lead ? "" : "text-soft"}`}
          >
            {entry.ticker}
          </span>
          {count > 0 && (
            <span className="mt-0.5 block font-mono text-[9px] font-bold tabular-nums text-sentiment">
              {count}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
