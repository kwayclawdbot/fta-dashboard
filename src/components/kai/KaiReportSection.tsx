"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { PriceChart, RevenueChart } from "@/components/kai/ReportCharts";
import {
  toParagraphs,
  KAI_REPORT_DISCLAIMER,
  type KaiReport,
} from "@/lib/kai/report";

/**
 * KAI RESEARCH REPORT — the body of the `Kai Report` tab on /research/[ticker]
 * (canvas v2, board 14).
 *
 * WHAT THE CANVAS DRAWS AND THIS DELIBERATELY DOES NOT:
 *   • "Kai's verdict — ACCUMULATE" with an 82% confidence donut. Both are out:
 *     the app never renders a directive verdict (plan §0.1), and the club
 *     sentiment arc is the only radial in the system (plan §1.5). Kai's read is
 *     the HEADLINE — a sentence, in the model's own words, with no instruction.
 *   • "Call flow surged 3.1× — sweeps at the 180–185 strikes." Options content
 *     is not shipped in Club surfaces; this is an equities-only club.
 *   • Rounded white signal cards stacked four deep. The register bans generic
 *     card containers, so the report is composed from RULES: an eyebrow, a
 *     display headline, section rules, a ledger for the risks, and one charged
 *     left edge for the block that is genuinely addressed to a child.
 *
 * COLOUR LAW: Kai blue is the ONLY chrome colour in here — the eyebrow, the
 * rules that open the report, the risk ticks, the question numerals. Green and
 * red appear only inside the price/financial charts, which are price. Nothing
 * orange: this surface is not asking the member to act.
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

/** Section head — the system's own eyebrow rule, never a card header. */
function Block({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="f0-section-rule">
        <span className="font-display text-eyebrow font-bold uppercase text-ink">{title}</span>
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Chart caption — mono, hairline-topped. The chart needs no frame. */
function ChartFigure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="f0-rule-top pt-3">
      <figcaption className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-soft">
        {label}
      </figcaption>
      <div className="mt-2">{children}</div>
    </figure>
  );
}

export default function KaiReportSection({ report }: { report: KaiReport }) {
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
    <section aria-label={`Kai Research Report on ${report.ticker}`} className="space-y-10">
      {/* ── THE REPORT HEAD ────────────────────────────────────────────────
          No logo, no price: the canvas head at the top of the page already
          carries identity and the mark, and repeating them here would make the
          tab feel like a second page. What the tab owes the member is WHOSE
          read this is and HOW OLD it is — so that is all the head says. */}
      <header>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-kai-600 dark:text-kai-300">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Kai research report
          <span className="h-3 w-px bg-kai-500/40" aria-hidden />
          <span className="font-medium text-soft">Updated {generated}</span>
        </p>
        <div className="mt-3 border-t-2 border-kai-500/30" aria-hidden />
        {s.headline && (
          <h2 className="mt-4 font-display text-display-2 font-extrabold leading-tight text-ink">
            {s.headline}
          </h2>
        )}
        {s.sector_tagline && (
          <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
            {s.sector_tagline}
          </p>
        )}
      </header>

      {s.business_plain && (
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
          {s.the_numbers && <Paras text={s.the_numbers} />}
        </div>
      </Block>

      {(s.moat || s.thesis) && (
        <Block title="Moat & thesis">
          <div className="space-y-3.5">
            <Paras text={s.moat} />
            <Paras text={s.thesis} />
          </div>
        </Block>
      )}

      {risks.length > 0 && (
        <Block title="What could go wrong">
          {/* A ledger, not bullets in a box: each risk is a row on a hairline
              with its own numeral, so the list reads as a register a member can
              work down rather than as decoration. `.f0-ledger` supplies the
              hairlines; `.f0-ledger-row` is deliberately NOT used — its hover
              wash and padding shift belong to rows you can act on, and these are
              prose. */}
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
        // gets an object of its own — a charged Kai edge, not a tinted card.
        <section className="border-l-[3px] border-kai-500 py-1 pl-4">
          <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-kai-600 dark:text-kai-300">
            Explain it to your kids
          </p>
          <div className="mt-2.5">
            <Paras text={s.kids_explainer} />
          </div>
        </section>
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
      <footer className="f0-rule-top pt-5">
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
