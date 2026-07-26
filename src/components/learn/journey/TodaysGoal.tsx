"use client";

import Link from "next/link";
import { Check, BookOpen, Dumbbell, Compass } from "lucide-react";
import { EditorialSection } from "@/components/grammar";
import type { Register } from "@/lib/register";
import type { DailyGoalItem } from "@/lib/learn/journey";

/**
 * TodaysGoal — the brutally-obvious daily loop (FIC-LEARNING-WORLD §8):
 * 0/3 = 1 Learn · 1 Practice · 1 Apply, from real state. Streak counts any item;
 * 3/3 = bonus XP (awarded + celebrated by the orchestrator). Rendered as three
 * tappable segments on the open canvas — a progress tracker, not a boxed grid.
 */

const ICONS = { learn: BookOpen, practice: Dumbbell, apply: Compass } as const;

export default function TodaysGoal({
  items,
  completedCount,
  register,
}: {
  items: DailyGoalItem[];
  completedCount: number;
  register: Register;
}) {
  const allDone = completedCount === 3;
  return (
    <EditorialSection
      title={register === "kid" ? "Today's mission" : "Today's goal"}
      action={
        <span
          className={`font-display text-sm font-bold ${
            allDone ? "text-green-700" : "text-[var(--accent-strong)]"
          }`}
        >
          {completedCount}/3{allDone ? " · +20 XP" : ""}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = ICONS[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.98] ${
                item.done
                  ? "bg-[color-mix(in_srgb,var(--accent-solid)_12%,transparent)]"
                  : "border border-sand bg-paper hover:border-[var(--accent-strong)]"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                  item.done
                    ? "bg-[var(--accent-solid)] text-white"
                    : "bg-sand/60 text-[var(--accent-strong)]"
                }`}
              >
                {item.done ? (
                  <Check className="h-5 w-5" strokeWidth={2.6} />
                ) : (
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={`font-display text-sm font-bold ${
                    item.done ? "text-[var(--accent-strong)] line-through decoration-2" : "text-ink"
                  }`}
                >
                  {item.label}
                </p>
                <p className="truncate text-[11px] text-soft">{item.hint}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </EditorialSection>
  );
}
