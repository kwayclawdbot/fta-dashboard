"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { ChallengeState } from "@/lib/challenge/types";
import { fmtDay } from "./data";
import { Dial, MissionHead, Note, Panel, ScriptLine } from "./parts";

/**
 * DAY 3 · THE SOFT PITCH — "keep going together".
 *
 * It lands after the Day-3 artifact is posted, on the back of a real win, and it
 * is the only commercial object in the whole five-day flow.
 *
 * ── THE OFFER, AS IT ACTUALLY IS ──────────────────────────────────────────
 * The canvas draws "CHALLENGE RATE · 70% OFF" and "$1,500  ~~$4,997~~". BOTH ARE
 * FALSE and neither is rendered here. There is no $4,997 list price for this
 * product, so a struck-through one is a fabricated anchor — the exact species of
 * claim that turns a fair offer into a deceptive one. The real terms, matching
 * the close-offer emails word for word (challenge-sequence-emails.ts):
 *
 *   Club .... $99/mo, cancel anytime.
 *   FTA ..... $1,500 once — Family Trading Academy for life, plus a full year
 *             of the Club included. The Club renews at $99/mo after that year.
 *
 * Every date on this board is formatted from the cohort's own `access_ends_at`,
 * never from the canvas's "Sept 6".
 *
 * ── THE NUMBERS ──────────────────────────────────────────────────────────
 * The canvas puts "+2.6% Sim P/L" in the proof strip. A member's practice return
 * is their own record and must never be framed as evidence the product works —
 * so the strip carries days, streak and XP, which are counts of things they did.
 */
export default function Day3Offer({
  state,
  clubUrl,
  ftaUrl,
  watchlistCount,
  onDismiss,
}: {
  state: ChallengeState;
  clubUrl: string;
  ftaUrl: string;
  /** Names on the member's own practice watchlist. Null = we could not read it. */
  watchlistCount: number | null;
  onDismiss: () => void;
}) {
  const doneCount = state.days.filter((d) => d.share_done).length;
  const total = state.days.length;

  /* "30 days ago you hadn't started" is a real span or it is not drawn. */
  const joined = state.member?.joined_at ? new Date(state.member.joined_at) : null;
  const daysIn = joined
    ? Math.max(0, Math.round((new Date(state.now).getTime() - joined.getTime()) / 86_400_000))
    : null;

  return (
    <div className="f0-stagger space-y-7">
      <div className="flex items-center justify-between gap-4">
        <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-soft">
          After tonight&rsquo;s session
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="f0-focus font-display text-[13px] font-bold text-soft transition-colors hover:text-ink"
        >
          Not now →
        </button>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Dial pct={(doneCount / total) * 100} value={`${doneCount}/${total}`} unit="days done" />
        <ScriptLine>look what you built</ScriptLine>
        {daysIn != null && daysIn >= 7 ? (
          <MissionHead>
            {daysIn} days ago you <span className="text-gold-700">hadn&rsquo;t started</span>
          </MissionHead>
        ) : (
          <MissionHead>
            Three days in and you&rsquo;ve <span className="text-gold-700">already built it</span>
          </MissionHead>
        )}
      </div>

      {/* the proof strip — counts of things done, never a return */}
      <div className="grid grid-cols-3 gap-3">
        <ProofTile
          value={state.streak > 0 ? `${state.streak}` : "—"}
          label="Day streak"
        />
        <ProofTile
          value={watchlistCount != null ? `${watchlistCount}` : "—"}
          label="On your watchlist"
        />
        <ProofTile value={state.xp.toLocaleString()} label="XP" />
      </div>

      {/* ── the Club ───────────────────────────────────────────────────── */}
      <Panel label="Cheat Code Club">
        <p className="font-display text-display-2 font-extrabold text-ink">
          $99
          <span className="ml-1 font-display text-[15px] font-bold text-soft">
            /month · cancel anytime
          </span>
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-soft">
          Keep everything you used this week — the community, Kai, the live rooms,
          the simulator and the lessons. Your XP, your belts and your streak carry
          straight over.
        </p>
        <a
          href={clubUrl}
          className="f0-focus f0-press mt-4 flex w-full items-center justify-center rounded-full border border-sand px-6 py-3 font-display text-[15px] font-bold text-ink"
        >
          Continue the Club
        </a>
      </Panel>

      {/* ── the FTA challenge offer ────────────────────────────────────── */}
      <div className="f0-brief-field px-5 py-5 ring-1 ring-[color:var(--accent-solid)]">
        <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-gold-700">
          The FTA Challenge Offer
        </p>
        <p className="mt-2 font-display text-display-1 font-extrabold text-ink">
          $1,500
          <span className="ml-2 font-display text-[15px] font-bold text-soft">once</span>
        </p>

        <ul className="mt-4 space-y-2.5">
          <OfferLine>Family Trading Academy for life — the full live program</OfferLine>
          <OfferLine>A full year of the Cheat Code Club included</OfferLine>
          <OfferLine>Your XP, belts and streak carry over</OfferLine>
        </ul>

        <a
          href={ftaUrl}
          className="cta-button f0-focus f0-press mt-5 flex w-full items-center justify-center rounded-full px-6 py-3.5 text-[15px]"
        >
          See the FTA offer
        </a>

        <p className="mt-3 text-center font-mono text-[12px] leading-relaxed text-soft">
          One payment of $1,500. The Club renews at $99/mo after the included
          year.
        </p>
      </div>

      <Note>
        The offer closes when your challenge access does —{" "}
        {fmtDay(state.cohort.access_ends_at, state.cohort.tz)}. Nothing is on a
        card until you choose, and everything you built this week stays yours
        either way.
      </Note>

      <div className="flex justify-center">
        <Link
          href="/challenge/hq"
          onClick={onDismiss}
          className="f0-focus font-display text-[14px] font-bold text-soft transition-colors hover:text-ink"
        >
          No thanks — back to HQ
        </Link>
      </div>
    </div>
  );
}

function ProofTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="grid place-items-center gap-1 rounded-2xl border border-sand bg-card px-2 py-3.5">
      <p className="font-display text-[19px] font-extrabold tabular-nums text-ink">
        {value}
      </p>
      <p className="text-center text-[10px] font-display font-bold uppercase tracking-[0.12em] text-soft">
        {label}
      </p>
    </div>
  );
}

function OfferLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-relaxed text-ink">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
