"use client";

import { useState } from "react";
import Link from "next/link";
import { SOCIAL_FLOORS } from "@/lib/social/reactions";
import type { Stance } from "@/lib/social/stance";
import { fmtPct, priceTone, type Day3Payload, type DaySeed } from "./data";
import {
  ErrorLine,
  KaiNote,
  PILL,
  MissionButton,
  MissionFooter,
  MissionHead,
  Note,
  Panel,
} from "./parts";

/**
 * DAY 3 · DO — VOTE YOUR CONVICTION.
 *
 * The room is the REAL community watchlist (`community_watchlist`), and the
 * split under each name is a real tally of the cohort's own Day-3 votes read out
 * of `challenge_artifacts`. There is no separate vote table to fake: a member
 * votes here, the vote lands in their Day-3 artifact, and the next member to
 * open this board counts it.
 *
 * BELOW THE FLOOR the split is WITHHELD, not rounded. Two votes rendered as
 * "50 / 50" is a fabricated signal wearing a real signal's clothes, which is the
 * exact failure `SOCIAL_FLOORS.debateStance` exists to stop. Under the floor the
 * row is a plain selector and says so.
 *
 * COLOUR: bull is not green and bear is not red — those belong to price, and the
 * price delta is sitting on the same row. Direction is carried by the label and
 * by left-to-right position; conviction by weight. Lime is the community's
 * colour and the only chromatic thing in the tally bar.
 */

/**
 * The one name where the member is on the other side of a REAL split. Only
 * names past the floor qualify — disagreeing with two people is not a debate.
 */
function findContrarian(
  room: DaySeed["room"],
  votes: Record<string, Stance>
): { entry: DaySeed["room"][number]; mine: Stance } | null {
  for (const r of room) {
    if (r.votes < SOCIAL_FLOORS.debateStance) continue;
    const mine = votes[r.ticker];
    if (!mine || mine === "neutral") continue;
    const roomLeans = r.bull > r.bear ? "bull" : r.bear > r.bull ? "bear" : null;
    if (roomLeans && roomLeans !== mine) return { entry: r, mine };
  }
  return null;
}

const ORDER: Stance[] = ["bear", "neutral", "bull"];
const LABEL: Record<Stance, string> = {
  bear: "Bearish",
  neutral: "Neutral",
  bull: "Bullish",
};

