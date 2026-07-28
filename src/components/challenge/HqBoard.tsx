"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DisplayHead,
  Ledger,
  MeasureStrip,
  Meter,
  SectionRule,
  TextAction,
} from "@/components/f0/parts";
import CohortPresence from "@/components/challenge/CohortPresence";
import CountdownRail from "@/components/challenge/CountdownRail";
import {
  completeBeat,
  currentWeek,
  todaysOneThing,
  PHASE_LABEL,
} from "@/lib/challenge/state";
import { CHALLENGE_SESSION_TIME_LABEL } from "@/lib/free-class";
import type { ChallengeBeat, ChallengeState } from "@/lib/challenge/types";

/**
 * THE HQ — one surface, six server-derived phases. Which one renders is decided
 * by `challenge_state().phase`, computed in Postgres against the cohort's real
 * timestamps. The client never decides what is unlocked; it only ticks the
 * countdown, and even that is seeded from the server's clock.
 *
 *   pre_open   → a stated "opens on <date>" with the countdown to it
 *   preseason  → today's one thing · challenge-ready · this week's beats
 *   forming    → the kickoff countdown, the cohort, the confirmations
 *   live       → the five days with their real states, linking to the missions
 *   aftermath  → the recap, honest about what they actually did
 *   closed     → a stated close, no phantom controls
 *
 * FOUNDING STATE (§0.5): the canvas draws 2,847 cohort mates and a 12-day
 * streak. Everything numeric here is a real count or a real derivation, and
 * `CohortPresence` swaps to designed founding copy below the floor.
 *
 * COLOUR LAW: there is no price anywhere on this surface, so there is no green
 * or red. The only accent is the mode accent on the meter and the CTA (brand +
 * action). The simulator line is a link, not a P/L readout — a member's practice
 * return is their own record and belongs on their own simulator, never framed
 * here as evidence anything works.
 */

function fmtDay(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
}

