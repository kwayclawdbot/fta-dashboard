"use client";

/**
 * Research panel blocks — key stats, company profile, news list, and the
 * financial visuals.
 *
 * REDESIGN (owner note: "the overview, technicals, fundamentals, news pages
 * should be redesigned"). Every block here previously reached for a box: the
 * key stats were an equal-column grid of cells, the financials were four
 * bordered panels in a 2-up grid, headlines and dividends were chips. All of it
 * is now RULED — hairline rows and hairline-separated columns — which is how
 * this system expresses density. Fundamentals SHOULD be dense; density done
 * well is a ledger, not a wall of cards.
 *
 * Laws held: mono for every number, "—" for anything the feed didn't supply,
 * green/red reserved for price via text-price-up / text-price-down, orange
 * reserved for brand + action (and taken from the themed gold ramp, never the
 * frozen volt ramp).
 */

import { useState } from "react";
import { ExternalLink, Building2, Users, MapPin, Calendar, Globe } from "lucide-react";
import type { ResearchPayload } from "@/lib/research/types";
import type { NewsHeadline } from "@/lib/market/client";
import { formatExchange } from "@/lib/market/exchange";
import {
  RevenueMarginChart,
  AssetsLiabilitiesChart,
  AnnualBarsChart,
  PeComparisonChart,
} from "@/components/research/ResearchCharts";

/* ─────────────────────────────── key stats ─────────────────────────────── */

