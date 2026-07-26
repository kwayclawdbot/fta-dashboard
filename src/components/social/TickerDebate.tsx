"use client";

/**
 * TickerDebate (SOCIAL OBJECTS S1 object #3) — a per-ticker structured debate:
 * three-way stance (BULL / BEAR / UNDECIDED), the top voted argument per side,
 * a one-reason capture after voting, and an expandable arguments board where
 * members write and upvote bull/bear cases.
 *
 * Kid-walled: the state RPC returns null for kids, so this renders nothing for
 * them. Counts follow the scale floor (a small tally reads as "early voices").
 * No XP.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale, ThumbsUp, Loader2, Send } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { checkClean } from "@/lib/profanity";
import { SOCIAL_FLOORS } from "@/lib/social/reactions";
import { CHANGE_REASONS, type ChangeReasonKey } from "@/lib/social/stance";
import {
  fetchTickerDebate,
  voteTickerDebate,
  fetchDebateArguments,
  addDebateArgument,
  voteDebateArgument,
  type TickerDebateState,
  type DebateArgument,
  type DebateStance,
  type ArgumentSide,
  type TopArgument,
} from "@/lib/social/ticker-debate";

const STANCE_UI: Record<DebateStance, { label: string; bar: string; text: string; btn: string }> = {
  bull: { label: "Bull", bar: "bg-green-500", text: "text-green-700", btn: "bg-green-500 hover:bg-green-600" },
  bear: { label: "Bear", bar: "bg-red-500", text: "text-red-600", btn: "bg-red-500 hover:bg-red-600" },
  undecided: { label: "Undecided", bar: "bg-soft", text: "text-soft", btn: "bg-midnight-400 hover:bg-midnight-500" },
};

export default function TickerDebate({
  supabase,
  ticker,
  userId,
  canParticipate = false,
}: {
  supabase: SupabaseClient;
  ticker: string;
  userId?: string | null;
  canParticipate?: boolean;
}) {
  const [state, setState] = useState<TickerDebateState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [askReason, setAskReason] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [args, setArgs] = useState<DebateArgument[] | null>(null);

  useEffect(() => {
    let live = true;
    fetchTickerDebate(supabase, ticker).then((s) => {
      if (live) {
        setState(s);
        setLoaded(true);
      }
    });
    return () => {
      live = false;
    };
  }, [supabase, ticker]);

  if (!loaded || !state) return null; // kid-walled / no debate for this ticker

  const total = state.total;
  const floorMet = total >= SOCIAL_FLOORS.debateStance;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  async function vote(choice: DebateStance) {
    if (!canParticipate || pending || !state) return;
    setPending(true);
    const res = await voteTickerDebate(supabase, state.id, choice);
    setPending(false);
    if (res.ok && res.state) {
      setState(res.state);
      setAskReason(true); // one-reason capture after voting
    }
  }

  async function submitReason(reason: ChangeReasonKey) {
    if (pending || !state?.userVote) return;
    setPending(true);
    const res = await voteTickerDebate(supabase, state.id, state.userVote, reason);
    setPending(false);
    if (res.ok && res.state) setState(res.state);
    setAskReason(false);
  }

  async function loadArgs() {
    if (!state) return;
    setExpanded(true);
    if (args) return;
    const a = await fetchDebateArguments(supabase, state.id);
    setArgs(a);
  }

  async function onUpvote(id: string) {
    const res = await voteDebateArgument(supabase, id);
    if (res.ok) {
      setArgs((prev) =>
        (prev ?? []).map((a) => (a.id === id ? { ...a, voted: !!res.voted, votes: res.votes ?? a.votes } : a))
      );
    }
  }

  return (
    <section className="rounded-2xl border border-sand bg-card p-5">
      <div className="mb-2 flex items-center gap-2">
        <Scale className="h-4 w-4 text-volt-600" />
        <span className="font-display text-xs font-bold uppercase tracking-wider text-volt-700">
          The debate · {state.ticker}
        </span>
      </div>
      <h3 className="font-display text-lg font-extrabold leading-snug tracking-tight text-ink">
        {state.question}
      </h3>
      <p className="mt-1 text-[13px] text-soft">
        {floorMet
          ? `${total.toLocaleString()} members weighed in`
          : "Be an early voice — the first stances set the tone."}
      </p>

      {/* three-way split bars */}
      <div className="mt-4 space-y-2">
        {(["bull", "bear", "undecided"] as DebateStance[]).map((k) => {
          const n = k === "bull" ? state.bull : k === "bear" ? state.bear : state.undecided;
          const ui = STANCE_UI[k];
          return (
            <div key={k} className="flex items-center gap-2">
              <span className={`w-20 shrink-0 text-xs font-bold ${ui.text}`}>{ui.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand">
                <div
                  className={`h-full rounded-full ${ui.bar} transition-all`}
                  style={{ width: `${floorMet ? pct(n) : n > 0 ? 8 : 0}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-soft">
                {floorMet ? `${pct(n)}%` : n > 0 ? "·" : ""}
              </span>
            </div>
          );
        })}
      </div>

      {/* vote / one-reason capture */}
      {canParticipate ? (
        state.userVote ? (
          askReason ? (
            <div className="mt-4 rounded-xl border border-volt-400/30 bg-volt-500/[0.06] p-3">
              <p className="mb-2 text-xs font-semibold text-ink">
                You&apos;re {STANCE_UI[state.userVote].label}. What&apos;s the main reason? (optional)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CHANGE_REASONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => submitReason(r.key)}
                    disabled={pending}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      state.userReason === r.key
                        ? "bg-volt-500 text-white"
                        : "border border-sand text-soft hover:bg-paper"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAskReason(false)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-soft hover:bg-paper"
                >
                  Skip
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm font-semibold text-volt-700">
              Your stance: {STANCE_UI[state.userVote].label}
              {state.userReason && (
                <span className="font-normal text-soft">
                  {" "}· {CHANGE_REASONS.find((r) => r.key === state.userReason)?.label}
                </span>
              )}
              {"  "}
              <button onClick={() => setAskReason(true)} className="ml-1 text-xs font-semibold text-soft underline hover:text-ink">
                change
              </button>
            </p>
          )
        ) : (
          <div className="mt-4 flex gap-2">
            {(["bull", "undecided", "bear"] as DebateStance[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => vote(k)}
                disabled={pending}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60 ${STANCE_UI[k].btn}`}
              >
                {STANCE_UI[k].label}
              </button>
            ))}
          </div>
        )
      ) : (
        <p className="mt-4 text-[11px] text-soft">Join the Club to weigh in on the debate.</p>
      )}

      {/* top argument per side */}
      {(state.topBull || state.topBear) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <TopArgCard label="Top bull case" arg={state.topBull} tone="green" />
          <TopArgCard label="Top bear case" arg={state.topBear} tone="red" />
        </div>
      )}

      {/* arguments board */}
      {!expanded ? (
        <button
          onClick={loadArgs}
          className="mt-4 text-xs font-semibold text-volt-700 hover:underline"
        >
          See all arguments & add yours →
        </button>
      ) : (
        <ArgumentsBoard
          supabase={supabase}
          debateId={state.id}
          args={args}
          userId={userId}
          canParticipate={canParticipate}
          onUpvote={onUpvote}
          onAdded={(a) => setArgs((prev) => [...(prev ?? []), a])}
        />
      )}
    </section>
  );
}