export default function HqBoard({ state }: { state: ChallengeState }) {
  const supabase = useMemo(() => createClient(), []);
  const [beats, setBeats] = useState<ChallengeBeat[]>(state.beats);
  const [ready, setReady] = useState(state.challenge_ready);
  const [busy, setBusy] = useState<string | null>(null);

  const tz = state.cohort.tz;
  const week = currentWeek(beats, state.now);
  const one = todaysOneThing(beats, state.now);
  const weekBeats = beats.filter((b) => b.week === week);

  const doBeat = useCallback(
    async (key: string) => {
      setBusy(key);
      const ok = await completeBeat(supabase, key);
      if (ok) {
        setBeats((bs) =>
          bs.map((b) =>
            b.key === key && !b.completed_at
              ? { ...b, completed_at: new Date().toISOString() }
              : b
          )
        );
        setReady((r) => ({ ...r, done: Math.min(r.total, r.done + 1) }));
      }
      setBusy(null);
    },
    [supabase]
  );

  /* THE PHANTOM STREAK.
     `challenge_join()` stamps the activity ledger with source 'join', and the
     HQ page calls it on every load — so the streak function counted the visit
     itself and the very first pre-season screen a member ever saw greeted them
     with "🔥 1-day streak" for having arrived. A streak is a claim that you
     did something on consecutive days; being present is not doing something,
     and the whole board is built on never printing a number nobody earned.

     So the streak is only spoken once there is a real activity day behind it:
     a completed pre-season beat, a completed step of a day mission, or Day 0.
     All three are server-derived fields already on the state (no clock is read
     here, and `beats` is the live client copy, so finishing a beat lights the
     streak in the same interaction that earns it). */
  const hasEarnedDay =
    beats.some((b) => b.completed_at != null) ||
    state.days.some((d) => d.brief_done || d.do_done || d.share_done) ||
    state.member?.day0_completed_at != null;

  const streakLine =
    hasEarnedDay && state.streak > 0 ? (
      <span className="inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold tabular-nums text-soft">
        <Flame className="h-3.5 w-3.5" aria-hidden />
        {state.streak}-day streak
      </span>
    ) : (
      <span className="font-mono text-[13px] font-semibold text-soft">
        No streak yet — one action today starts it
      </span>
    );

  /* ── pre_open ─────────────────────────────────────────────────────────── */
  if (state.phase === "pre_open") {
    return (
      <Frame state={state} streak={streakLine}>
        <DisplayHead
          eyebrow={PHASE_LABEL.pre_open}
          title="The pre-season opens"
          mark={fmtDay(state.cohort.preseason_opens_at, tz)}
          lede="Your account is live and everything in the Club is already yours. The daily rhythm switches on when pre-season opens."
        />
        <CountdownRail
          serverNow={state.now}
          target={state.cohort.preseason_opens_at}
          label="Pre-season opens in"
        />
        <ClubLinks />
      </Frame>
    );
  }

  /* ── closed ───────────────────────────────────────────────────────────── */
  if (state.phase === "closed") {
    return (
      <Frame state={state} streak={streakLine}>
        <DisplayHead
          eyebrow={PHASE_LABEL.closed}
          title="This cohort has"
          mark="closed"
          lede="Everything you built is still yours — your watchlist, your XP, your streak and every artifact you posted."
        />
        <Ledger>
          <div className="f0-ledger-row justify-between">
            <span className="font-display text-[15px] font-bold text-ink">
              Days completed
            </span>
            <span className="font-mono text-[14px] font-semibold tabular-nums text-soft">
              {state.days.filter((d) => d.share_done).length} of {state.days.length}
            </span>
          </div>
        </Ledger>
        <ClubLinks />
      </Frame>
    );
  }

  /* ── live / aftermath — the five days ─────────────────────────────────── */
  if (state.phase === "live" || state.phase === "aftermath") {
    const doneCount = state.days.filter((d) => d.share_done).length;
    return (
      <Frame state={state} streak={streakLine}>
        <DisplayHead
          eyebrow={
            state.phase === "live" ? "Challenge week" : "The week is done"
          }
          title={state.phase === "live" ? "Five days," : "You showed up"}
          mark={state.phase === "live" ? "together" : `${doneCount}/5`}
          lede={
            state.phase === "live"
              ? `A mission each day and a live session at ${CHALLENGE_SESSION_TIME_LABEL}. Miss one and you can still catch it up — the streak is the point.`
              : "Your access stays open a little longer. Everything you made is on your profile."
          }
        />

        <MeasureStrip
          items={[
            { label: "Days done", value: `${doneCount}/5` },
            // Same gate as `streakLine` — a join stamp is not a streak. Zero is
            // a real reading here (this strip is a recap of days actually done),
            // so it prints 0 rather than the absence marker.
            { label: "Streak", value: hasEarnedDay ? `${state.streak}` : "0" },
            { label: "XP", value: state.xp.toLocaleString() },
          ]}
        />

        <section className="space-y-4">
          <SectionRule>The five days</SectionRule>
          <Ledger>
            {state.days.map((d) => {
              const locked = d.state === "locked";
              const label = `Day ${d.day_no} · ${d.title}`;
              const meta =
                d.state === "complete"
                  ? "Done"
                  : d.state === "live"
                    ? "Live now"
                    : d.state === "missed"
                      ? d.late_ok
                        ? "Catch up"
                        : "Closed"
                      : d.state === "locked"
                        ? fmtDay(d.unlock_at, tz)
                        : `${d.est_minutes} min`;

              if (locked) {
                return (
                  <div key={d.day_no} className="f0-ledger-row justify-between opacity-60">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[15px] font-bold text-ink">
                        {label}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-snug text-soft">
                        Opens {fmtDay(d.unlock_at, tz)} · session{" "}
                        {CHALLENGE_SESSION_TIME_LABEL}
                      </p>
                    </div>
                    <span className="shrink-0 self-center font-mono text-[13px] font-semibold tabular-nums text-soft">
                      Locked
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={d.day_no}
                  href={`/challenge/days/${d.day_no}`}
                  className="f0-ledger-row f0-focus f0-press group justify-between"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block font-display text-[15px] font-bold ${
                        d.state === "live" ? "text-gold-700" : "text-ink"
                      }`}
                    >
                      {label}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-soft">
                      {d.state === "missed" && d.late_ok
                        ? "You missed the live one — the mission is still open."
                        : d.theme}
                    </span>
                  </span>
                  <span className="shrink-0 self-center font-mono text-[13px] font-semibold tabular-nums text-soft">
                    {meta}
                  </span>
                </Link>
              );
            })}
          </Ledger>
        </section>

        <CohortSection state={state} />
      </Frame>
    );
  }

  /* ── forming ──────────────────────────────────────────────────────────── */
  if (state.phase === "forming") {
    return (
      <Frame state={state} streak={streakLine}>
        <DisplayHead
          eyebrow="Your cohort is forming"
          title="Kickoff"
          mark={fmtDay(state.cohort.kickoff_at, tz)}
          lede={`The first live session is ${fmtDay(state.cohort.kickoff_at, tz)} at ${CHALLENGE_SESSION_TIME_LABEL}. Your XP, your streak and your watchlist all carry in.`}
        />

        <CountdownRail
          serverNow={state.now}
          target={state.cohort.kickoff_at}
          label="Kickoff in"
        />

        <CohortSection state={state} />

        <section className="space-y-4">
          <SectionRule>Before Monday</SectionRule>
          <Ledger>
            <ConfirmRow
              done={Boolean(state.member?.calendar_added_at)}
              label="Calendar confirmed · all 5 sessions"
              sub="Re-download if you changed device."
              href="/challenge/calendar"
            />
            <div className="f0-ledger-row justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-display text-[15px] font-bold text-ink">
                  Text reminders
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-soft">
                  {state.member?.sms_opt_in
                    ? "Your number is saved. Text reminders aren't switched on yet — we'll text you the moment they are."
                    : "Not saved. Add your number on the welcome screen and we'll text you once reminders switch on."}
                </p>
              </div>
              <span className="shrink-0 self-center font-mono text-[13px] font-semibold text-soft">
                {state.member?.sms_opt_in ? "Saved" : "Off"}
              </span>
            </div>
            <ConfirmRow
              done={Boolean(state.member?.preseason_badge_at)}
              label="Pre-season badge"
              sub={
                state.member?.preseason_badge_at
                  ? "Earned — it shows on the leaderboard from minute one."
                  : `A beat in each of the four August weeks earns it. You're at ${ready.done} of ${ready.total} beats.`
              }
              href="/challenge/hq"
            />
          </Ledger>
        </section>
      </Frame>
    );
  }

  /* ── preseason — the rhythm ───────────────────────────────────────────── */
  const pct = ready.total > 0 ? Math.round((ready.done / ready.total) * 100) : 0;

  return (
    <Frame state={state} streak={streakLine}>
      <DisplayHead
        eyebrow={`${PHASE_LABEL.preseason} · week ${week}`}
        title="Today's one"
        mark="thing"
        lede="Never more than about fifteen minutes. Do the one thing, keep the streak, and Day 1 starts with you already warm."
      />

      {/* TODAY'S ONE THING — the brand-tinted digest field. No price may sit here. */}
      {one ? (
        <div className="f0-brief-field flex items-center gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
              {one.est_minutes} min · +{one.xp} XP
            </p>
            <p className="mt-1 font-display text-[17px] font-extrabold leading-snug text-ink">
              {one.label}
            </p>
            {one.sub && (
              <p className="mt-1 text-[13px] leading-snug text-soft">{one.sub}</p>
            )}
          </div>
          {one.href ? (
            <Link
              href={one.href}
              onClick={() => void doBeat(one.key)}
              className="cta-button f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[14px]"
            >
              Start <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void doBeat(one.key)}
              disabled={busy === one.key}
              className="cta-button f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[14px]"
            >
              Done
            </button>
          )}
        </div>
      ) : (
        <div className="border-l-2 border-sand py-1 pl-4">
          <p className="font-display text-display-3 font-extrabold text-ink">
            Week {week} is clear
          </p>
          <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-soft">
            Everything open is done. Next week&rsquo;s beats unlock on their own —
            nothing to chase today.
          </p>
        </div>
      )}

      {/* CHALLENGE READY */}
      <section className="space-y-3">
        <SectionRule>Challenge ready</SectionRule>
        <div className="flex items-baseline justify-between">
          <p className="font-display text-display-2 font-extrabold tabular-nums text-ink">
            {ready.done}
            <span className="text-soft"> of {ready.total}</span>
          </p>
          <p className="font-mono text-[13px] font-semibold tabular-nums text-soft">
            {pct}%
          </p>
        </div>
        <Meter pct={pct} />
        <p className="text-[13px] leading-snug text-soft">
          {state.member?.preseason_badge_at
            ? "Pre-season badge earned — it shows on the leaderboard from minute one."
            : "A beat in each of the four August weeks earns the pre-season badge."}
        </p>
      </section>

      {/* THIS WEEK'S BEATS */}
      <section className="space-y-4">
        <SectionRule>This week&rsquo;s beats</SectionRule>
        <Ledger>
          {weekBeats.map((b) => (
            <div key={b.key} className="f0-ledger-row justify-between">
              <div className="min-w-0 flex-1">
                <p
                  className={`font-display text-[15px] font-bold ${
                    b.completed_at ? "text-soft line-through" : "text-ink"
                  }`}
                >
                  {b.label}
                </p>
                {b.sub && (
                  <p className="mt-0.5 text-[13px] leading-snug text-soft">{b.sub}</p>
                )}
              </div>
              {b.completed_at ? (
                <Check className="h-4 w-4 shrink-0 self-center text-gold-700" />
              ) : b.href ? (
                <Link
                  href={b.href}
                  onClick={() => void doBeat(b.key)}
                  className="f0-chip f0-chip-accent f0-focus f0-press shrink-0 self-center font-display text-[13px] font-bold text-ink"
                >
                  +{b.xp} XP
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void doBeat(b.key)}
                  disabled={busy === b.key}
                  className="f0-chip f0-chip-accent f0-focus f0-press shrink-0 self-center font-display text-[13px] font-bold text-ink"
                >
                  +{b.xp} XP
                </button>
              )}
            </div>
          ))}
        </Ledger>
      </section>

      <CohortSection state={state} />

      <div className="f0-rule-top pt-5">
        <p className="font-display text-[15px] font-bold text-ink">
          Kickoff {fmtDay(state.cohort.kickoff_at, tz)} · {CHALLENGE_SESSION_TIME_LABEL}
        </p>
        <p className="mt-1 text-[13px] text-soft">
          Your XP and streak carry straight into Day 1.
        </p>
        <div className="mt-3">
          <TextAction href="/challenge/calendar">
            Add the 5 sessions to your calendar
          </TextAction>
        </div>
      </div>
    </Frame>
  );
}

/* ── shared bits ──────────────────────────────────────────────────────────── */

function Frame({
  state,
  streak,
  children,
}: {
  state: ChallengeState;
  streak: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="f0-stagger space-y-9">
      <div className="flex items-center justify-between gap-4">
        <p className="text-eyebrow font-display font-bold uppercase text-soft">
          {PHASE_LABEL[state.phase]}
        </p>
        {streak}
      </div>
      {children}
    </div>
  );
}

function CohortSection({ state }: { state: ChallengeState }) {
  return (
    <section className="space-y-4">
      <SectionRule>Your cohort</SectionRule>
      <CohortPresence counts={state.cohort_counts} />
      {!state.cohort_counts.below_floor &&
        state.cohort_counts.preseason_badges > 0 && (
          <p className="text-[13px] text-soft">
            {state.cohort_counts.preseason_badges.toLocaleString()} carry a
            pre-season badge — they show on the leaderboard from minute one.
          </p>
        )}
    </section>
  );
}

function ConfirmRow({
  done,
  label,
  sub,
  href,
}: {
  done: boolean;
  label: string;
  sub: string;
  href: string;
}) {
  return (
    <Link href={href} className="f0-ledger-row f0-focus f0-press justify-between">
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-bold text-ink">
          {label}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-soft">{sub}</span>
      </span>
      {done ? (
        <Check className="h-4 w-4 shrink-0 self-center text-gold-700" />
      ) : (
        <ArrowRight className="h-4 w-4 shrink-0 self-center text-soft" />
      )}
    </Link>
  );
}

function ClubLinks() {
  return (
    <section className="space-y-4">
      <SectionRule>Open right now</SectionRule>
      <Ledger>
        <Link href="/community" className="f0-ledger-row f0-focus justify-between">
          <span className="font-display text-[15px] font-bold text-ink">
            The community
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 self-center text-soft" />
        </Link>
        <Link href="/simulator" className="f0-ledger-row f0-focus justify-between">
          <span className="font-display text-[15px] font-bold text-ink">
            Practice simulator
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 self-center text-soft" />
        </Link>
        <Link href="/courses" className="f0-ledger-row f0-focus justify-between">
          <span className="font-display text-[15px] font-bold text-ink">
            Lessons
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 self-center text-soft" />
        </Link>
      </Ledger>
    </section>
  );
}