function fmtX(v: number | null): string {
  return v == null || v <= 0 ? "—" : `${v.toFixed(1)}×`;
}
function fmtPrice(v: number | null): string {
  return v == null ? "—" : `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function KeyStatsGrid({ k }: { k: ResearchPayload["keyStats"] }) {
  const stats: { label: string; value: string; hint?: string }[] = [
    { label: "P/E", value: fmtX(k.pe), hint: "price ÷ earnings" },
    { label: "P/B", value: fmtX(k.pb), hint: "price ÷ book value" },
    { label: "P/S", value: fmtX(k.ps), hint: "price ÷ sales" },
    { label: "PEG", value: k.peg == null || k.peg <= 0 ? "—" : k.peg.toFixed(2), hint: "value vs growth" },
    { label: "52w low", value: fmtPrice(k.week52Low) },
    { label: "52w high", value: fmtPrice(k.week52High) },
    { label: "Market cap", value: k.marketCapText ?? "—" },
    { label: "Dividend yield", value: k.divYield == null ? "—" : `${k.divYield.toFixed(2)}%` },
  ];
  // A ruled definition ledger: label + plain-English hint on the left, the mono
  // figure on the right. Two ruled columns on sm+ — the rules are the grid, so
  // no cell is ever a box.
  return (
    <dl className="grid grid-cols-1 border-b border-sand sm:grid-cols-2 sm:gap-x-10">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex items-baseline justify-between gap-4 border-t border-sand py-3"
        >
          <dt className="min-w-0">
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-soft">
              {s.label}
            </span>
            {s.hint && <span className="mt-0.5 block text-[10.5px] text-soft/80">{s.hint}</span>}
          </dt>
          <dd
            className={`shrink-0 font-mono text-[15px] font-semibold tabular-nums ${
              s.value === "—" ? "text-soft/60" : "text-ink"
            }`}
          >
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ───────────────────────────── company profile ─────────────────────────── */

export function CompanyProfileCard({
  company,
  kidsMode,
}: {
  company: ResearchPayload["company"];
  kidsMode: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const desc = company.description ?? "";
  const trimmed = desc.length > 320 && !expanded ? desc.slice(0, 320).trimEnd() + "…" : desc;

  const rows: { icon: React.ElementType; label: string; value: string | null }[] = [
    { icon: Building2, label: "Industry", value: company.sector },
    { icon: Globe, label: "Exchange", value: formatExchange(company.exchange) },
    { icon: Users, label: "Employees", value: company.employees ? company.employees.toLocaleString() : null },
    { icon: MapPin, label: "Headquarters", value: company.address },
    { icon: Calendar, label: "Trading since", value: company.listDate },
  ].filter((r) => r.value);

  return (
    <div className="space-y-5">
      {desc && (
        <div>
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-midnight-200">
            {trimmed}
          </p>
          {desc.length > 320 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700 transition-colors hover:text-ink"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
          {kidsMode && (
            /* Was a green-tinted block; green belongs to price, so the kid note
               is now a ruled aside carrying the same copy verbatim. */
            <p className="mt-4 border-l-[3px] border-sand py-1 pl-3.5 text-[12.5px] leading-relaxed text-soft">
              In simple terms: this is a real company that sells products or services to earn money. When
              you research it, you&apos;re learning how a business works — not being told to buy anything.
            </p>
          )}
        </div>
      )}
      {rows.length > 0 && (
        <dl className="border-b border-sand">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-4 border-t border-sand py-2.5"
            >
              <dt className="flex shrink-0 items-center gap-2 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-soft">
                <r.icon className="h-3.5 w-3.5 shrink-0" />
                {r.label}
              </dt>
              <dd className="min-w-0 flex-1 truncate text-right text-[13px] font-semibold text-ink">
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {company.homepage && (
        <a
          href={company.homepage}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Company website
        </a>
      )}
    </div>
  );
}

/* ─────────────────────────────────── news ──────────────────────────────── */

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NewsList({ news }: { news: NewsHeadline[] }) {
  if (news.length === 0) {
    return <p className="f0-rule-top pt-4 text-[13px] text-soft">No recent headlines found for this company.</p>;
  }
  return (
    <div>
      <div className="f0-ledger">
        {news.map((n, i) => (
          <a
            key={i}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="f0-ledger-row group"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold leading-snug text-ink group-hover:text-gold-700">
                {n.title}
              </span>
              <span className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-soft">
                {n.publisher && <span className="truncate">{n.publisher}</span>}
                {n.publisher && n.published && <span aria-hidden>·</span>}
                <span>{timeAgo(n.published)}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </span>
            </span>
          </a>
        ))}
      </div>
      <p className="pt-3 text-[10px] text-soft/80">
        Headlines from third-party publishers, shown as links for context only.
      </p>
    </div>
  );
}

/* ───────────────────────────── fundamentals ────────────────────────────── */

/**
 * A financial view. Previously a bordered card in a 2-up grid — four boxes, the
 * exact texture the register bans. Now each view is a full-width ruled block:
 * a mono eyebrow over a hairline, then the chart. Full width also gives these
 * charts the horizontal room they were being starved of at 2-up.
 */
function View({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="f0-rule-top pt-4">
      <h4 className="font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-soft">
        {title}
      </h4>
      <div className="mt-3">{children}</div>
      {note && <p className="mt-2.5 text-[10.5px] leading-relaxed text-soft/80">{note}</p>}
    </section>
  );
}

export function FinancialsSection({
  charts,
  keyStats,
  medians,
}: {
  charts: ResearchPayload["charts"];
  keyStats: ResearchPayload["keyStats"];
  medians: ResearchPayload["sectorMedians"];
}) {
  const [period, setPeriod] = useState<"quarterly" | "yearly">("quarterly");

  const revProfitPeriods =
    period === "quarterly"
      ? charts.quarterly.map((q) => ({ label: q.label, revenue: q.revenue, netIncome: q.netIncome }))
      : charts.annual.map((a) => ({ label: a.label, revenue: a.revenue, netIncome: a.netIncome }));

  return (
    <div className="space-y-6">
      {/* period control — the same underline language as the tab strip */}
      <div className="flex justify-end gap-5">
        {(["quarterly", "yearly"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className={`relative pb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] capitalize transition-colors ${
              period === p ? "text-ink" : "text-soft hover:text-ink"
            }`}
          >
            {p}
            {period === p && (
              <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-gold-500" />
            )}
          </button>
        ))}
      </div>

      <View title="Revenue & profit margin">
        <RevenueMarginChart periods={revProfitPeriods} />
      </View>
      <View title="Assets vs liabilities (quarterly)">
        <AssetsLiabilitiesChart quarterly={charts.quarterly} />
      </View>
      <View title="Annual earnings per share">
        <AnnualBarsChart annual={charts.annual} metric="eps" />
      </View>
      <View
        title="P/E vs industry vs market"
        note={`Industry and market medians are computed in-house from the ${medians.marketN} companies the club has studied so far — they sharpen as more get analysed.`}
      >
        <PeComparisonChart
          company={keyStats.pe}
          industry={medians.sectorMedian}
          market={medians.marketMedian}
          sectorN={medians.sectorN}
          marketN={medians.marketN}
        />
      </View>

      {charts.dividends.length > 0 && (
        <View title="Recent dividends">
          <dl className="border-b border-sand">
            {charts.dividends.slice(0, 8).map((d, i) => (
              <div
                key={i}
                className="flex items-baseline justify-between gap-4 border-t border-sand py-2"
              >
                <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-soft">
                  {d.exDate ?? "—"}
                </dt>
                <dd className="font-mono text-[13px] font-semibold tabular-nums text-ink">
                  {d.cashAmount != null ? `$${d.cashAmount.toFixed(2)}` : "—"}
                </dd>
              </div>
            ))}
          </dl>
        </View>
      )}
    </div>
  );
}