function TopArgCard({
  label,
  arg,
  tone,
}: {
  label: string;
  arg: TopArgument | null;
  tone: "green" | "red";
}) {
  const ring = tone === "green" ? "border-green-500/30" : "border-red-500/25";
  const text = tone === "green" ? "text-green-700" : "text-red-600";
  return (
    <div className={`rounded-xl border ${ring} bg-paper p-3`}>
      <p className={`mb-1.5 font-display text-[11px] font-bold uppercase tracking-wider ${text}`}>{label}</p>
      {arg ? (
        <>
          <p className="text-[13px] leading-snug text-midnight-200">{arg.body}</p>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-soft">
            <Avatar name={arg.display_name} avatarUrl={arg.avatar_url} role={arg.role} size="xs" />
            <span className="font-semibold text-ink">{arg.display_name || "Member"}</span>
            <span className="ml-auto inline-flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" /> {arg.votes}
            </span>
          </div>
        </>
      ) : (
        <p className="text-xs text-soft">No case made yet — write the first one below.</p>
      )}
    </div>
  );
}

function ArgumentsBoard({
  supabase,
  debateId,
  args,
  userId,
  canParticipate,
  onUpvote,
  onAdded,
}: {
  supabase: SupabaseClient;
  debateId: string;
  args: DebateArgument[] | null;
  userId?: string | null;
  canParticipate: boolean;
  onUpvote: (id: string) => void;
  onAdded: (a: DebateArgument) => void;
}) {
  const [side, setSide] = useState<ArgumentSide>("bull");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (args === null) {
    return (
      <div className="mt-4 flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-volt-500" />
      </div>
    );
  }

  async function submit() {
    const body = draft.trim();
    if (!body || sending || !userId) return;
    const clean = checkClean(body);
    if (!clean.ok) {
      setErr("Let's keep it friendly — please reword that.");
      return;
    }
    setSending(true);
    setErr(null);
    const res = await addDebateArgument(supabase, debateId, side, body);
    if (res.ok && res.id) {
      // Reflect immediately (author identity resolved on next full load; use a
      // light optimistic row).
      const { data } = await supabase.auth.getUser();
      onAdded({
        id: res.id,
        side,
        body,
        created_at: new Date().toISOString(),
        user_id: data.user?.id ?? "",
        votes: 0,
        voted: false,
        author: {
          id: data.user?.id ?? "",
          display_name: "You",
          username: null,
          avatar_url: null,
          role: null,
          age_group: null,
        },
      });
      setDraft("");
    } else {
      setErr("Couldn't post that — try again.");
    }
    setSending(false);
  }

  const bySide = (s: ArgumentSide) =>
    args.filter((a) => a.side === s).sort((x, y) => y.votes - x.votes);

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {(["bull", "bear"] as ArgumentSide[]).map((s) => (
          <div key={s}>
            <p
              className={`mb-2 font-display text-[11px] font-bold uppercase tracking-wider ${
                s === "bull" ? "text-green-700" : "text-red-600"
              }`}
            >
              {s === "bull" ? "Bull case" : "Bear case"}
            </p>
            <div className="space-y-2">
              {bySide(s).map((a) => (
                <div key={a.id} className="rounded-lg border border-sand bg-paper px-2.5 py-2">
                  <p className="text-[13px] leading-snug text-midnight-200">{a.body}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-soft">
                    {a.author?.username ? (
                      <Link href={`/u/${a.author.username}`} className="font-semibold text-ink hover:text-volt-700">
                        {a.author.display_name || "Member"}
                      </Link>
                    ) : (
                      <span className="font-semibold text-ink">{a.author?.display_name || "Member"}</span>
                    )}
                    <AgeBadge role={a.author?.role} ageGroup={a.author?.age_group} />
                    <button
                      onClick={() => onUpvote(a.id)}
                      disabled={!canParticipate}
                      aria-pressed={a.voted}
                      className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold transition-colors ${
                        a.voted ? "bg-volt-500/15 text-volt-700" : "text-soft hover:bg-sand/60"
                      } disabled:cursor-default`}
                    >
                      <ThumbsUp className="h-3 w-3" /> {a.votes}
                    </button>
                  </div>
                </div>
              ))}
              {bySide(s).length === 0 && (
                <p className="rounded-lg border border-dashed border-sand px-2.5 py-3 text-center text-[11px] text-soft">
                  No {s} case yet.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {canParticipate && (
        <div className="rounded-xl border border-sand bg-paper p-2.5">
          <div className="mb-1.5 inline-flex rounded-lg border border-sand p-0.5">
            {(["bull", "bear"] as ArgumentSide[]).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold capitalize transition-colors ${
                  side === s
                    ? s === "bull"
                      ? "bg-green-500 text-white"
                      : "bg-red-500 text-white"
                    : "text-soft"
                }`}
              >
                {s} case
              </button>
            ))}
          </div>
          {err && <p className="mb-1 text-[11px] text-red-600">{err}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={1}
              placeholder={`Make the ${side} case…`}
              className="max-h-24 flex-1 resize-none rounded-lg border border-sand bg-card px-2.5 py-1.5 text-[13px] text-ink placeholder:text-soft focus:border-volt-400 focus:outline-none"
            />
            <button
              onClick={submit}
              disabled={sending || !draft.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-volt-500 text-white transition-colors hover:bg-volt-600 disabled:opacity-50"
              aria-label="Post argument"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
