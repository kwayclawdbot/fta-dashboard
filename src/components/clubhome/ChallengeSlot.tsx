"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useServerNow } from "@/lib/challenge/clock";
import { fetchChallengeState, activeDay, PHASE_LABEL } from "@/lib/challenge/state";
import type { ChallengeState } from "@/lib/challenge/types";

/**
 * §12 Challenge module slot — a reserved high-priority slot near the top of
 * ClubHome, rendered ONLY while a 5-Day Challenge pass is active. A designed
 * "pass" object, not a generic card: a ticket stub carrying DAY N OF 5 in big
 * display numerals, five progress pips, and a continue CTA into the challenge.
 * Self-gates on the pass window.
 *
 * CANVAS V2 (M1): the bordered gradient box is gone — the object now sits on the
 * shared brand-tinted field (.f0-brief-field) that Home's digest and the family
 * briefing use, so a "there is something running" object looks the same wherever
 * it appears. The ticket stub keeps the dual-brand gradient, which is what gives
 * it identity without a container. Orange TEXT moves from the frozen volt ramp
 * to gold-700, which is the same orange in club mode AND lifts in dark.
 *
 * ── THE DAY NUMBER WAS WRONG (cohesion lane, after M7 landed) ────────────────
 * This counted BACKWARDS from the pass expiry:
 *
 *     daysLeft = ceil((expiresAt - now) / 1 day)
 *     day      = 5 - daysLeft + 1
 *
 * which silently assumed the pass ends when the challenge ends. It does not.
 * The pass expires 2026-09-09T04:00:00Z — the 48-hour decision window after the
 * final session — while the sessions run Wed Sep 2 → Sun Sep 6, 7:00 PM ET.
 * Worked through, the slot rendered "day 1" on Sep 4, "day 3" on Sep 6 (the
 * FINAL day), and only reached "day 5" on Sep 8, after the challenge was over.
 * The clamp made Sep 2 read "day 1" by luck, which is precisely why it survived.
 * The progress pips were driven by the same number, so they were wrong too — and
 * they described "days elapsed", which is not progress at all.
 *
 * THE FIX: the day is now the SERVER's, from migration 199's `challenge_state()`.
 * Postgres derives each day's `state` (locked / open / live / complete / missed)
 * from its own clock; `activeDay()` picks the one to lead with. Nothing here
 * recomputes day state — that is the contract the challenge lane documented, and
 * a device whose clock is a day fast must never see a different day than the
 * server does. The pips now count REAL completions rather than elapsed time.
 *
 * WHY THE READ IS HERE AND NOT IN HOME'S SERVER PAYLOAD: `challenge_state()`
 * returns the whole journey (days, beats, answers, cohort counts). Home resolves
 * through three entry points — `resolveHomeRoute`'s paint-critical parallel
 * batch, the client `DashboardHomeClient` fallback for the family/kid personas,
 * and the fixtures harness — so seeding it would mean adding a heavy RPC to the
 * critical path of EVERY solo Home render to serve a slot that is null for
 * nearly every member. Reading it here fires it only for members who actually
 * hold a pass, and only after paint.
 *
 * LOADING IS NOT EMPTY, AND IT IS NOT A GUESS (plan §0.4). While the read is in
 * flight the slot renders in its UNDATED form — the same object, with an em dash
 * where the numeral goes and no progress bar. An undated slot is honest; a
 * fabricated day is not. The same form covers pre-season, cohort-forming and the
 * finisher week, where there IS no "day N of 5" and the old code invented one.
 *
 * PURITY: nothing here reads a clock during render. The only clock is
 * `useServerNow`, the challenge lane's server-seeded external store — primed in
 * an effect from `state.now` (the server's own timestamp), snapshotting a stable
 * second bucket, and null on the server and the first client render. It is used
 * for ONE thing: retiring the slot if the pass lapses while a tab is left open.
 * Until it primes, the authority is the server-resolved prop, which was already
 * filtered on `expires_at > now()` when the page was built.
 */

const CHALLENGE_DAYS = 5;

export default function ChallengeSlot({
  challengeExpiresAt,
}: {
  challengeExpiresAt: string | null;
}) {
  // `undefined` = the read has not resolved. `null` = it resolved with no active
  // journey (no cohort, or not a member) — a real answer, not a pending one.
  const [state, setState] = useState<ChallengeState | null | undefined>(undefined);

  useEffect(() => {
    if (!challengeExpiresAt) return;
    let live = true;
    void fetchChallengeState(createClient())
      .then((s) => {
        if (live) setState(s);
      })
      .catch(() => {
        if (live) setState(null);
      });
    return () => {
      live = false;
    };
  }, [challengeExpiresAt]);

  // Server-seeded and ticking; null until `state.now` primes it. Called
  // unconditionally — the early returns are all below it.
  const now = useServerNow(state?.now);

  if (!challengeExpiresAt) return null;

  // Long-lived tab: retire the slot once the pass lapses ON THE SERVER'S clock.
  // Before priming we defer to the server-resolved prop rather than guessing.
  const expiresAt = new Date(challengeExpiresAt).getTime();
  if (now != null && Number.isFinite(expiresAt) && now >= expiresAt) return null;

  // A numbered day exists ONLY during the live week. Everything else — the
  // pre-season, the forming week, the finisher week, and the moment before the
  // read lands — renders undated rather than inventing a number.
  const day = state && state.phase === "live" ? activeDay(state.days) : null;
  const completed = state ? state.days.filter((d) => d.state === "complete").length : 0;

  const label = day
    ? `5-Day Challenge — day ${day.day_no} of ${CHALLENGE_DAYS}, continue`
    : "5-Day Challenge — continue";

  return (
    <Link
      // The challenge HQ is the real destination now (migration 199). This
      // pointed at /community, which was the closest thing that existed when
      // the slot was written — a member tapping "continue the challenge"
      // landed in the club feed with nothing to continue.
      href="/challenge/hq"
      aria-label={label}
      className="f0-brief-field f0-focus f0-press group flex items-stretch"
    >
      {/* left rail — the "ticket stub" */}
      <div className="club-hero-gradient flex shrink-0 flex-col items-center justify-center px-5 py-4 text-white">
        {day ? (
          <>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] opacity-90">
              Day
            </span>
            <span className="font-display text-4xl font-black leading-none tabular-nums">
              {day.day_no}
            </span>
            <span className="font-mono text-[10px] font-semibold opacity-90">
              of {CHALLENGE_DAYS}
            </span>
          </>
        ) : (
          /* UNDATED. An em dash while the read is in flight; the server's own
             phase word once it lands. Never a day number the server did not
             give us. */
          <>
            <span className="font-display text-4xl font-black leading-none" aria-hidden>
              —
            </span>
            <span className="mt-1 max-w-[7ch] text-center font-mono text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] opacity-90">
              {state ? PHASE_LABEL[state.phase] : "5 days"}
            </span>
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-eyebrow font-bold uppercase text-gold-700">
            5-Day Investing Challenge
          </p>
          <p className="mt-1 font-display text-[17px] font-extrabold text-ink">
            Continue where you left off
          </p>
          {/* Progress pips — REAL completed days, from the server's per-day
              state. Omitted entirely while undated: a five-pip track with
              nothing filled would read as "you have done none of it" during a
              week where there is nothing yet to do. */}
          {day && (
            <div className="mt-2.5 flex gap-1.5" aria-hidden>
              {Array.from({ length: CHALLENGE_DAYS }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < completed ? "bg-accent" : "bg-sand"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
