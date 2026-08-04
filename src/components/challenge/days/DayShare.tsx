"use client";

import { useMemo, useState } from "react";
import type React from "react";
import { Check, Trophy } from "lucide-react";
import { SOCIAL_FLOORS } from "@/lib/social/reactions";
import { StreakFlame } from "@/components/art";
import Ticker from "@/components/ui/Ticker";
import type { Stance } from "@/lib/social/stance";
import type { ChallengeDay, ChallengeState } from "@/lib/challenge/types";
import { RESEARCH_QUESTIONS, fmtUsd, type DaySeed } from "./data";
import type {
  Day1Payload,
  Day2Payload,
  Day3Payload,
  Day4Payload,
  Day5Payload,
} from "./data";
import {
  Dial,
  ErrorLine,
  MissionButton,
  MissionFooter,
  MissionHead,
  Note,
  PILL,
  Panel,
  RewardTiles,
  ScriptLine,
} from "./parts";

/**
 * STEP 3 · SHARE — the artifact, the reward, the cohort.
 *
 * ONE server call does all of it: `challenge_post_artifact` writes the artifact,
 * creates a REAL community post in `feed_posts` (the same feed everyone reads),
 * completes the share step and grants `challenge_days.xp_award`. Idempotent per
 * (member, day), so a second press updates rather than duplicating.
 *
 * EVERY FIGURE ON THIS SCREEN IS SERVER STATE. The XP is `day.xp_award`, not the
 * canvas's "+125"; the streak is `state.streak` and renders "—" at zero rather
 * than a flattering 1; "days done" counts `share_done`. The cohort strip counts
 * real `challenge_artifacts` rows and disappears entirely when there are none —
 * the canvas's "1,388 research cards posted tonight" has no honest form at a
 * count of two, so it simply is not drawn.
 */

const STANCES: Stance[] = ["bear", "neutral", "bull"];
const STANCE_LABEL: Record<Stance, string> = {
  bear: "Bearish",
  neutral: "Neutral",
  bull: "Bullish",
};

export interface PostArgs {
  body: string;
  ticker: string | null;
  company: string | null;
  payload: Record<string, unknown>;
}

