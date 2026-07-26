"use client";

import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { ObjectCard } from "@/components/grammar";
import type { Register } from "@/lib/register";
import { worldLabel, type Journey } from "@/lib/learn/worlds";

/**
 * ContinueYourPath — the large "resume" object on Learn Home (spec §3): current
 * world, overall %, and the next lesson with its time + XP. It IS a persistent
 * object (a lesson to resume) so it earns an ObjectCard with the register accent
 * spine — the one place containment is sanctioned. Deep-links to the path's
 * current node; falls back to the map when the member is all caught up.
 */
export default function ContinueYourPath({
  journey,
  register,
}: {
  journey: Journey;
  register: Register;
}) {
  const current = journey.current;
  const world = journey.worlds[journey.currentWorldIndex]?.world ?? null;
  const worldName = world ? worldLabel(world, register) : "Your journey";

  // Caught up — no current lesson.
  if (!current) {
    return (
      <ObjectCard accent="accent" className="flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent-solid)_14%,transparent)] text-[var(--accent-strong)]">
          <PlayCircle className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-strong)]">
            {worldName}
          </p>
          <p className="font-display text-lg font-bold text-ink">
            {register === "kid" ? "You did it all!" : "You're all caught up"}
          </p>
          <p className="text-[13px] text-soft">
            Every lesson so far is done. Practice a skill or review what's due.
          </p>
        </div>
      </ObjectCard>
    );
  }

  return (
    <ObjectCard href={current.href ?? "/learn"} accent="accent" className="group">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--accent-solid)] text-white shadow-[var(--shadow-lift)]">
          <PlayCircle className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-strong)]">
            {register === "kid" ? "Keep playing" : "Continue your path"} · {worldName}
          </p>
          <p className="truncate font-display text-lg font-bold text-ink">
            {current.title}
          </p>
          <p className="text-[13px] text-soft">{current.meta}</p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-[var(--accent-strong)] transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
      </div>

      {/* Overall journey progress — a thin, honest bar (not a boxed metric). */}
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
          <div
            className="h-full rounded-full bg-[var(--accent-solid)] transition-[width] duration-500 ease-out"
            style={{ width: `${journey.pct}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-soft">
          {journey.doneLessons}/{journey.totalLessons} · {journey.pct}%
        </span>
      </div>
      <p className="sr-only">
        <Link href="/learn#map">Jump to your journey map</Link>
      </p>
    </ObjectCard>
  );
}
