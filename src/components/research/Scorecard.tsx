"use client";

/**
 * Scorecard (Lane 9) — the anti-overload summary device the owner screenshots
 * mandate: a hero VERDICT GAUGE + four LETTER-GRADE rings (Value · Growth ·
 * Health · Momentum), then Ziggma-style Strengths / Weaknesses twin cards, then
 * a tap-to-expand checks panel per dimension.
 *
 * Free tier (WSZ pattern): rings + gauge stay VISIBLE (tease the read) but the
 * detail sentences lock behind an upgrade line. Kids NEVER see a lock — they get
 * the full, plainly-worded read.
 *
 * Tabs (Lane 11B): the page splits the scorecard across the layout —
 *   mode="summary" → gauge + rings + tap-to-expand checks (permanent hero area,
 *                    always visible above the tab row).
 *   mode="detail"  → Strengths / Weaknesses twin cards + upsell (Overview tab).
 *   mode="full"    → everything in one card (legacy single-scroll layout).
 */

import { useState } from "react";
import { Check, Minus, CircleDot, Lock, ChevronDown } from "lucide-react";
import { m } from "@/lib/motion";
import type { GradesResult, Dimension, DimensionGrade } from "@/lib/research/grades";
import { LetterGradeRing, VerdictGauge } from "@/components/research/GradeVisuals";

const DIM_LABEL: Record<Dimension, string> = {
  value: "Value",
  growth: "Growth",
  health: "Health",
  momentum: "Momentum",
};

const DIM_WHY: Record<Dimension, string> = {
  value: "Is the price reasonable for what the company earns and owns?",
  growth: "Is the business getting bigger and more profitable over time?",
  health: "Can the company pay its bills and weather a rough patch?",
  momentum: "Which way has the stock price been trending lately?",
};

function CheckIcon({ status }: { status: "pass" | "fail" | "neutral" }) {
  if (status === "pass") return <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />;
  if (status === "fail") return <Minus className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />;
  return <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-soft" />;
}

export default function Scorecard({
  grades,
  locked,
  upsell,
  mode = "full",
}: {
  grades: GradesResult;
  locked: boolean;
  /** Rendered where locked substance would be (research page passes UpsellCard). */
  upsell?: React.ReactNode;
  mode?: "full" | "summary" | "detail";
}) {
  const [active, setActive] = useState<Dimension | null>(null);
  const dims = grades.dimensions;
  const activeDim: DimensionGrade | undefined = dims.find((d) => d.dimension === active);

  const showSummary = mode === "full" || mode === "summary";
  const showDetail = mode === "full" || mode === "detail";

  const detailBlock = (
    <>
      {/* Strengths / Weaknesses twin cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TwinCard title="Strengths" tone="pass" items={grades.strengths} locked={locked} />
        <TwinCard title="Weaknesses" tone="fail" items={grades.weaknesses} locked={locked} />
      </div>
      {locked && upsell}
    </>
  );

  // Detail-only card (Overview tab): twin cards + upsell in their own container.
  if (mode === "detail") {
    return <section className="space-y-3">{detailBlock}</section>;
  }

  return (
    <section className="space-y-5 rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft">
      {showSummary && (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[220px_1fr] sm:items-center">
            <VerdictGauge
              gauge={grades.overall.gauge}
              label={grades.overall.label}
              letter={grades.overall.letter}
              graded={grades.overall.graded}
            />
            <div className="grid grid-cols-4 gap-1">
              {dims.map((d) => (
                <LetterGradeRing
                  key={d.dimension}
                  letter={d.letter}
                  label={DIM_LABEL[d.dimension]}
                  active={active === d.dimension}
                  onClick={() => setActive((a) => (a === d.dimension ? null : d.dimension))}
                />
              ))}
            </div>
          </div>

          {/* Tap-to-expand checks for the selected dimension */}
          {active && activeDim && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="overflow-hidden rounded-xl border border-sand bg-paper p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-ink">
                  {DIM_LABEL[activeDim.dimension]} — the checks
                </h3>
                <button onClick={() => setActive(null)} className="text-soft hover:text-ink">
                  <ChevronDown className="h-4 w-4 rotate-180" />
                </button>
              </div>
              <p className="mb-3 text-xs text-soft">{DIM_WHY[activeDim.dimension]}</p>
              {!activeDim.sufficient ? (
                <p className="rounded-lg border border-dashed border-sand px-3 py-4 text-center text-sm text-soft">
                  Not enough data to grade {DIM_LABEL[activeDim.dimension].toLowerCase()} for this
                  ticker — many small-caps and funds don&apos;t publish the numbers this needs.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {activeDim.checks.map((c) => (
                    <li key={c.key} className="flex items-start gap-2 text-[13px] leading-snug">
                      <CheckIcon status={c.status} />
                      {locked ? (
                        <span className="flex items-center gap-1.5 text-soft">
                          <span className="font-semibold text-ink">{c.label}</span>
                          <Lock className="h-3 w-3" />
                          <span className="text-xs">Join FIC to read why</span>
                        </span>
                      ) : (
                        <span className="text-midnight-200">{c.sentence}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </m.div>
          )}
        </>
      )}

      {showDetail && detailBlock}
    </section>
  );
}

function TwinCard({
  title,
  tone,
  items,
  locked,
}: {
  title: string;
  tone: "pass" | "fail";
  items: string[];
  locked: boolean;
}) {
  const shown = locked ? items.slice(0, 1) : items;
  return (
    <div className="rounded-xl border border-sand bg-paper p-4">
      <h3 className="mb-2.5 font-display text-sm font-bold text-ink">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-soft">
          {tone === "pass"
            ? "No standout strengths from the data we have."
            : "No notable weaknesses from the data we have."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-midnight-200">
              <CheckIcon status={tone} />
              <span>{s}</span>
            </li>
          ))}
          {locked && items.length > 1 && (
            <li className="flex items-center gap-1.5 text-xs text-soft">
              <Lock className="h-3 w-3" />
              {items.length - 1} more — join FIC to read the full breakdown
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
