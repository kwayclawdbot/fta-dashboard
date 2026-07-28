"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, RotateCcw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { loadDueReview, recordSkillReview, type DueReview, type DueSkill } from "@/lib/review";
import { BoardSection } from "@/components/clubhome/board";

/**
 * TODAY'S REVIEW — the surface that finally reads the scheduler.
 *
 * `skill_mastery.next_review_at` has been maintained on every lesson
 * interaction since migration 166 and read by NOTHING. The app has known, per
 * member, exactly which concepts were about to fade, and had no way to say so.
 * This is that section: the concepts whose review date has arrived, each with
 * the mastery the member actually has on it and the lesson that taught it.
 *
 * THE ANSWER GOES BACK DOWN THE EXISTING PATH. "Still got it" / "Not yet" calls
 * `bump_skill_mastery` — the same SECURITY DEFINER RPC the LessonEngine calls —
 * so mastery moves and the next review is scheduled by one set of rules. There
 * is no second scheduler here and no second definition of "due".
 *
 * IT IS A SELF-CHECK, NOT A QUIZ. We do not have an authored prompt per skill
 * outside its lesson, and inventing one would be inventing content. So the
 * honest object is the one a spaced-repetition system is actually built on:
 * name the concept, ask whether you can still explain it, and let the answer
 * drive the schedule. "Not yet" pulls the concept back inside a day AND hands
 * over the lesson link.
 *
 * CARDS SIT ON TOP because they already have a real drill behind them — the
 * count is the live `flashcard_reviews` queue and the button runs it.
 *
 * NO CLOCK IN RENDER: `Date.now()` is read once in the load effect and passed
 * into the query builder.
 */

function relDue(dueIso: string, nowMs: number): string {
  const t = Date.parse(dueIso);
  if (!Number.isFinite(t)) return "due";
  const days = Math.floor((nowMs - t) / 86_400_000);
  if (days <= 0) return "due today";
  if (days === 1) return "due since yesterday";
  return `due ${days} days ago`;
}

function SkillRow({
  skill,
  nowMs,
  onAnswer,
}: {
  skill: DueSkill;
  nowMs: number;
  onAnswer: (skillId: string, correct: boolean) => Promise<boolean>;
}) {
  const [state, setState] = useState<"open" | "busy" | "kept" | "queued" | "failed">("open");

  async function answer(correct: boolean) {
    setState("busy");
    const ok = await onAnswer(skill.skillId, correct);
    setState(ok ? (correct ? "kept" : "queued") : "failed");
  }

  return (
    <div className="club-b-card px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] font-bold text-ink">{skill.name}</p>
        <p className="shrink-0 font-mono text-[10.5px] font-semibold tabular-nums text-soft">
          {skill.mastery}%
        </p>
      </div>
      <p className="mt-0.5 text-[11px] text-soft">
        {relDue(skill.dueAt, nowMs)}
        {skill.domain ? ` · ${skill.domain}` : ""}
      </p>

      {state === "kept" ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-ink">
          <Check className="h-3.5 w-3.5 text-accent" aria-hidden />
          Held. Kai pushed this one further out.
        </p>
      ) : state === "queued" ? (
        <p className="mt-2 text-[11.5px] text-soft">
          Back within a day.{" "}
          {skill.lessonHref ? (
            <Link href={skill.lessonHref} className="f0-focus font-semibold text-accent">
              Re-read {skill.lessonTitle}
            </Link>
          ) : (
            "No lesson is mapped to this one yet."
          )}
        </p>
      ) : (
        <div className="mt-2.5 flex items-center gap-1.5">
          <button
            type="button"
            disabled={state === "busy"}
            onClick={() => void answer(true)}
            className="f0-focus f0-press rounded-full bg-accent px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[color:var(--accent-on)] disabled:opacity-60"
          >
            Still got it
          </button>
          <button
            type="button"
            disabled={state === "busy"}
            onClick={() => void answer(false)}
            className="club-b-chip f0-focus f0-press rounded-full px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink disabled:opacity-60"
          >
            Not yet
          </button>
          {state === "failed" && (
            <span className="text-[11px] text-soft">That didn&rsquo;t save — try again.</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function TodaysReview({
  userId,
  /** Runs the due flashcard set. Supplied by the flashcards surface. */
  onStartCards,
  starting = false,
}: {
  userId: string;
  onStartCards?: () => void;
  starting?: boolean;
}) {
  const [data, setData] = useState<DueReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(0);

  const supabase = createClient();

  const load = useCallback(async () => {
    if (!userId) return;
    const now = Date.now();
    setNowMs(now);
    try {
      const res = await loadDueReview(supabase, userId, now);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = useCallback(
    (skillId: string, correct: boolean) => recordSkillReview(supabase, skillId, correct),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (loading) {
    return (
      <BoardSection id="todays-review" label="Today's" mark="review">
        <div className="mt-2.5 flex flex-col gap-[7px]" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="club-b-card px-3.5 py-3 motion-safe:animate-pulse">
              <div className="h-2.5 w-2/5 rounded-full bg-ink/10" />
              <div className="mt-2 h-2.5 w-1/4 rounded-full bg-ink/[0.07]" />
            </div>
          ))}
          <span className="sr-only">Loading what&rsquo;s due</span>
        </div>
      </BoardSection>
    );
  }

  if (!data) return null;

  const { cardsDue, skills } = data;

  return (
    <BoardSection
      id="todays-review"
      label="Today's"
      mark="review"
      sub="What the scheduler says you are about to forget."
    >
      <div className="mt-2.5 flex flex-col gap-[7px]">
        {cardsDue > 0 && (
          <div className="club-b-card flex items-center gap-2.5 px-3.5 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-ink">
                {cardsDue} card{cardsDue === 1 ? "" : "s"} past due
              </span>
              <span className="block text-[11px] text-soft">
                The recall drill you already have, on the cards that need it.
              </span>
            </span>
            {onStartCards ? (
              <button
                type="button"
                onClick={onStartCards}
                disabled={starting}
                className="f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[color:var(--accent-on)] disabled:opacity-60"
              >
                {starting ? "Dealing…" : "Run them"}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </button>
            ) : (
              <Link
                href="/flashcards"
                className="f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[color:var(--accent-on)]"
              >
                Run them
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            )}
          </div>
        )}

        {skills.map((s) => (
          <SkillRow key={s.skillId} skill={s} nowMs={nowMs} onAnswer={answer} />
        ))}

        {cardsDue === 0 && skills.length === 0 && (
          <div className="club-b-card px-3.5 py-3">
            <p className="text-[13px] font-bold text-ink">Nothing is due</p>
            <p className="mt-1 max-w-[52ch] text-[11.5px] leading-relaxed text-soft">
              Every concept you have practised is scheduled further out. As soon
              as one comes back around it appears here, before you have lost it.
            </p>
            <Link
              href="/courses"
              className="f0-focus f0-press mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-accent"
            >
              Learn something new
              <RotateCcw className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </BoardSection>
  );
}
