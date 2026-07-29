"use client";

import type { CSSProperties, ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { PriceChart, RevenueChart } from "@/components/kai/ReportCharts";
import {
  toParagraphs,
  KAI_REPORT_DISCLAIMER,
  type KaiReport,
} from "@/lib/kai/report";
// Type-only import — v1 owns the canonical section-key union, so the two twins
// can never drift. Importing a type never touches v1's runtime (it's erased).
import type { KaiSectionKey } from "@/components/kai/KaiReportSection";

/**
 * KAI RESEARCH REPORT — v2 (cc) twin of KaiReportSection.
 *
 * Same component, same props, same real `kai_reports` fields — nothing new is
 * fetched and nothing is invented. Only the CHROME changes: v1's warm-gold
 * cards/rules (border-sand, text-midnight-200, gold-500) are restated in the v2
 * `--cc-*` token system and board-14 anatomy. The parent (KaiPanel in
 * ResearchClientV2) draws the Kai verdict field + COVERAGE ring above and the
 * "Set Kai Watch" action bar below, then mounts this with `showHead={false}` for
 * the written body: the charts, the moat & thesis, the risk register, the kids
 * explainer, the family questions, sources and the compliance line.
 *
 * WHAT THIS DELIBERATELY DOES NOT DRAW (mirrors v1, honest-data laws §6):
 *   • NO confidence ring — `kai_reports` has no confidence field, so none is
 *     rendered. Kai's read IS the HEADLINE, a sentence in the model's own words.
 *   • NO "Set Kai Watch" link INSIDE the body — that action belongs to the
 *     parent's KaiActions footer (→ /alerts#kai-nl); duplicating it here would
 *     print it twice. v1's body has no such link, and neither does this twin.
 *   • NO directive verdict, NO options/short-interest content (equities-only).
 *
 * COLOUR LAW: Kai blue (`--cc-blue`) is the ONLY chrome colour in here — the
 * eyebrow, the risk numerals, the question numerals, the kids field. Green/pink
 * appear only inside the price/financial charts (ReportCharts), which are price.
 * The model writes `sections` (prose) and NEVER draws — the charts render the
 * stored `data` block, so the numbers can't drift from the analysis around them.
 */

/* Kai-tinted surface — the blue-washed card the board gives Kai's own fields,
   matching the parent KaiPanel's gradient exactly. */
const KAI_FIELD: CSSProperties = {
  background:
    "linear-gradient(140deg, color-mix(in srgb, var(--cc-blue) 12%, var(--cc-card)) 0%, var(--cc-card) 70%)",
  borderColor: "color-mix(in srgb, var(--cc-blue) 30%, var(--cc-line))",
};

/** Prose paragraphs — 13px cc body, blank-line split (identical parsing to v1). */
function Paras({ text }: { text: string }) {
  const paras = toParagraphs(text);
  if (paras.length === 0) return null;
  return (
    <div className="space-y-3">
      {paras.map((p, i) => (
        <p
          key={i}
          className="text-[13px] leading-relaxed"
          style={{ color: "color-mix(in srgb, var(--cc-ink) 88%, transparent)" }}
        >
          {p}
        </p>
      ))}
    </div>
  );
}

/** Mono card label — the board's tiny uppercase field mark (soft, or Kai blue). */
function Label({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "kai" }) {
  return (
    <div
      className="font-[family-name:var(--font-plex-mono)] text-[9px] font-semibold uppercase tracking-[0.16em]"
      style={{ color: tone === "kai" ? "var(--cc-blue)" : "var(--cc-soft)" }}
    >
      {children}
    </div>
  );
}

/** Section block — one compact cc card per part of the report, as the board draws it. */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: "var(--cc-line)", background: "var(--cc-card)" }}
    >
      <Label>{title}</Label>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** Chart caption — mono, sitting inside the block's card above the data figure. */
function ChartFigure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="border-t pt-3" style={{ borderColor: "var(--cc-line)" }}>
      <figcaption
        className="font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.14em]"
        style={{ color: "var(--cc-soft)" }}
      >
        {label}
      </figcaption>
      <div className="mt-2">{children}</div>
    </figure>
  );
}

export default function KaiReportSectionV2({
  report,
  showHead = true,
  surfaced,
}: {
  report: KaiReport;
  /** false when the parent's Kai field already carries the headline (board 14). */
  showHead?: boolean;
  /**
   * Sections the CALLER has already printed in full above this body. A section
   * named here is not repeated; anything only TEASED (a truncated lede) is not
   * named, and its full text still ships here. Identical semantics to v1.
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
          Whose read it is and how old it is — the Kai-tinted field. Suppressed
          inside board 14, where the parent's verdict field already says it. */}
      {showHead && (
        <div className="rounded-2xl border p-4" style={KAI_FIELD}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-[family-name:var(--font-plex-mono)] text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--cc-blue)" }}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Kai research report
            <span className="h-3 w-px" style={{ background: "color-mix(in srgb, var(--cc-blue) 40%, transparent)" }} aria-hidden />
            <span className="font-medium" style={{ color: "var(--cc-soft)" }}>Updated {generated}</span>
          </p>
          {s.headline && (
            <h2 className="mt-2.5 text-[19px] font-extrabold leading-tight tracking-[-0.01em]" style={{ color: "var(--cc-ink)" }}>
              {s.headline}
            </h2>
          )}
          {s.sector_tagline && (
            <p className="mt-2 font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--cc-soft)" }}>
              {s.sector_tagline}
            </p>
          )}
        </div>
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
          <div className="space-y-3">
            <Paras text={s.moat} />
            <Paras text={s.thesis} />
          </div>
        </Block>
      )}

      {risks.length > 0 && !seen.has("risks") && (
        <Block title="What could go wrong">
          {/* Numbered register — hairline-separated rows, blue numerals (colour law). */}
          <ul>
            {risks.map((r, i) => (
              <li
                key={i}
                className="flex gap-3 py-3.5"
                style={i > 0 ? { borderTop: "1px solid var(--cc-line)" } : undefined}
              >
                <span
                  className="mt-[3px] shrink-0 font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold tabular-nums"
                  style={{ color: "var(--cc-blue)" }}
                  aria-hidden
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="min-w-0 flex-1 text-[13px] leading-relaxed"
                  style={{ color: "color-mix(in srgb, var(--cc-ink) 88%, transparent)" }}
                >
                  {r}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {s.kids_explainer && (
        // The one block addressed to someone else in the room — the Kai field.
        <div className="rounded-2xl border p-4" style={KAI_FIELD}>
          <Label tone="kai">Explain it to your kids</Label>
          <div className="mt-3">
            <Paras text={s.kids_explainer} />
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <Block title="Talk about it as a family">
          <ol className="space-y-3.5">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="mt-[3px] shrink-0 font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold tabular-nums"
                  style={{ color: "var(--cc-blue)" }}
                  aria-hidden
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="min-w-0 flex-1 text-[13px] leading-relaxed"
                  style={{ color: "color-mix(in srgb, var(--cc-ink) 88%, transparent)" }}
                >
                  {q}
                </span>
              </li>
            ))}
          </ol>
        </Block>
      )}

      {/* Sources + the compliance line, verbatim. */}
      <footer className="border-t pt-4" style={{ borderColor: "var(--cc-line)" }}>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
          Sources: company profile, price history, and quarterly financials via
          our market-data provider (delayed ~15 min); analysis written by Kai
          ({report.model || "AI"}), v{report.version}.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--cc-soft)" }}>
          {KAI_REPORT_DISCLAIMER}
        </p>
      </footer>
    </section>
  );
}
