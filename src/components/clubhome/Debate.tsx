"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import { SectionLabel, clubFeedback } from "./parts";
import { postDebateVote } from "@/lib/clubhome/client";
import type { DebateResponse } from "@/lib/clubhome/contract";

/**
 * §8 The Debate — one live question with a YES/NO split BAR (a horizontal
 * segmented bar, not a donut — it fits the editorial language better). Yes =
 * teal (Club sentiment), No = neutral slate (volt stays reserved for action).
 * Vote counts are scale-aware; below floor it's an "early voice" moment. After
 * voting: "Your view was added to Club Sentiment." Kid-walled upstream.
 */

export default function Debate({ debate }: { debate: DebateResponse | null }) {
  const [counts, setCounts] = useState(debate?.counts ?? { yes: 0, no: 0 });
  const [userVote, setUserVote] = useState<"yes" | "no" | null>(debate?.userVote ?? null);
  const [pending, setPending] = useState(false);

  if (!debate) return null;

  const total = counts.yes + counts.no;
  const yesPct = total > 0 ? Math.round((counts.yes / total) * 100) : 50;
  const noPct = 100 - yesPct;
  const floorMet = debate.floorMet;

  async function vote(choice: "yes" | "no") {
    if (userVote || pending) return;
    setPending(true);
    // optimistic
    setUserVote(choice);
    setCounts((c) => ({ ...c, [choice]: c[choice] + 1 }));
    clubFeedback.voted();
    const server = await postDebateVote(debate!.id, choice);
    if (server) setCounts(server);
    setPending(false);
  }

  return (
    <section aria-label="The Debate" className="rounded-2xl border border-sand bg-card p-5 shadow-soft sm:p-6">
      <SectionLabel tone="teal" live liveTone="teal">
        The Debate
      </SectionLabel>

      <h3 className="mt-3 font-display text-xl font-extrabold leading-snug tracking-tight text-ink">
        {debate.question}
      </h3>
      <p className="mt-1 text-[13px] text-soft">
        {floorMet
          ? `${total.toLocaleString()} votes so far`
          : "Be an early voice — the first votes set the tone."}
      </p>

      {/* split bar */}
      <div className="mt-4">
        <div className="flex h-11 w-full overflow-hidden rounded-xl">
          <div
            className="flex items-center justify-start bg-teal-500 pl-3 text-sm font-bold text-white transition-all duration-500"
            style={{ width: `${yesPct}%` }}
          >
            {yesPct >= 18 && `Yes ${yesPct}%`}
          </div>
          <div
            className="flex items-center justify-end bg-midnight-300 pr-3 text-sm font-bold text-card transition-all duration-500"
            style={{ width: `${noPct}%` }}
          >
            {noPct >= 18 && `No ${noPct}%`}
          </div>
        </div>
        {floorMet && (
          <div className="mt-1.5 flex justify-between font-mono text-[11px] tabular-nums text-soft">
            <span>{counts.yes.toLocaleString()} yes</span>
            <span>{counts.no.toLocaleString()} no</span>
          </div>
        )}
      </div>

      {/* vote / result */}
      {userVote ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-teal-700">
            Your view was added to Club Sentiment.
          </p>
          {debate.participants.length > 0 && (
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
          )}
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
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
            className="flex-1 rounded-xl border border-sand bg-card py-2.5 text-sm font-bold text-ink transition-transform hover:border-midnight-300 active:scale-[0.98] disabled:opacity-60"
          >
            Vote No
          </button>
        </div>
      )}
    </section>
  );
}
