"use client";

/**
 * ChangedMyMind (SOCIAL OBJECTS S1 signature feature) — a member's stance on a
 * ticker (bull / bear / neutral) and the flip flow: pick a new stance, give a
 * reason from the taxonomy (+ optional note), and the change is recorded as a
 * public "changed their mind" moment. Renders recent flips and the aggregate
 * "N people changed their mind" signal (above the scale floor).
 *
 * Kid-walled: the FLOW is adults+teens only (enforced in the RPC too). Kids never
 * see the control — pass canFlip=false; they still read the moments if shown.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { checkClean } from "@/lib/profanity";
import { timeAgo } from "@/lib/feed";
import { SOCIAL_FLOORS } from "@/lib/social/reactions";
import {
  fetchStanceSummary,
  setStance,
  flipLine,
  STANCE_META,
  CHANGE_REASONS,
  type Stance,
  type ChangeReasonKey,
  type StanceSummary,
} from "@/lib/social/stance";

const STANCES: Stance[] = ["bull", "neutral", "bear"];

export default function ChangedMyMind({
  supabase,
  ticker,
  userId,
  canFlip = false,
}: {
  supabase: SupabaseClient;
  ticker: string;
  userId?: string | null;
  canFlip?: boolean;
}) {
  const [summary, setSummary] = useState<StanceSummary | null>(null);
  const [target, setTarget] = useState<Stance | null>(null); // stance being switched to
  const [reason, setReason] = useState<ChangeReasonKey | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchStanceSummary(supabase, ticker).then((s) => {
      if (live) setSummary(s);
    });
    return () => {
      live = false;
    };
  }, [supabase, ticker]);

  if (!summary) return null;
  const current = summary.my_stance;

  function pick(s: Stance) {
    setErr(null);
    if (s === current) return;
    // First-ever stance needs no reason; a genuine flip does.
    if (!current) {
      void commit(s, null);
    } else {
      setTarget(s);
      setReason(null);
      setNote("");
    }
  }

  async function commit(to: Stance, why: ChangeReasonKey | null) {
    if (busy || !userId) return;
    const trimmed = note.trim();
    if (trimmed) {
      const clean = checkClean(trimmed);
      if (!clean.ok) {
        setErr("Let's keep it friendly — please reword that.");
        return;
      }
    }
    setBusy(true);
    const res = await setStance(supabase, ticker, to, why, trimmed || null);
    setBusy(false);
    if (!res.ok) {
      setErr(
        res.reason === "reason_required"
          ? "Pick a reason for the change."
          : res.reason === "kid_walled"
          ? "This isn't available on your account."
          : "Couldn't save that — try again."
      );
      return;
    }
    setTarget(null);
    setReason(null);
    setNote("");
    fetchStanceSummary(supabase, ticker).then(setSummary);
  }

  const showFloorMet = summary.mind_changes >= SOCIAL_FLOORS.mindChanges;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-teal-600" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
          Your stance
        </h3>
      </div>

      {canFlip ? (
        <>
          <div className="inline-flex rounded-xl border border-sand p-0.5">
            {STANCES.map((s) => {
              const active = current === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => pick(s)}
                  disabled={busy}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
                    active ? `${STANCE_META[s].chip}` : "text-soft hover:text-ink"
                  }`}
                >
                  {STANCE_META[s].label}
                </button>
              );
            })}
          </div>

          {/* Flip flow: reason taxonomy + optional note */}
          {target && (
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/[0.06] p-3">
              <p className="mb-2 text-xs font-semibold text-ink">
                Changing to <span className="text-teal-700">{STANCE_META[target].label}</span> — why?
              </p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {CHANGE_REASONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setReason(r.key)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      reason === r.key
                        ? "bg-teal-500 text-white"
                        : "border border-sand text-soft hover:bg-paper"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <textarea
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  if (err) setErr(null);
                }}
                rows={2}
                placeholder="Add a note (optional)…"
                className="w-full resize-none rounded-lg border border-sand bg-card px-2.5 py-1.5 text-[13px] text-ink placeholder:text-soft focus:border-teal-400 focus:outline-none"
              />
              {err && <p className="mt-1 text-[11px] text-red-600">{err}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => commit(target, reason)}
                  disabled={busy || !reason}
                  className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
                >
                  Record the change
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTarget(null);
                    setErr(null);
                  }}
                  className="rounded-lg border border-sand px-3 py-1.5 text-xs font-semibold text-soft hover:bg-paper"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {err && !target && <p className="text-[11px] text-red-600">{err}</p>}
        </>
      ) : (
        current && (
          <p className="text-xs text-soft">
            You&apos;re marked <span className="font-semibold text-ink">{STANCE_META[current].label}</span> on {ticker.toUpperCase()}.
          </p>
        )
      )}

      {/* Aggregate mind-change signal + recent flip moments */}
      {showFloorMet && (
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500/[0.08] px-2.5 py-1.5 text-xs font-semibold text-teal-700">
          <RefreshCw className="h-3.5 w-3.5" />
          {summary.mind_changes.toLocaleString()} members changed their mind on {ticker.toUpperCase()}
        </p>
      )}

      {summary.recent.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-display text-[11px] font-bold uppercase tracking-wider text-soft">
            Recently changed their mind
          </h4>
          <div className="space-y-2">
            {summary.recent.map((f) => (
              <div key={f.id} className="flex items-start gap-2">
                <Avatar name={f.display_name} avatarUrl={f.avatar_url} role={f.role} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {f.username ? (
                      <Link href={`/u/${f.username}`} className="text-[12px] font-semibold text-ink hover:text-teal-700">
                        {f.display_name || "Member"}
                      </Link>
                    ) : (
                      <span className="text-[12px] font-semibold text-ink">{f.display_name || "Member"}</span>
                    )}
                    <AgeBadge role={f.role} ageGroup={f.age_group} />
                    <span className="text-[10px] text-soft">· {timeAgo(f.created_at)}</span>
                  </div>
                  <p className="text-[12px] font-semibold text-teal-700">{flipLine(f)}</p>
                  {f.note && <p className="text-[12px] leading-snug text-midnight-200">{f.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
