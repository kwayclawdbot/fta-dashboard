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
 *
 * ── CANVAS V2 (lane L2) ──────────────────────────────────────────────────────
 * This is the TICKER-SCOPED instance of the idea, and now the ONLY one. The
 * club-wide CHANGED MY MIND destination is retired (owner directive,
 * 2026-08-01) along with the rest of the feed surfaces, so the hand-off link
 * that used to close this block is gone: the flips on THIS name are the whole
 * of it, read where the name is researched.
 *
 * Three colour-law repairs landed here with the STANCE_META migration:
 *   · the stance picker was `STANCE_META[s].chip` — green/red, the PRICE ramp,
 *     on the control where a member declares an OPINION. It is now the shared
 *     StanceControl (lime, direction carried by label + position).
 *   · the reason chips were a solid teal fill; they are now the system's
 *     f0-chip / f0-chip-on, so this flow stops inventing its own selected state.
 *   · the error line was `text-red-600`. Red is price. A validation message that
 *     shares a colour with a down move is a colour-law violation and a bad
 *     message — it now carries weight instead of hue, matching the feed composer.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import Avatar from "@/components/Avatar";
import AgeBadge from "@/components/community/AgeBadge";
import { StanceControl } from "@/components/canvas2";
import { checkClean } from "@/lib/profanity";
import { XP, awardXp, hasXpForRef } from "@/lib/xp";
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
  // The summary is STAMPED with the ticker it answers, so "loading" is DERIVED
  // rather than set inside the effect — which also means a stance from the
  // previous ticker can never render for a beat under the new one.
  const [answer, setAnswer] = useState<{ ticker: string; summary: StanceSummary } | null>(null);
  const [target, setTarget] = useState<Stance | null>(null); // stance being switched to
  const [reason, setReason] = useState<ChangeReasonKey | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** XP just awarded for a first position on this ticker — shown, not banked. */
  const [earned, setEarned] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetchStanceSummary(supabase, ticker).then((s) => {
      if (live) setAnswer({ ticker, summary: s });
    });
    return () => {
      live = false;
    };
  }, [supabase, ticker]);

  const summary = answer?.ticker === ticker ? answer.summary : null;

  // LOADING IS NOT EMPTY (plan §0.4): while the read is in flight the control
  // renders its own skeleton instead of a selector claiming no stance is held.
  if (!summary) {
    return (
      <div className="space-y-3" aria-busy="true">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-ink">
          Your stance
        </h3>
        {earned != null && (
          <span
            className="club-b-chip ml-auto px-2 py-1 font-mono text-[10.5px] font-bold tabular-nums text-accent"
            role="status"
          >
            +{earned} XP
          </span>
        )}
        <StanceControl value={null} onChange={() => {}} loading />
      </div>
    );
  }
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
    fetchStanceSummary(supabase, ticker).then((s) => setAnswer({ ticker, summary: s }));

    /* TAKING A POSITION PAYS, AND SAYS SO. Declaring a stance was the one
       real contribution in the product that earned nothing: `set_ticker_stance`
       (migration 151) writes the stance and no xp_events row, so a new member's
       first act of judgement was silently worth zero — which is exactly the act
       the first-run flow now sends them to. It pays COMMUNITY XP once per
       ticker, ever (`hasXpForRef` on `stance:<TICKER>`), so a member cannot
       farm it by flipping back and forth, and the award is shown rather than
       banked invisibly. */
    if (userId) {
      const ref = `stance:${ticker.toUpperCase()}`;
      const already = await hasXpForRef(supabase, userId, "community", ref);
      if (!already) {
        await awardXp(supabase, userId, "community", XP.COMMUNITY, ref);
        setEarned(XP.COMMUNITY);
      }
    }
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
          {/* The shared lime-keyed control. The club's own split rides along and
              StanceControl withholds it below SOCIAL_FLOORS.debateStance, so a
              9-ticker club never publishes "1 · 0 · 1" as a sentiment read. */}
          <StanceControl
            value={target ?? current}
            onChange={pick}
            counts={{ bull: summary.bull, bear: summary.bear, neutral: summary.neutral }}
            disabled={busy}
            ariaLabel={`Your stance on ${ticker.toUpperCase()}`}
            emptyHint="Pick a stance. You can change it later — the Club rewards the update."
          />

          {/* Flip flow: reason taxonomy + optional note */}
          {target && (
            <div className="f0-rule-top pt-3">
              <p className="mb-2 text-xs font-semibold text-ink">
                Changing to{" "}
                <span className="text-sentiment">{STANCE_META[target].label}</span> — why?
              </p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {CHANGE_REASONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={reason === r.key}
                    onClick={() => setReason(r.key)}
                    className={`f0-chip f0-press f0-focus font-display text-[11px] font-bold uppercase tracking-[0.1em] ${
                      reason === r.key ? "f0-chip-on" : "text-soft"
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
                placeholder="What changed it? (optional)"
                className="f0-focus w-full resize-none border-b border-sand bg-transparent pb-1.5 text-[13px] text-ink placeholder:text-soft focus:outline-none"
              />
              {err && <p className="mt-1 text-[11px] font-semibold text-ink">{err}</p>}
              <div className="mt-2.5 flex gap-4">
                <button
                  type="button"
                  onClick={() => commit(target, reason)}
                  disabled={busy || !reason}
                  className="f0-focus font-display text-[13px] font-bold text-gold-700 transition-colors hover:text-gold-600 disabled:opacity-40"
                >
                  Record the change
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTarget(null);
                    setErr(null);
                  }}
                  className="f0-focus font-display text-[13px] font-semibold text-soft transition-colors hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {err && !target && <p className="text-[11px] font-semibold text-ink">{err}</p>}
        </>
      ) : (
        current && (
          <p className="text-xs text-soft">
            You&apos;re marked{" "}
            <span className="font-semibold text-ink">{STANCE_META[current].label}</span> on{" "}
            {ticker.toUpperCase()}.
          </p>
        )
      )}

      {/* Aggregate mind-change signal + recent flip moments */}
      {showFloorMet && (
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-sentiment-soft px-2.5 py-1.5 text-xs font-semibold text-sentiment">
          <RefreshCw className="h-3.5 w-3.5" />
          {summary.mind_changes.toLocaleString()} members changed their mind on{" "}
          {ticker.toUpperCase()}
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
                      <Link
                        href={`/u/${f.username}`}
                        className="text-[12px] font-semibold text-ink hover:text-gold-700"
                      >
                        {f.display_name || "Member"}
                      </Link>
                    ) : (
                      <span className="text-[12px] font-semibold text-ink">
                        {f.display_name || "Member"}
                      </span>
                    )}
                    <AgeBadge role={f.role} ageGroup={f.age_group} />
                    <span className="text-[10px] text-soft">· {timeAgo(f.created_at)}</span>
                  </div>
                  <p className="text-[12px] font-semibold text-sentiment">{flipLine(f)}</p>
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
