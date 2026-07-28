"use client";

import { useCallback, useMemo, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StreakFlame } from "@/components/art";
import { completeStep, postArtifact, setSmsOptIn } from "@/lib/challenge/state";
import { useCountdown, pad2 } from "@/lib/challenge/clock";
import { CHALLENGE_SESSION_TIME_LABEL } from "@/lib/free-class";
import type { ChallengeDay, ChallengeState } from "@/lib/challenge/types";
import {
  faceFor,
  fmtDay,
  splitHeadline,
  type Day1Payload,
  type Day2Payload,
  type Day3Payload,
  type Day4Payload,
  type Day5Payload,
  type DaySeed,
  type DoPayload,
} from "./data";
import {
  BriefField,
  Dial,
  ErrorLine,
  Medallion,
  MissionButton,
  MissionChrome,
  MissionFooter,
  MissionHead,
  Note,
  PILL,
  RewardTiles,
  ScriptLine,
  StatChips,
} from "./parts";
import Day1Do from "./Day1Do";
import Day2Do from "./Day2Do";
import Day3Do from "./Day3Do";
import Day4Do from "./Day4Do";
import Day5Do from "./Day5Do";
import Day3Offer from "./Day3Offer";
import DayShare, { type PostArgs } from "./DayShare";
import CohortPresence from "@/components/challenge/CohortPresence";

/**
 * ONE DAY MISSION — Brief → Do → Share, exactly as the canvas draws it.
 *
 * ── WHAT IS SERVER-AUTHORITATIVE ──────────────────────────────────────────
 * `day.state` is derived in Postgres (`challenge_state()`) against the cohort's
 * real timestamps, and this component NEVER recomputes it. It only chooses which
 * of five boards to render from the value it was handed:
 *
 *   locked   → the shut door + a countdown to the real `unlock_at`. No controls.
 *   missed   → the flow, opened, with a catch-up line. `late_ok` is the whole
 *              product: a missed day is not a dead end, it is a day you defend.
 *   missed & !late_ok → a stated close. Nothing to press.
 *   open     → the flow.
 *   live     → the flow plus the session's own line and a door to the room.
 *   complete → the artifact, the reward and the way onward.
 *
 * `challenge_complete_step` refuses a locked day and enforces brief → do → share
 * ordering server-side, so the client's step routing is a convenience, never a
 * gate. If the two ever disagree the server wins and the message it returns is
 * shown to the member rather than swallowed.
 *
 * ── THE STEP PAYLOAD ──────────────────────────────────────────────────────
 * The `do` step's payload is written into `challenge_step_completions` and read
 * back by the page on the next visit, so the share screen can render the work a
 * member did an hour ago on a different device. Nothing about the artifact lives
 * only in this component's memory.
 */
