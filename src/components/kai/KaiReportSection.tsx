"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { PriceChart, RevenueChart } from "@/components/kai/ReportCharts";
import { Card, CardLabel } from "@/components/research/board";
import {
  toParagraphs,
  KAI_REPORT_DISCLAIMER,
  type KaiReport,
} from "@/lib/kai/report";

/**
 * KAI RESEARCH REPORT — the long body under board 14's head.
 *
 * KaiReportPanel draws the board's own composition (the tinted Kai field with
 * the headline and the coverage ring, three signal cards, the warm "what would
 * change the read" field and the action bar) and then mounts this for the rest
 * of the written report: the charts, the moat and thesis, the kids explainer,
 * the family questions, the sources and the compliance line. It renders with
 * `showHead={false}` there, because the field above already carries the
 * headline and the timestamp.
 *
 * WHAT THE CANVAS DRAWS AND THIS DELIBERATELY DOES NOT:
 *   • "Kai's verdict — ACCUMULATE". The app never renders a directive verdict.
 *     Kai's read is the HEADLINE — a sentence, in the model's own words.
 *   • "Call flow surged 3.1× — sweeps at the 180–185 strikes." Options content
 *     is not shipped in Club surfaces; this is an equities-only club.
 *
 * The blocks below are CARDS, matching the owner's mockup — an earlier pass
 * reinterpreted them as hairline rules and section marks, and the owner
 * rejected that reading.
 *
 * COLOUR LAW: Kai blue is the ONLY chrome colour in here — the eyebrow, the
 * risk numerals, the question numerals. Green and red appear only inside the
 * price/financial charts, which are price.
 *
 * The model writes `sections` (prose) and NEVER draws — the charts render the
 * stored `data` block, so the numbers can't drift from the analysis around them.
 */

function Paras({ text }: { text: string }) {
  const paras = toParagraphs(text);
  if (paras.length === 0) return null;
  return (
    <div className="space-y-3.5">
      {paras.map((p, i) => (
        <p key={i} className="text-[14.5px] leading-relaxed text-midnight-200">
          {p}
        </p>
      ))}
    </div>
  );
}

/** Section block — one card per part of the report, as the board draws it. */
function Block({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card radius="md" className="px-4 py-3.5">
      <CardLabel>{title}</CardLabel>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

/** Chart caption — mono, sitting inside the block's own card. */
function ChartFigure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="border-t border-sand pt-3">
      <figcaption className="font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
        {label}
      </figcaption>
      <div className="mt-2">{children}</div>
    </figure>
  );
}

/** The prose sections a caller can already have shown above this body. */
export type KaiSectionKey = "business_plain" | "the_numbers" | "moat" | "risks";

export default function KaiReportSection({
  report,
  showHead = true,
  surfaced,
}: {
  report: KaiReport;
  /** false when KaiReportPanel's Kai field already carries the headline. */
  showHead?: boolean;
  /**
   * Sections the CALLER has already printed in full above this body. Board 14
   * surfaces three of them as signal cards and the complete risk register as
   * its own field — and then mounted this, which printed all four again,
   * verbatim, a screen further down. Eight thousand pixels, half of them a
   * second copy. A section named here is not repeated; anything the caller only
   * TEASED (a truncated lede) is not named, and its full text still ships here.
   */
  surfaced?: readonly KaiSectionKey[];
}) {
  const seen = new Set<KaiSectionKey>(surfaced ?? []);
  const s = report.sections;
  const bars = report.data?.bars || [];
  const financials = report.data?.financials || null;
  const generated = new Date(report.generated_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const risks = s.risks || [];
  const questions = s.discussion_questions || [];

  return (
    <section aria-label={`Kai Research Report on ${report.ticker}`} className="space-y-3">
      {/* ── THE REPORT HEAD ────────────────────────────────────────────────
          No logo, no price: the canvas head at the top of the page already
          carries identity and the mark. What this owes the member is WHOSE
          read it is and HOW OLD it is — so that is all the head says. It is
          suppressed entirely inside board 14, where the Kai field says it. */}
      {showHead && (
        <Card tone="kai" className="p-4">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-kai-600">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Kai research report
            <span className="h-3 w-px bg-kai-500/40" aria-hidden />
            <span className="font-medium text-soft">Updated {generated}</span>
          </p>
          {s.headline && (
            <h2 className="mt-2.5 font-display text-[19px] font-extrabold leading-tight text-ink">
              {s.headline}
            </h2>
          )}
          {s.sector_tagline && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-soft">
              {s.sector_tagline}
            </p>
          )}
        </Card>
      )}

      {s.business_plain && !seen.has("business_plain") && (
        <Block title="The business, in plain English">
          <Paras text={s.business_plain} />
        </Block>
      )}

      <Block title="The numbers">
        <div className="space-y-6">
          <ChartFigure label="Price · last ~1 year (delayed)">
            <PriceChart bars={bars} />
          </ChartFigure>
          {financials && financials.length >= 2 && (
            <ChartFigure label="Quarterly revenue & net income">
              <RevenueChart periods={financials} />
            </ChartFigure>
          )}
          {s.the_numbers && !seen.has("the_numbers") && <Paras text={s.the_numbers} />}
        </div>
      </Block>

      {(s.moat || s.thesis) && !seen.has("moat") && (
        <Block title="Moat & thesis">
          <div className="space-y-3.5">
            <Paras text={s.moat} />
            <Paras text={s.thesis} />
          </div>
        </Block>
      )}

      {risks.length > 0 && !seen.has("risks") && (
        <Block title="What could go wrong">
          {/* Each risk is a numbered row inside the block's card, so the list
              reads as a register a member can work down. `.f0-ledger` supplies
              the hairlines between rows; `.f0-ledger-row` is deliberately NOT
              used — its hover wash belongs to rows you can act on. */}
          <ul className="f0-ledger">
            {risks.map((r, i) => (
              <li key={i} className="flex gap-3 py-3.5">
                <span
                  className="mt-[3px] shrink-0 font-mono text-[10px] font-semibold tabular-nums text-kai-600 dark:text-kai-300"
                  aria-hidden
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 text-[14px] leading-relaxed text-midnight-200">
                  {r}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {s.kids_explainer && (
        // The one block genuinely addressed to someone else in the room, so it
        // gets the tinted Kai field rather than the plain card.
        <Card tone="kai" radius="md" className="px-4 py-3.5">
          <CardLabel tone="kai">Explain it to your kids</CardLabel>
          <div className="mt-3">
            <Paras text={s.kids_explainer} />
          </div>
        </Card>
      )}

      {questions.length > 0 && (
        <Block title="Talk about it as a family">
          <ol className="space-y-3.5">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="mt-[3px] shrink-0 font-mono text-[10px] font-semibold tabular-nums text-kai-600 dark:text-kai-300"
                  aria-hidden
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 text-[14px] leading-relaxed text-midnight-200">
                  {q}
                </span>
              </li>
            ))}
          </ol>
        </Block>
      )}

      {/* Sources + the compliance line, verbatim. */}
      <footer className="border-t border-sand pt-4">
        <p className="text-[11px] leading-relaxed text-soft">
          Sources: company profile, price history, and quarterly financials via
          our market-data provider (delayed ~15 min); analysis written by Kai
          ({report.model || "AI"}), v{report.version}.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-soft">
          {KAI_REPORT_DISCLAIMER}
        </p>
      </footer>
    </section>
  );
}
