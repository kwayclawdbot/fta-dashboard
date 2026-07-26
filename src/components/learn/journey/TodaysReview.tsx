"use client";

import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import { EditorialSection, StatusChip } from "@/components/grammar";
import type { Register } from "@/lib/register";

/**
 * TodaysReview — the spaced-repetition surface (FIC-LEARNING-WORLD §7). Shows the
 * count of due concepts (flashcard_reviews / skill_mastery) and a 2-minute quick
 * review flow. Graceful all-caught-up state when nothing is due.
 */
export default function TodaysReview({
  dueCount,
  register,
}: {
  dueCount: number;
  register: Register;
}) {
  if (dueCount <= 0) {
    return (
      <EditorialSection title={register === "kid" ? "Quick review" : "Today's review"}>
        <p className="text-sm text-soft">
          {register === "kid"
            ? "Nothing to review right now. Come back tomorrow!"
            : "You're caught up on reviews. New concepts return here as you learn."}
        </p>
      </EditorialSection>
    );
  }

  return (
    <EditorialSection
      title={register === "kid" ? "Quick review" : "Today's review"}
      action={<StatusChip tone="accent">{dueCount} due</StatusChip>}
    >
      <Link
        href="/flashcards"
        className="group flex items-center gap-4 rounded-2xl border border-sand bg-paper px-4 py-3.5 transition-[transform,border-color] duration-150 ease-out hover:border-[var(--accent-strong)] active:scale-[0.99]"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent-solid)_14%,transparent)] text-[var(--accent-strong)]">
          <RotateCcw className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-ink">
            {dueCount} concept{dueCount === 1 ? "" : "s"} to lock in
          </p>
          <p className="text-[12px] text-soft">
            2-minute review · correct raises mastery, wrong brings it back sooner.
          </p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-[var(--accent-strong)] transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
      </Link>
    </EditorialSection>
  );
}
