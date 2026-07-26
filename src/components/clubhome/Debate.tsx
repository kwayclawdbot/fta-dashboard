"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import { Card, CardHead, Badge, Donut, clubFeedback } from "./parts";
import { postDebateVote } from "@/lib/clubhome/client";
import type { DebateResponse } from "@/lib/clubhome/contract";

/**
 * §8 The Debate — one live question with the mock's DONUT split (Yes = teal Club
 * sentiment, No = volt), flanked by the two legends. Vote counts are scale-aware;
 * below floor it's an "early voice" moment. The primary CTA opens the Yes/No
 * vote; after voting: "Your view was added to Club Sentiment." Kid-walled upstream.
 */

export default function Debate({ debate }: { debate: DebateResponse | null }) {
  const [counts, setCounts] = useState(debate?.counts ?? { yes: 0, no: 0 });
  const [userVote, setUserVote] = useState<"yes" | "no" | null>(debate?.userVote ?? null);
  const [voting, setVoting] = useState(false);
  const [pending, setPending] = useState(false);

  if (!debate) return null;

  const total = counts.yes + counts.no;
  const yesPct = total > 0 ? Math.round((counts.yes / total) * 100) : 50;
  const noPct = 100 - yesPct;
  const floorMet = debate.floorMet;

  async function vote(choice: "yes" | "no") {
    if (userVote || pending) return;
    setPending(true);
    setUserVote(choice);
    setCounts((c) => ({ ...c, [choice]: c[choice] + 1 }));
    clubFeedback.voted();
    const server = await postDebateVote(debate!.id, choice);
    if (server) setCounts(server);
    setPending(false);
  }

  return (
    <Card aria-label="The Debate">
      <CardHead title="The Debate" badge={<Badge tone="poll" dot>Live Poll</Badge>} />

      <h4 className="mt-3 font-display text-lg font-extrabold leading-snug tracking-tight text-ink">
        {debate.question}
      </h4>
      <p className="mt-1 text-[13px] text-soft">
        {floorMet ? `${total.toLocaleString()} votes` : "Be an early voice — the first votes set the tone."}
      </p>

      {/* donut + flanking legends */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <div className="min-w-0 text-right">
          <div className="inline-flex items-center gap-1.5 font-display text-2xl font-extrabold text-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-400" aria-hidden />
            {yesPct}%
          </div>
          <p className="text-[12px] font-semibold text-teal-700">Yes</p>
          {floorMet && (
            <p className="font-mono text-[11px] tabular-nums text-soft">{counts.yes.toLocaleString()} votes</p>
          )}
        </div>

        <div className="relative shrink-0">
          <Donut yesPct={yesPct} size={116} stroke={17} />
        </div>

        <div className="min-w-0 text-left">
          <div className="inline-flex items-center gap-1.5 font-display text-2xl font-extrabold text-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-volt-500" aria-hidden />
            {noPct}%
          </div>
          <p className="text-[12px] font-semibold text-volt-700">No</p>
          {floorMet && (
            <p className="font-mono text-[11px] tabular-nums text-soft">{counts.no.toLocaleString()} votes</p>
          )}
        </div>
      </div>

      {/* footer: participants + action */}
      {userVote ? (
        <p className="mt-5 text-center text-sm font-semibold text-teal-700">
          Your view was added to Club Sentiment.
        </p>
      ) : voting ? (
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => vote("yes")}
            disabled={pending}
            className="flex-1 rounded-xl bg-teal-500 py-2.5 text-sm font-bold text-white transition-transform hover:bg-teal-600 active:scale-[0.98] disabled:opacity-60"
          >
            Vote Yes
          </button>
          <button
            onClick={() => vote("no")}
            disabled={pending}
            className="flex-1 rounded-xl bg-volt-500 py-2.5 text-sm font-bold text-white transition-transform hover:bg-volt-600 active:scale-[0.98] disabled:opacity-60"
          >
            Vote No
          </button>
        </div>
      ) : (
        <div className="mt-5 flex items-center justify-between gap-3">
          {debate.participants.length > 0 ? (
            <div className="flex items-center">
              <div className="flex -space-x-2">
                {debate.participants.slice(0, 4).map((p) => (
                  <Avatar key={p.id} name={p.name || "Member"} size="sm" className="ring-2 ring-card" />
                ))}
              </div>
              {floorMet && (
                <span className="ml-2 font-mono text-xs font-semibold text-soft">
                  +{Math.max(total - 4, 0).toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <span />
          )}
          <button
            onClick={() => setVoting(true)}
            className="rounded-xl border border-sand bg-card px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:border-volt-400 hover:text-volt-700 active:scale-[0.98]"
          >
            Join the debate
          </button>
        </div>
      )}
    </Card>
  );
}
