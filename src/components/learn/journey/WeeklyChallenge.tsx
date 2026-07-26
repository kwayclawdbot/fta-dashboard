"use client";

import { ArrowRight, CalendarDays } from "lucide-react";
import { ObjectCard, StatusChip } from "@/components/grammar";
import type { Register } from "@/lib/register";
import type { FicWeek } from "@/lib/fic";

/**
 * WeeklyChallenge — the "This Week in the Club" world event (FIC-LEARNING-WORLD
 * §9), rendered ONLY when a current week exists (graceful absent otherwise). One
 * company, every register at its level. It's a persistent live object → ObjectCard
 * with the SUPPORTING accent (teal), the one secondary signal on the page.
 */
export default function WeeklyChallenge({
  week,
  register,
}: {
  week: FicWeek | null;
  register: Register;
}) {
  // Graceful absent-state: no published week, or no company of the week yet.
  if (!week || !week.company_name) return null;

  const prompt =
    register === "kid"
      ? `How does ${week.company_name} make money?`
      : register === "teen"
        ? `Is ${week.company_name} a Buy, Watch, or Pass?`
        : week.cotw_discussion_question ||
          `Why does ${week.company_name} earn its valuation?`;

  return (
    <ObjectCard href="/dashboard?tab=this-week" accent="support" className="group">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-400/15 text-teal-700">
          <CalendarDays className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
              This week in the Club
            </p>
            <StatusChip tone="support">
              {week.company_ticker || week.company_name}
            </StatusChip>
          </div>
          <p className="truncate font-display text-lg font-bold text-ink">
            {prompt}
          </p>
          <p className="truncate text-[13px] text-soft">
            {week.class_title} · answer with the whole Club
          </p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-teal-700 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
      </div>
    </ObjectCard>
  );
}
