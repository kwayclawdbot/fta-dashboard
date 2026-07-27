"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DisplayHead } from "@/components/f0/parts";
import { saveAnswer } from "@/lib/challenge/state";
import type { ChallengeQuestion, ChallengeState } from "@/lib/challenge/types";

/**
 * MINUTE 2 — get to know you. Four questions, one screen each, answered right
 * after signup so the HQ, the coach notes and Kai have something to work with.
 *
 * REAL WRITE: every answer goes to `challenge_answers` via
 * `challenge_save_answer()` the moment it is chosen — not batched at the end, so
 * a member who drops out at Q3 still leaves two answers behind. The +15 lands
 * exactly once, when the last required question is answered (ref
 * `challenge:questions` in the existing `xp_events` ledger).
 *
 * CONTROL: a `role="radiogroup"` of `.f0-chip`s with a ROVING TABINDEX — the
 * same keyboard model `SegmentedRail` ships (one tab stop, arrows move within
 * the group, Home/End jump). It is not `SegmentedRail` itself because that
 * primitive is a horizontal BAR and these answers are full sentences
 * ("Build a real watchlist & start investing confidently"); forced onto one axis
 * at 390px they are unreadable. Same semantics, stacked geometry.
 */

function ChipRadioGroup({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { key: string; label: string; emoji: string | null }[];
  value: string | null;
  onChange: (key: string) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const move = useCallback(
    (delta: number, from: number) => {
      const next = (from + delta + options.length) % options.length;
      onChange(options[next].key);
      const nodes = ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      nodes?.[next]?.focus();
    },
    [options, onChange]
  );

  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.key === value)
  );

  return (
    <div ref={ref} role="radiogroup" aria-label={ariaLabel} className="space-y-2.5">
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === activeIndex ? 0 : -1}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                e.preventDefault();
                move(1, i);
              } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                e.preventDefault();
                move(-1, i);
              } else if (e.key === "Home") {
                e.preventDefault();
                move(-i, i);
              } else if (e.key === "End") {
                e.preventDefault();
                move(options.length - 1 - i, i);
              }
            }}
            className={`f0-chip f0-focus f0-press flex w-full items-center gap-3 text-left ${
              on ? "f0-chip-on" : ""
            }`}
          >
            {o.emoji && (
              <span aria-hidden className="shrink-0 text-[17px] leading-none">
                {o.emoji}
              </span>
            )}
            <span className="min-w-0 flex-1 font-display text-[15px] font-bold text-ink">
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function QuestionsBoard({
  state,
  questions,
}: {
  state: ChallengeState;
  questions: ChallengeQuestion[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const [k, v] of Object.entries(state.answers || {})) {
      const val = v.answer_key ?? v.answer_text;
      if (val) seed[k] = val;
    }
    return seed;
  });
  const [index, setIndex] = useState(() => {
    const firstUnanswered = questions.findIndex(
      (q) => !(state.answers || {})[q.key]
    );
    return firstUnanswered === -1 ? 0 : firstUnanswered;
  });
  const [saving, setSaving] = useState(false);

  const q = questions[index];
  const total = questions.length;

  const choose = useCallback(
    (key: string) => {
      if (!q) return;
      setAnswers((a) => ({ ...a, [q.key]: key }));
      void saveAnswer(supabase, q.key, key, null);
    },
    [q, supabase]
  );

  const next = useCallback(async () => {
    if (!q) return;
    setSaving(true);
    if (q.kind === "text") {
      await saveAnswer(supabase, q.key, null, answers[q.key] ?? null);
    }
    setSaving(false);
    if (index + 1 < total) setIndex(index + 1);
    else router.push("/challenge/first-win");
  }, [q, answers, index, total, supabase, router]);

  if (!q) {
    return (
      <DisplayHead
        eyebrow="Get to know you"
        title="Nothing to"
        mark="answer"
        lede="The questionnaire isn't published yet. Head to your first win — it doesn't depend on this."
      />
    );
  }

  const answered = Boolean(answers[q.key]);
  const isLast = index + 1 === total;

  return (
    <div className="f0-stagger space-y-8">
      <div className="flex items-baseline justify-between">
        <p className="text-eyebrow font-display font-bold uppercase text-gold-700">
          So we can coach you right
        </p>
        <p className="font-mono text-[13px] font-semibold tabular-nums text-soft">
          {index + 1}/{total}
        </p>
      </div>

      <DisplayHead title={q.prompt} lede={q.helper ?? undefined} />

      {q.kind === "choice" ? (
        <ChipRadioGroup
          options={q.options}
          value={answers[q.key] ?? null}
          onChange={choose}
          ariaLabel={q.prompt}
        />
      ) : (
        <label className="block">
          <span className="sr-only">{q.prompt}</span>
          <textarea
            rows={4}
            maxLength={2000}
            value={answers[q.key] ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
            placeholder="In your own words…"
            className="f0-focus w-full resize-none rounded-lg bg-sand/50 px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-soft/70"
          />
        </label>
      )}

      <div className="f0-rule-top flex items-center justify-between gap-4 pt-5">
        <button
          type="button"
          onClick={() => (isLast ? void next() : setIndex(Math.min(total - 1, index + 1)))}
          className="f0-focus font-display text-[14px] font-bold text-soft transition-colors hover:text-ink"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => void next()}
          disabled={saving || (q.required && q.kind === "choice" && !answered)}
          className="cta-button f0-focus f0-press inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] disabled:opacity-45"
        >
          {isLast ? "Start my first win" : "Next"}
          {isLast && (
            <span className="font-mono text-[13px] opacity-80">· +15 XP</span>
          )}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <p className="text-[13px] text-soft">
        Your answers tune your HQ, your lessons and what Kai suggests. They are
        never shared with other members.
      </p>
    </div>
  );
}