export default function DayShare({
  day,
  state,
  seed,
  onPost,
  busy,
  error,
}: {
  day: ChallengeDay;
  state: ChallengeState;
  seed: DaySeed;
  onPost: (args: PostArgs) => void;
  busy: boolean;
  error: string | null;
}) {
  const [why, setWhy] = useState("");
  const [stance, setStance] = useState<Stance | null>(null);

  const doneCount = state.days.filter((d) => d.share_done).length;
  const payload = seed.doPayload;

  /* Hoisted above the per-day branches: hook order may not depend on the day. */
  const myDay3Votes = useMemo(
    () => (day.day_no === 3 ? ((payload as Day3Payload | null)?.votes ?? []) : []),
    [day.day_no, payload]
  );
  const cohortPick = useCohortPick(seed, myDay3Votes);

  const rewards = (
    <RewardTiles
      items={[
        { icon: "⚡", value: `+${day.xp_award}`, label: "Mission complete", lead: true },
        {
          icon:
                state.streak > 0 ? (
                  <StreakFlame streak={state.streak} size={15} showCount={false} ignite />
                ) : undefined,
          value: state.streak > 0 ? `${state.streak}` : "—",
          label: state.streak > 0 ? "Streak alive" : "Streak starts here",
        },
        { value: `${doneCount}/${state.days.length}`, label: "Days done" },
      ]}
    />
  );

  /* ── the per-day artifact ─────────────────────────────────────────────── */

  let head: React.ReactNode = null;
  let script: string | null = null;
  let preview: React.ReactNode = null;
  let extra: React.ReactNode = null;
  let cta = "Post it";
  let ready = false;
  let build: (() => PostArgs) | null = null;

  if (day.day_no === 1) {
    const p = (payload ?? { picks: [] }) as Day1Payload;
    const picks = p.picks ?? [];
    head = (
      <MissionHead align="left">
        Post it. <span className="text-gold-700">Own it.</span>
      </MissionHead>
    );
    preview = (
      <ArtifactCard
        me={seed.me}
        title="My first practice watchlist"
        sub={`Day ${day.day_no} artifact`}
      >
        <div className="flex flex-wrap gap-2">
          {picks.map((k) => (
            <span
              key={k.ticker}
              style={PILL}
              className="f0-chip px-2.5 py-1 font-mono text-[12px] font-bold tracking-wide text-ink"
            >
              {k.ticker}
            </span>
          ))}
        </div>
        {why.trim() && (
          <p className="mt-3 border-l-2 border-[color:var(--accent-solid)] pl-3 text-[14px] leading-relaxed text-ink">
            &ldquo;{why.trim()}&rdquo;
          </p>
        )}
      </ArtifactCard>
    );
    extra = (
      <WhyField
        label="One line — why these five?"
        placeholder="Everything on this list is something my family actually used this week."
        value={why}
        onChange={setWhy}
      />
    );
    ready = picks.length > 0 && why.trim().length >= 8;
    cta = `Post to the feed · done for Day ${day.day_no}`;
    build = () => ({
      body: `My first practice watchlist: ${picks
        .map((k) => `$${k.ticker}`)
        .join(", ")} — ${why.trim()}`,
      ticker: picks[0]?.ticker ?? null,
      company: picks[0]?.company ?? null,
      payload: { picks, why: why.trim() },
    });
  }

  if (day.day_no === 2) {
    const p = (payload ?? { ticker: "", answers: {} }) as Day2Payload;
    const answers = p.answers ?? {};
    head = (
      <MissionHead align="left">
        Your research card <span className="text-gold-700">is an opinion now</span>
      </MissionHead>
    );
    preview = (
      <ArtifactCard
        me={seed.me}
        title={`${p.ticker} · Research card`}
        sub={`${RESEARCH_QUESTIONS.filter((q) => answers[q.key]).length} of 4 questions · your words`}
      >
        <div className="space-y-2">
          {RESEARCH_QUESTIONS.map((q) =>
            answers[q.key] ? (
              <p key={q.key} className="text-[14px] leading-relaxed text-ink">
                <Check className="mr-1 inline h-3.5 w-3.5 text-gold-700" aria-hidden />
                <span className="font-display font-bold">{q.short}: </span>
                &ldquo;{answers[q.key]}&rdquo;
              </p>
            ) : null
          )}
        </div>
      </ArtifactCard>
    );
    extra = (
      <Panel label="So — where do you land?">
        <div role="radiogroup" aria-label="Your call" className="grid grid-cols-3 gap-2">
          {STANCES.map((s) => {
            const on = stance === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setStance(s)}
                className={`f0-chip f0-focus f0-press py-2.5 font-display text-[14px] ${
                  on ? "font-extrabold text-ink" : "font-bold text-soft hover:text-ink"
                }`}
                style={
                  on
                    ? {
                        ...PILL,
                        boxShadow: "inset 0 0 0 1px var(--sentiment-fill)",
                        backgroundColor:
                          "color-mix(in srgb, var(--sentiment-fill) 14%, transparent)",
                      }
                    : PILL
                }
              >
                {STANCE_LABEL[s]}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-soft">
          This goes on the card as your call on the day you made it. Nobody grades
          it — the point is that it is written down and dated.
        </p>
      </Panel>
    );
    ready = Boolean(p.ticker) && Object.keys(answers).length > 0 && Boolean(stance);
    cta = `Post my card · done for Day ${day.day_no}`;
    build = () => ({
      body: `My research card on $${p.ticker} — ${STANCE_LABEL[stance ?? "neutral"]}.\n\n${RESEARCH_QUESTIONS.filter(
        (q) => answers[q.key]
      )
        .map((q) => `${q.short}: ${answers[q.key]}`)
        .join("\n")}`,
      ticker: p.ticker || null,
      company: p.company ?? null,
      payload: { ...p, stance },
    });
  }

  if (day.day_no === 3) {
    const p = (payload ?? { votes: [] }) as Day3Payload;
    const votes = p.votes ?? [];
    /* THE COHORT PICK is whichever name the room has cast the most votes on —
       counted from real Day-3 artifacts. Below the floor there is no pick to
       announce, and the board says so instead of crowning a name on two votes. */
    const top = cohortPick;
    script = "the room has spoken";
    head = top ? (
      <MissionHead align="left">
        Cohort pick:{" "}
        <Ticker symbol={top.ticker} variant="chip" size="lg" tone="family" />
      </MissionHead>
    ) : (
      <MissionHead align="left">
        Your votes are <span className="text-gold-700">in</span>
      </MissionHead>
    );
    preview = top ? (
      <Panel>
        <div className="flex items-center gap-5">
          <Dial
            pct={top.bullPct}
            value={`${top.bullPct}%`}
            unit="bullish"
            tone="sentiment"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="font-mono text-[13px] font-semibold tabular-nums text-soft">
              {top.votes.toLocaleString()} votes cast
            </p>
            <p className="text-[14px] text-soft">
              Your vote:{" "}
              <span className="font-display font-bold text-ink">
                {votes.find((v) => v.ticker === top.ticker)
                  ? STANCE_LABEL[votes.find((v) => v.ticker === top.ticker)!.stance]
                  : "not cast"}
              </span>
            </p>
            <p className="text-[14px] text-soft">
              Tracked until{" "}
              <span className="font-display font-bold text-ink">the week ends</span>
            </p>
          </div>
        </div>
      </Panel>
    ) : (
      <Panel label="Your calls">
        <div className="f0-ledger">
          {votes.map((v) => (
            <div key={v.ticker} className="f0-ledger-row justify-between">
              <span className="font-mono text-[14px] font-bold tracking-wide text-ink">
                {v.ticker}
              </span>
              <span className="font-display text-[13px] font-bold text-sentiment">
                {STANCE_LABEL[v.stance]}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-soft">
          A cohort pick gets announced once {SOCIAL_FLOORS.debateStance} members
          have voted on the same name. Until then these are your calls, on the
          record, dated.
        </p>
      </Panel>
    );
    extra = (
      <WhyField
        label="Your take — the one you would defend"
        placeholder="I'm the other way on this one, and here is what would change my mind."
        value={why}
        onChange={setWhy}
      />
    );
    ready = votes.length > 0 && why.trim().length >= 8;
    cta = `Post my take · done for Day ${day.day_no}`;
    build = () => ({
      body: `My calls on the room's watchlist: ${votes
        .map((v) => `$${v.ticker} ${STANCE_LABEL[v.stance].toLowerCase()}`)
        .join(", ")}.\n\n${why.trim()}`,
      ticker: votes[0]?.ticker ?? null,
      company: votes[0]?.company ?? null,
      payload: { votes, take: why.trim() },
    });
  }

  if (day.day_no === 4) {
    const p = (payload ?? {}) as Day4Payload;
    script = "first find, first trade";
    head = (
      <MissionHead align="left">
        You found one <span className="text-gold-700">nobody showed you</span>
      </MissionHead>
    );
    preview = (
      <ArtifactCard
        me={seed.me}
        title={`${p.ticker ?? "—"} · Practice position`}
        sub={`Found via the screener · Day ${day.day_no} artifact`}
        badge="PAPER"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-mono text-[16px] font-bold tabular-nums text-ink">
              {fmtUsd(p.size ?? null)}
            </p>
            <p className="mt-1 text-[10px] font-display font-bold uppercase tracking-[0.12em] text-soft">
              Practice size
            </p>
          </div>
          <div>
            <p className="font-mono text-[16px] font-bold tabular-nums text-ink">
              {fmtUsd(p.entry ?? null)}
            </p>
            <p className="mt-1 text-[10px] font-display font-bold uppercase tracking-[0.12em] text-soft">
              Last close
            </p>
          </div>
        </div>
        {p.reason && (
          <p className="mt-3 border-l-2 border-[color:var(--accent-solid)] pl-3 text-[14px] leading-relaxed text-ink">
            &ldquo;{p.reason}&rdquo;
          </p>
        )}
        <p className="mt-3 font-mono text-[12px] text-soft">
          {p.filters?.length ?? 0} filters · {p.matches ?? 0} matched · you took one
        </p>
      </ArtifactCard>
    );
    ready = Boolean(p.ticker);
    cta = `Share the trade card · done for Day ${day.day_no}`;
    build = () => ({
      body: `Found via my own screen: $${p.ticker} — practice position, ${fmtUsd(
        p.size ?? null
      )} paper.\n\n"${p.reason}"`,
      ticker: p.ticker ?? null,
      company: p.company ?? null,
      payload: { ...p },
    });
  }

  if (day.day_no === 5) {
    const p = (payload ?? { loop: [], total_minutes: 0 }) as Day5Payload;
    const artifacts = Object.keys(seed.mine).length;
    script = "that's five for five";
    head = (
      <MissionHead align="left">
        Finisher <span className="text-gold-700">unlocked</span>
      </MissionHead>
    );
    preview = (
      <ArtifactCard
        me={seed.me}
        title={`${state.cohort.name} finisher`}
        sub={`${doneCount} of ${state.days.length} days`}
        trophy
      >
        <div className="grid grid-cols-3 gap-3">
          <FinisherStat value={`${state.xp.toLocaleString()}`} label="XP" />
          <FinisherStat value={`${artifacts}`} label="Artifacts" />
          <FinisherStat
            value={state.streak > 0 ? `${state.streak}` : "—"}
            label="Day streak"
          />
        </div>
        {p.loop?.length > 0 && (
          <p className="mt-3 text-[13px] leading-relaxed text-soft">
            The loop: {p.loop.map((l) => l.label).join(" · ")} —{" "}
            {p.total_minutes} minutes a week.
          </p>
        )}
      </ArtifactCard>
    );
    ready = (p.loop?.length ?? 0) > 0;
    cta = "Post my finisher card";
    build = () => ({
      body: `Five for five. My weekly loop: ${p.loop
        .map((l) => l.label)
        .join(" · ")} — ${p.total_minutes} minutes a week, starting Monday.`,
      ticker: null,
      company: null,
      payload: { ...p },
    });
  }

  const cohortStrip = useMemo(() => {
    if (seed.cohort.length === 0) return null;
    return (
      <section className="space-y-3">
        <p className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-soft">
          What the cohort made
        </p>
        <div className="f0-ledger">
          {seed.cohort.slice(0, 6).map((a) => (
            <div key={a.userId} className="f0-ledger-row justify-between gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-sand font-display text-[11px] font-bold uppercase text-ink">
                {a.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  a.name.slice(0, 2)
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[14px] font-bold text-ink">
                  {a.name}
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-soft">
                  {a.tickers.length > 0 ? a.tickers.join(", ") : (a.body ?? "").slice(0, 80)}
                </span>
              </span>
            </div>
          ))}
        </div>
        {seed.postedCount != null && seed.postedCount > seed.cohort.length && (
          <p className="text-[13px] text-soft">
            {seed.postedCount.toLocaleString()} members have posted this day&rsquo;s
            artifact.
          </p>
        )}
      </section>
    );
  }, [seed.cohort, seed.postedCount]);

  return (
    <div className="f0-stagger space-y-7">
      {script && <ScriptLine>{script}</ScriptLine>}
      {head}

      {preview}
      {extra}

      {rewards}

      {day.day_no === 3 && (
        <Note>
          After tonight&rsquo;s session we&rsquo;ll show you the one way to keep
          all of this going. No card, no countdown on this screen — just the
          options, once you&rsquo;ve posted.
        </Note>
      )}

      {cohortStrip}

      <Note>
        Posting puts this in the community feed where every member can read it.
        Education, not financial advice — nothing here is a recommendation to buy
        or sell anything.
      </Note>

      {error && <ErrorLine>{error}</ErrorLine>}

      <MissionFooter>
        <MissionButton
          onClick={() => build && onPost(build())}
          disabled={!ready}
          busy={busy}
        >
          {ready ? cta : "Finish the step above first"}
          {ready && (
            <span className="font-mono text-[13px] opacity-80">
              · +{day.xp_award} XP
            </span>
          )}
        </MissionButton>
      </MissionFooter>
    </div>
  );
}

/* ── the artifact card ────────────────────────────────────────────────────
   The drawn object of the whole canvas: a named card with the member on it. It
   is a card, deliberately — the owner re-permitted them for this surface, and
   an artifact is exactly the case a card is FOR (a bounded thing you made, which
   then goes and sits somewhere else). */
function ArtifactCard({
  me,
  title,
  sub,
  badge,
  trophy,
  children,
}: {
  me: { name: string; avatar: string | null };
  title: string;
  sub: string;
  badge?: string;
  trophy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-sand bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-sand font-display text-[13px] font-bold uppercase text-ink">
          {me.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            me.name.slice(0, 2)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[16px] font-extrabold text-ink">{title}</p>
          <p className="mt-0.5 text-[13px] text-soft">
            {me.name} · {sub}
          </p>
        </div>
        {badge && (
          <span
            style={PILL}
            className="f0-chip f0-chip-accent shrink-0 px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.1em] text-gold-700"
          >
            {badge}
          </span>
        )}
        {trophy && <Trophy className="h-5 w-5 shrink-0 text-gold-700" aria-hidden />}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function FinisherStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-[19px] font-extrabold tabular-nums text-ink">
        {value}
      </p>
      <p className="mt-1 text-[10px] font-display font-bold uppercase tracking-[0.12em] text-soft">
        {label}
      </p>
    </div>
  );
}

function WhyField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-eyebrow font-display font-bold uppercase tracking-[0.16em] text-soft">
        {label}
      </span>
      <textarea
        rows={3}
        maxLength={500}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="f0-focus mt-2 w-full resize-none rounded-lg bg-sand/50 px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-soft/70"
      />
    </label>
  );
}

/** The cohort pick + its split, counted from real votes. Null below the floor. */
function useCohortPick(
  seed: DaySeed,
  myVotes: Day3Payload["votes"]
): { ticker: string; votes: number; bullPct: number } | null {
  return useMemo(() => {
    let best: { ticker: string; votes: number; bullPct: number } | null = null;
    for (const r of seed.room) {
      const mine = myVotes.find((v) => v.ticker === r.ticker);
      const votes = r.votes + (mine ? 1 : 0);
      const bull = r.bull + (mine?.stance === "bull" ? 1 : 0);
      if (votes < SOCIAL_FLOORS.debateStance) continue;
      const bullPct = Math.round((bull / votes) * 100);
      if (!best || votes > best.votes) best = { ticker: r.ticker, votes, bullPct };
    }
    return best;
  }, [seed.room, myVotes]);
}
