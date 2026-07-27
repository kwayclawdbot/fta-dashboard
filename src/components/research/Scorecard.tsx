"use client";

/**
 * Scorecard (Lane 9 · D1 redesign) — the app's signature VERDICT object.
 *
 * D1 lifts the gauge OUT of its own card so it can be the page masthead. The
 * component now renders presentation-only fragments; the research page supplies
 * the single containing surface (the masthead) so nothing is a card-in-a-card.
 *
 *   mode="summary" → hero VERDICT GAUGE + four LETTER-GRADE rings + tap-to-expand
 *                    checks. Rendered BARE (no card) — the masthead wraps it.
 *   mode="detail"  → Strengths / Weaknesses as a two-column editorial LEDGER
 *                    (✓/✗ on hairline rows, no inner boxes) + upsell. Bare.
 *   mode="full"    → both, inside one card (legacy single-scroll layout).
 *
 * Free tier (WSZ pattern): rings + gauge stay VISIBLE (tease the read) but the
 * detail sentences lock behind an upgrade line. Kids NEVER see a lock.
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

/* COLOUR LAW: green and red mean PRICE on this product, nowhere else. A passed
   or failed CHECK is not a price move, so the glyph carries the meaning and the
   weight carries the emphasis — ink for a pass, soft for a miss. */
function CheckIcon({ status }: { status: "pass" | "fail" | "neutral" }) {
  if (status === "pass") return <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink" />;
  if (status === "fail") return <Minus className="mt-0.5 h-4 w-4 shrink-0 text-soft" />;
  return <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-soft/60" />;
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

  const summaryBlock = (
    <>
      <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[minmax(0,248px)_1fr] sm:gap-8">
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

      {/* Tap-to-expand checks for the selected dimension — a hairline disclosure,
          not a boxed card, so the masthead stays one clean surface. */}
      {active && activeDim && (
        <m.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-5 overflow-hidden border-t border-sand pt-4"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-ink">
              {DIM_LABEL[activeDim.dimension]} — the checks
            </h3>
            <button onClick={() => setActive(null)} className="text-soft hover:text-ink" aria-label="Collapse">
              <ChevronDown className="h-4 w-4 rotate-180" />
            </button>
          </div>
          <p className="mb-3 text-xs text-soft">{DIM_WHY[activeDim.dimension]}</p>
          {!activeDim.sufficient ? (
            <p className="text-sm text-soft">
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
  );

  const detailBlock = (
    <>
      <div className="grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <LedgerColumn
          title="What's strong"
          tone="pass"
          items={grades.strengths}
          locked={locked}
          emptyText="No standout strengths from the data we have."
        />
        <LedgerColumn
          title="What's weak"
          tone="fail"
          items={grades.weaknesses}
          locked={locked}
          emptyText="No notable weaknesses from the data we have."
        />
      </div>
      {locked && upsell}
    </>
  );

  // Bare fragments — the page (masthead / editorial section) supplies the surface.
  if (mode === "summary") return summaryBlock;
  if (mode === "detail") return <div className="space-y-4">{detailBlock}</div>;

  // Legacy single-card layout.
  return (
    <section className="space-y-5 rounded-2xl border border-sand bg-midnight-900 p-5 shadow-soft">
      {summaryBlock}
      {detailBlock}
    </section>
  );
}

/** One column of the Strengths / Weaknesses ledger — hairline rows, no box. */
function LedgerColumn({
  title,
  tone,
  items,
  locked,
  emptyText,
}: {
  title: string;
  tone: "pass" | "fail";
  items: string[];
  locked: boolean;
  emptyText: string;
}) {
  const shown = locked ? items.slice(0, 1) : items;
  return (
    <div>
      <h3 className="mb-1 flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-soft">
        {tone === "pass" ? (
          <Check className="h-3.5 w-3.5 text-ink" />
        ) : (
          <Minus className="h-3.5 w-3.5 text-soft" />
        )}
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="py-2.5 text-xs text-soft">{emptyText}</p>
      ) : (
        <ul>
          {shown.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 border-b border-sand py-2.5 text-[13px] leading-snug text-midnight-200"
            >
              <CheckIcon status={tone} />
              <span>{s}</span>
            </li>
          ))}
          {locked && items.length > 1 && (
            <li className="flex items-center gap-1.5 py-2.5 text-xs text-soft">
              <Lock className="h-3 w-3" />
              {items.length - 1} more — join the Club to read the full breakdown
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
