"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DisplayHead, Ledger, SectionRule, Switch } from "@/components/f0/parts";
import {
  CHALLENGE_DATES_LABEL,
  CHALLENGE_SESSION_TIME_LABEL,
} from "@/lib/free-class";
import { markCalendarAdded, setSmsOptIn } from "@/lib/challenge/state";
import type { ChallengeState } from "@/lib/challenge/types";

/**
 * MINUTE 0 — the signup confirmation.
 *
 * "Your seat is locked. Your account is live." Then three commitment steps and
 * the what-happens-next timeline, ending in the first-win CTA. The whole point
 * of the board is that the account exists before the excitement fades.
 *
 * EVERY CONTROL IS A REAL WRITE — or it says what it is:
 *   • Add all 5 sessions      → GET /challenge/calendar (a real .ics built from
 *                               `challenge_days`) and the route stamps
 *                               `calendar_added_at`. Not a dead button.
 *   • Text me reminders       → persists the consent fact via
 *                               `challenge_set_sms_opt_in`. There is NO working
 *                               SMS sender today (Twilio credentials are absent;
 *                               `sendSms()` returns "Twilio credentials not
 *                               configured"), so the row is labelled exactly
 *                               that: we hold the number and text you when
 *                               reminders switch on. It does not claim a send.
 *   • Say hi in the community → deep-links to the composer. The +10 is granted
 *                               by `challenge_claim_intro()`, which only pays
 *                               out once a REAL post exists — verified on the
 *                               server, never on the click.
 *
 * The +20 for "free account created" is granted by `challenge_join()` at first
 * load through the existing `xp_events` ledger, ref-deduped (`challenge:account`).
 *
 * DATES: the sessions are Wed Sept 2 → Sun Sept 6, 7:00 PM ET — the times seeded
 * into `live_events` (migration 171) and mirrored in `challenge_days`. The canvas
 * board says "Sept 1–5"; the code and the seeded calendar win, and the strings
 * come from the existing `CHALLENGE_DATES_LABEL` / `CHALLENGE_SESSION_TIME_LABEL`
 * constants so this board can never drift from the .ics or the emails.
 */

const INTRO_TEMPLATE =
  "Hi everyone — just joined the 5-Day Investing Challenge! 👋 A bit about me (or my family / crew): \n\nOne money habit I want to build by Day 5: ";
const INTRO_HREF = `/community?compose=${encodeURIComponent(INTRO_TEMPLATE)}`;

function fmtDate(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
}