export default function DayMission({
  day,
  state,
  seed,
  clubUrl,
  ftaUrl,
}: {
  day: ChallengeDay;
  state: ChallengeState;
  seed: DaySeed;
  clubUrl: string;
  ftaUrl: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const face = faceFor(day);
  const tz = state.cohort.tz;
  const headline = splitHeadline(day.brief_headline, face.markWords);

  const [briefDone, setBriefDone] = useState(day.brief_done);
  const [shared, setShared] = useState(day.share_done);
  const [payload, setPayload] = useState<DoPayload | null>(seed.doPayload);
  const [step, setStep] = useState<1 | 2 | 3>(
    day.do_done ? 3 : day.brief_done ? 2 : 1
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [reminderOn, setReminderOn] = useState(Boolean(state.member?.sms_opt_in));

  const unlock = useCountdown(state.now, day.unlock_at);
  const doneCount = state.days.filter((d) => d.share_done).length + (shared && !day.share_done ? 1 : 0);
  const next = state.days.find((d) => d.day_no === day.day_no + 1) ?? null;

  /* ── writes ───────────────────────────────────────────────────────────── */

  const doBrief = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await completeStep(supabase, day.day_no, "brief", {});
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "That didn't save. Try once more.");
      return;
    }
    setBriefDone(true);
    setStep(2);
  }, [supabase, day.day_no]);

  const doExercise = useCallback(
    async (p: DoPayload) => {
      setBusy(true);
      setError(null);
      const res = await completeStep(
        supabase,
        day.day_no,
        "do",
        p as Record<string, unknown>
      );
      setBusy(false);
      if (!res.ok) {
        setError(res.error || "That didn't save. Try once more.");
        return;
      }
      setPayload(p);
      setStep(3);
    },
    [supabase, day.day_no]
  );

  const doPost = useCallback(
    async (args: PostArgs) => {
      setBusy(true);
      setError(null);
      const res = await postArtifact(supabase, {
        day: day.day_no,
        kind: day.artifact_kind,
        body: args.body,
        ticker: args.ticker,
        company: args.company,
        payload: args.payload,
      });
      setBusy(false);
      if (!res.ok) {
        setError(res.error || "That didn't post. Try once more.");
        return;
      }
      setShared(true);
      if (day.day_no === 3) setOfferOpen(true);
      router.refresh();
    },
    [supabase, day.day_no, day.artifact_kind, router]
  );

  const doReminder = useCallback(
    async (on: boolean) => {
      setReminderOn(on);
      const ok = await setSmsOptIn(supabase, on, null);
      if (!ok) setReminderOn(!on);
    },
    [supabase]
  );

  /* ── LOCKED ───────────────────────────────────────────────────────────── */
  if (day.state === "locked") {
    return (
      <Board>
        <div className="flex flex-col items-center gap-5 pt-4 text-center">
          <span className="grid h-[92px] w-[92px] place-items-center rounded-full bg-sand">
            <Lock className="h-8 w-8 text-soft" aria-hidden />
          </span>
          <MissionHead>
            Day {day.day_no} opens{" "}
            <span className="text-gold-700">{fmtDay(day.unlock_at, tz)}</span>
          </MissionHead>
          <p className="max-w-sm text-[15px] leading-relaxed text-soft">
            {day.theme}. The session is that evening at {CHALLENGE_SESSION_TIME_LABEL}.
          </p>
        </div>

        <div className="rounded-2xl border border-sand bg-card px-5 py-5 text-center">
          <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-soft">
            Opens in
          </p>
          <p className="mt-2 font-mono text-[28px] font-bold tabular-nums text-ink">
            {unlock == null
              ? "—"
              : `${unlock.days}d ${pad2(unlock.hours)}:${pad2(unlock.minutes)}:${pad2(
                  unlock.seconds
                )}`}
          </p>
        </div>

        <Note>
          Nothing to do tonight. Days unlock on the cohort&rsquo;s clock, not
          yours — a device set a day fast will not open this early.
        </Note>

        <MissionFooter>
          <MissionButton href="/challenge/hq" tone="quiet">
            Back to HQ
          </MissionButton>
        </MissionFooter>
      </Board>
    );
  }

  /* ── MISSED AND CLOSED FOR GOOD ───────────────────────────────────────── */
  if (day.state === "missed" && !day.late_ok) {
    return (
      <Board>
        <MissionHead align="left">
          Day {day.day_no} has <span className="text-gold-700">closed</span>
        </MissionHead>
        <p className="text-[15px] leading-relaxed text-soft">
          This one ran on {fmtDay(day.session_at, tz)} and is not open for
          catch-up. Everything you did on the other days still counts — the streak
          picks up from your next one.
        </p>
        <Note>
          The recording and the notes live with the rest of the week in your HQ.
        </Note>
        <MissionFooter>
          <MissionButton href="/challenge/hq" tone="quiet">
            Back to HQ
          </MissionButton>
        </MissionFooter>
      </Board>
    );
  }

  /* ── COMPLETE ─────────────────────────────────────────────────────────── */
  if (shared && !offerOpen) {
    const artifact = seed.myArtifact;
    return (
      <Board>
        <div className="flex flex-col items-center gap-4 pt-2 text-center">
          <Dial
            pct={(doneCount / state.days.length) * 100}
            value={`${doneCount}/${state.days.length}`}
            unit="days done"
          />
          <ScriptLine>{day.day_no === 5 ? "that's five for five" : "logged and posted"}</ScriptLine>
          <MissionHead>
            Day {day.day_no} <span className="text-gold-700">done</span>
          </MissionHead>
          <p className="max-w-sm text-[15px] leading-relaxed text-soft">
            {day.share_headline}. It is in the community feed and on your
            challenge card.
          </p>
        </div>

        <RewardTiles
          items={[
            { icon: "⚡", value: `+${day.xp_award}`, label: "Earned", lead: true },
            {
              icon:
                state.streak > 0 ? (
                  <StreakFlame streak={state.streak} size={15} showCount={false} ignite />
                ) : undefined,
              value: state.streak > 0 ? `${state.streak}` : "—",
              label: "Day streak",
            },
            { value: state.xp.toLocaleString(), label: "Total XP" },
          ]}
        />

        {artifact?.body && (
          <div className="rounded-2xl border border-sand bg-card p-5">
            <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-gold-700">
              What you posted
            </p>
            <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink">
              {artifact.body}
            </p>
          </div>
        )}

        <section className="space-y-3">
          <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-soft">
            Your cohort
          </p>
          <CohortPresence
            counts={state.cohort_counts}
            avatars={seed.cohort.map((a) => ({ name: a.name, url: a.avatar }))}
            aboveFloorNoun="in your cohort"
            foundingTitle="You are early here"
            foundingBody="The cohort is still filling. The members below are the ones already in — their artifacts are on the feed next to yours."
          />
        </section>

        {day.day_no === 3 && (
          <button
            type="button"
            onClick={() => setOfferOpen(true)}
            className="f0-focus font-display text-[14px] font-bold text-gold-700"
          >
            See the keep-going-together options →
          </button>
        )}

        <MissionFooter>
          {next && next.state !== "locked" ? (
            <MissionButton href={`/challenge/days/${next.day_no}`}>
              Day {next.day_no} · {next.title} <ArrowRight className="h-4 w-4" />
            </MissionButton>
          ) : next ? (
            <MissionButton href="/challenge/hq" tone="quiet">
              Day {next.day_no} opens {fmtDay(next.unlock_at, tz)} — back to HQ
            </MissionButton>
          ) : (
            <MissionButton href="/challenge/hq">
              Back to HQ — see the standings
            </MissionButton>
          )}
        </MissionFooter>
      </Board>
    );
  }

  /* ── THE DAY-3 OFFER ──────────────────────────────────────────────────── */
  if (offerOpen) {
    return (
      <Board>
        <Day3Offer
          state={state}
          clubUrl={clubUrl}
          ftaUrl={ftaUrl}
          watchlistCount={seed.mine[1]?.tickers?.length ?? null}
          onDismiss={() => setOfferOpen(false)}
        />
      </Board>
    );
  }

  /* ── THE FLOW ─────────────────────────────────────────────────────────── */
  const label =
    step === 1 ? "Brief" : step === 2 ? face.doLabel : face.shareLabel;

  return (
    <Board>
      <MissionChrome
        step={step}
        exitHref="/challenge/hq"
        label={label}
        onBack={step > 1 ? () => setStep((s) => (s === 3 ? 2 : 1)) : undefined}
      />

      {day.state === "missed" && (
        <div className="f0-brief-field px-5 py-4">
          <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-gold-700">
            Catch-up
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink">
            The live one ran on {fmtDay(day.session_at, tz)} — the mission is
            still open and it still counts. Finishing it defends your streak.
          </p>
        </div>
      )}

      {day.state === "live" && (
        <div className="f0-brief-field flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-gold-700">
              Tonight
            </p>
            <p className="mt-1 font-display text-[15px] font-bold text-ink">
              Live session at {CHALLENGE_SESSION_TIME_LABEL}
            </p>
          </div>
          <Link
            href="/live-sessions"
            style={PILL}
            className="f0-chip f0-chip-accent f0-focus f0-press shrink-0 px-3.5 py-2 font-display text-[13px] font-bold text-gold-700"
          >
            The room
          </Link>
        </div>
      )}

      {/* ── STEP 1 · BRIEF ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="f0-stagger space-y-7">
          <Medallion glyph={face.glyph} badge={face.badge} tone={face.tone} />
          <ScriptLine>{face.script}</ScriptLine>
          <MissionHead mark={headline.mark}>{headline.head}</MissionHead>

          <StatChips
            items={[
              { icon: "⏱", value: `${day.est_minutes} min` },
              { icon: "◇", value: day.tag ?? day.theme },
              { icon: "⚡", value: `+${day.xp_award} XP` },
            ]}
          />

          <BriefField label="Why this matters">
            <p className="text-[14px] leading-relaxed text-ink">{day.brief_body}</p>
          </BriefField>

          <section className="space-y-3">
            <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-soft">
              Doing this with you
            </p>
            <CohortPresence
              counts={state.cohort_counts}
              avatars={seed.cohort.map((a) => ({ name: a.name, url: a.avatar }))}
              aboveFloorNoun="in your cohort"
              foundingTitle="A small room tonight"
              foundingBody="The cohort is still filling, so tonight is a small room — which is the good version of early. Everyone here is doing the same mission."
            />
          </section>

          {error && <ErrorLine>{error}</ErrorLine>}

          <MissionFooter>
            <MissionButton onClick={() => void doBrief()} busy={busy}>
              {briefDone ? "Continue" : face.briefCta} <ArrowRight className="h-4 w-4" />
            </MissionButton>
          </MissionFooter>
        </div>
      )}

      {/* ── STEP 2 · DO ────────────────────────────────────────────────── */}
      {step === 2 && (
        <>
          {day.day_no === 1 && (
            <Day1Do
              seed={{ ...seed, doPayload: payload }}
              onSubmit={(p: Day1Payload) => void doExercise(p)}
              busy={busy}
              error={error}
            />
          )}
          {day.day_no === 2 && (
            <Day2Do
              seed={{ ...seed, doPayload: payload }}
              onSubmit={(p: Day2Payload) => void doExercise(p)}
              busy={busy}
              error={error}
            />
          )}
          {day.day_no === 3 && (
            <Day3Do
              seed={{ ...seed, doPayload: payload }}
              onSubmit={(p: Day3Payload) => void doExercise(p)}
              busy={busy}
              error={error}
            />
          )}
          {day.day_no === 4 && (
            <Day4Do
              seed={{ ...seed, doPayload: payload }}
              onSubmit={(p: Day4Payload) => void doExercise(p)}
              busy={busy}
              error={error}
            />
          )}
          {day.day_no === 5 && (
            <Day5Do
              seed={{ ...seed, doPayload: payload }}
              onSubmit={(p: Day5Payload) => void doExercise(p)}
              onReminder={(on) => void doReminder(on)}
              reminderOn={reminderOn}
              busy={busy}
              error={error}
            />
          )}
        </>
      )}

      {/* ── STEP 3 · SHARE ─────────────────────────────────────────────── */}
      {step === 3 && (
        <DayShare
          day={day}
          state={state}
          seed={{ ...seed, doPayload: payload }}
          onPost={(a) => void doPost(a)}
          busy={busy}
          error={error}
        />
      )}

    </Board>
  );
}

/** The board frame. One column, generous rhythm, the footer sticky inside it. */
function Board({ children }: { children: React.ReactNode }) {
  return <div className="f0-stagger space-y-8">{children}</div>;
}