export default function Day3Do({
  seed,
  onSubmit,
  busy,
  error,
}: {
  seed: DaySeed;
  onSubmit: (payload: Day3Payload) => void;
  busy: boolean;
  error: string | null;
}) {
  const saved = seed.doPayload as Day3Payload | null;
  const [votes, setVotes] = useState<Record<string, Stance>>(() => {
    const v: Record<string, Stance> = {};
    for (const s of saved?.votes ?? []) v[s.ticker] = s.stance;
    return v;
  });

  const room = seed.room;
  const need = Math.min(3, room.length);
  const cast = room.filter((r) => votes[r.ticker]).length;
  const enough = room.length > 0 && cast >= need;

  /* The name the member disagrees with the room about is the interesting one —
     it is what the debate is for. Computed only where a real split exists. */
  const contrarian = findContrarian(room, votes);

  const submit = () => {
    onSubmit({
      votes: room
        .filter((r) => votes[r.ticker])
        .map((r) => ({
          ticker: r.ticker,
          company: r.company ?? null,
          stance: votes[r.ticker],
        })),
    });
  };

  if (room.length === 0) {
    return (
      <div className="f0-stagger space-y-7">
        <MissionHead align="left">
          The room&rsquo;s watchlist is <span className="text-gold-700">empty tonight</span>
        </MissionHead>
        <Note>
          Nothing has been promoted to the community watchlist yet, so there is
          nothing to vote on. Put a name on it and this board fills for everyone —
          including you.
        </Note>
        <MissionFooter>
          <MissionButton href="/watchlist/community">
            Open the community watchlist
          </MissionButton>
        </MissionFooter>
      </div>
    );
  }

  return (
    <div className="f0-stagger space-y-7">
      <div className="space-y-2">
        <MissionHead align="left">
          The room&rsquo;s watchlist —{" "}
          <span className="text-gold-700">where do you stand?</span>
        </MissionHead>
        <p className="text-[15px] leading-relaxed text-soft">
          Read each one, then say it out loud. You can change your mind later —
          changing your mind in public is the point.
        </p>
      </div>

      <div className="space-y-4">
        {room.map((r, i) => {
          const mine = votes[r.ticker] ?? null;
          const showSplit = r.votes >= SOCIAL_FLOORS.debateStance;
          const bullPct = showSplit && r.votes > 0 ? Math.round((r.bull / r.votes) * 100) : null;
          return (
            <Panel key={r.ticker} lead={Boolean(mine)}>
              <div className="flex items-start gap-3">
                <span className="f0-rank mt-1 shrink-0" aria-hidden>
                  {i + 1}
                </span>
                <span
                  className="f0-tile-field grid h-10 w-10 shrink-0 place-items-center rounded-[10px] font-display text-[17px] font-black"
                  aria-hidden
                >
                  {r.ticker.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[15px] font-bold tracking-wide text-ink">
                    {r.ticker}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-soft">{r.company}</p>
                </div>
                {r.quote && (
                  <span className="shrink-0 text-right">
                    <span
                      className={`block font-mono text-[13px] font-semibold tabular-nums ${priceTone(
                        r.quote.chg
                      )}`}
                    >
                      {fmtPct(r.quote.chg)}
                    </span>
                    <span className="block text-[10px] font-display font-bold uppercase tracking-[0.1em] text-soft">
                      today
                    </span>
                  </span>
                )}
              </div>

              {r.blurb && (
                <p className="mt-3 text-[13px] leading-relaxed text-soft">{r.blurb}</p>
              )}

              <div
                role="radiogroup"
                aria-label={`Your call on ${r.ticker}`}
                className="mt-3 grid grid-cols-3 gap-2"
              >
                {ORDER.map((s) => {
                  const on = mine === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setVotes((v) => ({ ...v, [r.ticker]: s }))}
                      className={`f0-chip f0-focus f0-press py-2 font-display text-[13px] transition-colors ${
                        on
                          ? "font-extrabold text-ink"
                          : "font-bold text-soft hover:text-ink"
                      }`}
                      style={
                        on
                          ? {
                              ...PILL,
                              boxShadow: "inset 0 0 0 1px var(--sentiment-fill)",
                              backgroundColor:
                                "color-mix(in srgb, var(--sentiment-fill) 14%, transparent)",
                            }
                          : PILL
                      }
                    >
                      {LABEL[s]}
                    </button>
                  );
                })}
              </div>

              {showSplit ? (
                <div className="mt-3">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-sand"
                    role="img"
                    aria-label={`${bullPct}% of ${r.votes} votes are bullish`}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${bullPct ?? 0}%`,
                        backgroundColor: "var(--sentiment-fill)",
                      }}
                    />
                  </div>
                  <p className="mt-1.5 font-mono text-[12px] font-semibold tabular-nums text-soft">
                    <span className="text-sentiment">{bullPct}% bullish</span> ·{" "}
                    {r.votes.toLocaleString()} votes cast
                  </p>
                </div>
              ) : (
                <p className="mt-3 font-mono text-[12px] font-semibold text-soft">
                  {r.votes === 0
                    ? "No votes on this one yet — yours is the first"
                    : `${r.votes} ${r.votes === 1 ? "vote" : "votes"} so far · the split shows at ${SOCIAL_FLOORS.debateStance}`}
                </p>
              )}
            </Panel>
          );
        })}
      </div>

      {contrarian ? (
        <KaiNote>
          you are {LABEL[contrarian.mine].toLowerCase()} on {contrarian.entry.ticker}{" "}
          while the room leans the other way. That is the take worth writing down —
          say why on the next screen and see who you move.
        </KaiNote>
      ) : (
        <KaiNote>
          vote every name you have a view on, and skip the ones you do not. A
          shrug you can defend beats a call you cannot.
        </KaiNote>
      )}

      <Note>
        Votes are opinions from members, not advice, and no vote is a
        recommendation to buy or sell anything.{" "}
        <Link href="/watchlist/community" className="font-bold text-gold-700">
          Open the full board
        </Link>
      </Note>

      {error && <ErrorLine>{error}</ErrorLine>}

      <MissionFooter>
        <MissionButton onClick={submit} disabled={!enough} busy={busy}>
          {enough
            ? "Cast my votes → write my take"
            : `Vote on ${need - cast} more`}
        </MissionButton>
      </MissionFooter>
    </div>
  );
}