export default function WelcomeBoard({
  state,
  firstName,
}: {
  state: ChallengeState;
  firstName: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const member = state.member;

  const [sms, setSms] = useState(member?.sms_opt_in ?? false);
  const [phone, setPhone] = useState("");
  const [smsSaving, setSmsSaving] = useState(false);
  const [calendarDone, setCalendarDone] = useState(Boolean(member?.calendar_added_at));
  const [introDone, setIntroDone] = useState(Boolean(member?.intro_posted_at));

  /* The intro claim is server-verified: if they went and posted, the +10 lands
     when they come back. Runs once on mount; a no-post member simply gets
     { posted: false } and the row stays open. */
  useEffect(() => {
    if (introDone) return;
    let alive = true;
    supabase
      .rpc("challenge_claim_intro")
      .then(({ data }: { data: { posted?: boolean } | null }) => {
        if (alive && data?.posted) setIntroDone(true);
      });
    return () => {
      alive = false;
    };
  }, [supabase, introDone]);

  const onCalendar = useCallback(() => {
    setCalendarDone(true);
    void markCalendarAdded(supabase);
    window.location.href = "/challenge/calendar";
  }, [supabase]);

  const onSmsToggle = useCallback(async () => {
    const next = !sms;
    setSms(next);
    setSmsSaving(true);
    await setSmsOptIn(supabase, next, phone || null);
    setSmsSaving(false);
  }, [sms, phone, supabase]);

  const tz = state.cohort.tz;
  const timeline: { when: string; what: string }[] = [
    { when: "Today", what: "Your first win" },
    { when: "August", what: "Pre-season — about 15 minutes a day" },
    {
      when: fmtDate(state.cohort.cohort_forming_at, tz),
      what: "Your cohort forms",
    },
    {
      when: fmtDate(state.cohort.kickoff_at, tz),
      what: `Challenge kickoff · ${CHALLENGE_SESSION_TIME_LABEL}`,
    },
  ];

  return (
    <div className="f0-stagger space-y-9">
      <DisplayHead
        eyebrow={
          firstName
            ? `You're in, ${firstName} · 5-Day Investing Challenge`
            : "5-Day Investing Challenge"
        }
        title="Your seat is"
        mark="locked"
        lede={
          <>
            {CHALLENGE_DATES_LABEL} · free, no card. Your account is live and the
            HQ is open right now — the pre-season starts today.
          </>
        }
      />

      {/* The one already-earned thing. A stated fact, not a badge grid. */}
      <p className="f0-rule-top flex items-center gap-2 pt-4 font-display text-[15px] font-bold text-ink">
        <Check className="h-4 w-4 shrink-0 text-gold-700" />
        Free account created
        <span className="ml-auto font-mono text-[13px] font-semibold tabular-nums text-soft">
          +20 XP
        </span>
      </p>

      <section className="space-y-4">
        <SectionRule>Lock it in</SectionRule>
        <Ledger>
          {/* 1 — calendar */}
          <button
            type="button"
            onClick={onCalendar}
            className="f0-ledger-row f0-focus f0-press w-full justify-between text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-bold text-ink">
                Add all 5 sessions to your calendar
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug text-soft">
                {CHALLENGE_DATES_LABEL}, {CHALLENGE_SESSION_TIME_LABEL} each
                evening, with a 30-minute reminder on every one.
              </span>
            </span>
            {calendarDone ? (
              <Check className="h-4 w-4 shrink-0 self-center text-gold-700" />
            ) : (
              <ArrowRight className="h-4 w-4 shrink-0 self-center text-soft" />
            )}
          </button>

          {/* 2 — SMS. Honest label: we store the consent, we do not claim a send. */}
          <div className="f0-ledger-row justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-bold text-ink">
                Text me reminders
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-soft">
                {sms
                  ? "Saved. Text reminders aren't switched on yet — we'll text you the moment they are."
                  : "We'll hold your number and text you the night before and the morning of each session, once text reminders switch on."}
              </p>
              {sms && (
                <label className="mt-2 block">
                  <span className="sr-only">Mobile number for reminders</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={() => void setSmsOptIn(supabase, true, phone || null)}
                    placeholder="(555) 555-5555"
                    className="f0-focus w-full max-w-[220px] rounded-md bg-sand/60 px-3 py-2 font-mono text-[14px] text-ink placeholder:text-soft/70"
                  />
                </label>
              )}
            </div>
            <span className="shrink-0 self-center">
              <Switch
                on={sms}
                onToggle={() => void onSmsToggle()}
                label="Text me reminders"
              />
            </span>
          </div>

          {/* 3 — say hi */}
          <Link
            href={INTRO_HREF}
            className="f0-ledger-row f0-focus f0-press group justify-between"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-bold text-ink">
                Say hi in the community
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug text-soft">
                {introDone
                  ? "Posted — the room knows your name now."
                  : "One line about you. Posters show up on Day 1; lurkers don't."}
              </span>
            </span>
            <span className="shrink-0 self-center font-mono text-[13px] font-semibold tabular-nums text-soft">
              {introDone ? "+10 XP ✓" : "+10 XP"}
            </span>
          </Link>
        </Ledger>
      </section>

      <section className="space-y-4">
        <SectionRule>What happens next</SectionRule>
        <Ledger>
          {timeline.map((t) => (
            <div key={t.when} className="f0-ledger-row justify-between">
              <span className="w-24 shrink-0 font-mono text-[13px] font-semibold uppercase tabular-nums text-soft">
                {t.when}
              </span>
              <span className="min-w-0 flex-1 font-display text-[15px] font-bold text-ink">
                {t.what}
              </span>
            </div>
          ))}
        </Ledger>
      </section>

      <div className="f0-rule-top pt-6">
        <Link
          href="/challenge/questions"
          className="cta-button f0-focus f0-press inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px]"
        >
          Get my first win
          <span className="font-mono text-[13px] opacity-80">· 15 min</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-center text-[13px] text-soft">
          Education, not financial advice. Practice money only.
        </p>
      </div>

      {smsSaving && (
        <p className="sr-only" role="status">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving
        </p>
      )}
    </div>
  );
}
