"use client";

import type { ReactNode } from "react";
import { Sparkles, ShieldQuestion, TrendingUp, HeartHandshake, AlertTriangle, Baby, MessagesSquare } from "lucide-react";
import { m } from "@/lib/motion";
import CompanyLogo from "@/components/fic/CompanyLogo";
import LivePrice from "@/components/fic/LivePrice";
import { PriceChart, RevenueChart } from "@/components/kai/ReportCharts";
import type { MarketQuote } from "@/lib/market/client";
import {
  toParagraphs,
  KAI_REPORT_DISCLAIMER,
  type KaiReport,
} from "@/lib/kai/report";

function Paras({ text }: { text: string }) {
  const paras = toParagraphs(text);
  return (
    <div className="space-y-3">
      {paras.map((p, i) => (
        <p key={i} className="text-[15px] leading-relaxed text-midnight-200">
          {p}
        </p>
      ))}
    </div>
  );
}

function Heading({
  icon: Icon,
  children,
}: {
  icon: typeof Sparkles;
  children: ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
      <Icon className="h-4 w-4 text-gold-600" />
      {children}
    </h3>
  );
}

export default function KaiReportSection({
  report,
  ticker,
  companyName,
  quote,
}: {
  report: KaiReport;
  ticker: string;
  companyName: string;
  quote: MarketQuote | null;
}) {
  const s = report.sections;
  const bars = report.data?.bars || [];
  const financials = report.data?.financials || null;
  const generated = new Date(report.generated_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <m.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-gold-300/40 bg-midnight-900 shadow-soft"
    >
      {/* Section banner */}
      <div className="flex items-center gap-2 border-b border-gold-300/30 bg-gradient-to-r from-gold-400/15 to-transparent px-5 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-400/20">
          <Sparkles className="h-4 w-4 text-gold-700" />
        </span>
        <div className="min-w-0">
          <div className="font-display text-sm font-bold uppercase tracking-wider text-gold-700">
            Kai Research Report
          </div>
          <div className="text-[11px] text-soft">
            Generated {generated} · educational, not advice
          </div>
        </div>
      </div>

      <div className="space-y-7 px-5 py-6">
        {/* Hero */}
        <div>
          <div className="flex items-start gap-3">
            <CompanyLogo symbol={ticker} name={companyName} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="font-display text-xl font-bold text-ink">
                  {companyName}
                </h2>
                <span className="text-sm font-medium text-midnight-500">{ticker}</span>
              </div>
              {s.sector_tagline && (
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-gold-600">
                  {s.sector_tagline}
                </p>
              )}
              <div className="mt-1.5">
                <LivePrice quote={quote} size="md" showDelayed />
              </div>
            </div>
          </div>
          {s.headline && (
            <p className="mt-3 text-[15px] font-medium italic leading-relaxed text-ink">
              &ldquo;{s.headline}&rdquo;
            </p>
          )}
        </div>

        {/* Business in plain English */}
        <div className="space-y-2.5">
          <Heading icon={ShieldQuestion}>Business, in plain English</Heading>
          <Paras text={s.business_plain} />
        </div>

        {/* The Numbers */}
        <div className="space-y-3">
          <Heading icon={TrendingUp}>The Numbers</Heading>
          <div className="rounded-xl border border-sand bg-paper/40 p-3 text-gold-600">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-soft">
              Price · last ~1 year (delayed)
            </div>
            <PriceChart bars={bars} />
          </div>
          {financials && financials.length >= 2 && (
            <div className="rounded-xl border border-sand bg-paper/40 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-soft">
                Quarterly revenue &amp; net income
              </div>
              <RevenueChart periods={financials} />
            </div>
          )}
          <Paras text={s.the_numbers} />
        </div>

        {/* Moat & Thesis */}
        <div className="space-y-2.5">
          <Heading icon={HeartHandshake}>Moat &amp; Thesis</Heading>
          <Paras text={s.moat} />
          <Paras text={s.thesis} />
        </div>

        {/* Risks */}
        <div className="space-y-2.5">
          <Heading icon={AlertTriangle}>Risks &amp; what could go wrong</Heading>
          <ul className="space-y-2">
            {(s.risks || []).map((r, i) => (
              <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-midnight-200">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500/70" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Explain it to your kids */}
        <div className="space-y-2.5 rounded-xl border border-gold-300/30 bg-chip-amber/15 p-4">
          <Heading icon={Baby}>Explain it to your kids</Heading>
          <Paras text={s.kids_explainer} />
        </div>

        {/* Discussion questions */}
        <div className="space-y-2.5">
          <Heading icon={MessagesSquare}>Talk about it as a family</Heading>
          <ol className="space-y-2">
            {(s.discussion_questions || []).map((q, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-midnight-200">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-400/20 text-[11px] font-bold text-gold-700">
                  {i + 1}
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Sources + disclaimer */}
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
      </div>
    </m.section>
  );
}
