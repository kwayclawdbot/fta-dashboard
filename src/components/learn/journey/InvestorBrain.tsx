"use client";

import { Brain } from "lucide-react";
import { EditorialSection } from "@/components/grammar";
import type { Register } from "@/lib/register";
import type { BrainSkill } from "@/lib/learn/journey";

/**
 * InvestorBrain — the "YOUR INVESTOR BRAIN" mastery bars (FIC-LEARNING-WORLD §7).
 * One bar per skill, mastery from skill_mastery (deterministic, zero LLM). Grouped
 * by domain on the open canvas; skills the member has touched surface first so the
 * brain reads as "what you know", not a flat 15-row list. Empty until learning
 * starts.
 */

const DOMAIN_LABEL: Record<string, string> = {
  business: "Business",
  markets: "Markets",
  technical: "Charts",
  risk: "Risk",
  psychology: "Mindset",
};

function barColor(m: number): string {
  if (m >= 70) return "bg-green-500";
  if (m >= 30) return "bg-[var(--accent-solid)]";
  return "bg-[var(--accent-strong)]";
}

export default function InvestorBrain({
  skills,
  register,
}: {
  skills: BrainSkill[];
  register: Register;
}) {
  const started = skills.some((s) => s.attempts > 0 || s.mastery > 0);

  // Touched skills first, then the rest — a live picture of what's forming.
  const ordered = [...skills].sort((a, b) => {
    if (b.mastery !== a.mastery) return b.mastery - a.mastery;
    return b.attempts - a.attempts;
  });

  return (
    <EditorialSection
      title={
        <span className="inline-flex items-center gap-2">
          <Brain className="h-5 w-5 text-[var(--accent-strong)]" />
          {register === "kid" ? "Your brain" : "Your investor brain"}
        </span>
      }
      lead={
        started
          ? register === "kid"
            ? "Watch your skills grow!"
            : "Mastery grows as you learn and review — weak skills come back for review."
          : undefined
      }
    >
      {!started ? (
        <p className="text-sm text-soft">
          Start a lesson and your skills begin to fill in here — one bar for each
          concept you're building.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {ordered.map((s) => (
            <div key={s.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {s.name}
                  </p>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-soft">
                    {DOMAIN_LABEL[s.domain] ?? s.domain}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ease-out ${barColor(
                      s.mastery
                    )}`}
                    style={{ width: `${Math.max(s.mastery, s.attempts > 0 ? 6 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </EditorialSection>
  );
}
