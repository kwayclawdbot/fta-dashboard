"use client";

/**
 * Research page section blocks (Lane 9): key-stats grid, company profile card,
 * news link cards, and the fundamentals visuals (Quarterly|Yearly toggle + the
 * four concrete charts). Theme-aware, 390px-friendly, honest empty states.
 */

import { useState } from "react";
import { ExternalLink, Building2, Users, MapPin, Calendar, Globe } from "lucide-react";
import type { ResearchPayload } from "@/lib/research/types";
import type { NewsHeadline } from "@/lib/market/client";
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
  // A designed data table, not chip salad: label above value (mono numerics),
  // cells divided by hairlines. Two columns on mobile, four on desktop.
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="border-b border-sand py-3 pr-5">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-soft">{s.label}</dt>
          <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">{s.value}</dd>
          {s.hint && <dd className="mt-0.5 text-[10px] text-soft/80">{s.hint}</dd>}
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
    { icon: Globe, label: "Exchange", value: company.exchange },
    { icon: Users, label: "Employees", value: company.employees ? company.employees.toLocaleString() : null },
    { icon: MapPin, label: "Headquarters", value: company.address },
    { icon: Calendar, label: "Trading since", value: company.listDate },
  ].filter((r) => r.value);

  return (
    <div className="space-y-4">
      {desc && (
        <div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-midnight-200">{trimmed}</p>
          {desc.length > 320 && (
            <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-semibold text-gold-700 hover:underline">
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
          {kidsMode && (
            <p className="mt-3 rounded-lg bg-chip-green/40 px-3 py-2 text-xs leading-relaxed text-green-800">
              In simple terms: this is a real company that sells products or services to earn money. When
              you research it, you&apos;re learning how a business works — not being told to buy anything.
            </p>
          )}
        </div>
      )}
      {rows.length > 0 && (
        <dl className="border-y border-sand">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-4 border-t border-sand py-2.5 first:border-t-0">
              <dt className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-soft">
                <r.icon className="h-3.5 w-3.5 shrink-0" />
                {r.label}
              </dt>
              <dd className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {company.homepage && (
        <a
          href={company.homepage}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-700 hover:underline"
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
    return (
      <p className="rounded-xl border border-dashed border-sand px-3 py-6 text-center text-sm text-soft">
        No recent headlines found for this company.
      </p>
    );
  }
  return (
    <div>
      <div className="border-y border-sand">
        {news.map((n, i) => (
          <a
            key={i}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block border-t border-sand py-3 first:border-t-0"
          >
            <p className="text-sm font-semibold leading-snug text-ink group-hover:text-gold-700">{n.title}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-soft">
              {n.publisher && <span>{n.publisher}</span>}
              {n.publisher && n.published && <span>·</span>}
              <span>{timeAgo(n.published)}</span>
              <ExternalLink className="h-3 w-3" />
            </p>
          </a>
        ))}
      </div>
      <p className="pt-2 text-[10px] text-soft/80">
        Headlines from third-party publishers, shown as links for context only.
      </p>
    </div>
  );
}

/* ───────────────────────────── fundamentals ────────────────────────────── */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-sand bg-paper p-4">
      <h4 className="mb-3 font-display text-sm font-bold text-ink">{title}</h4>
      {children}
    </div>
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-sand p-0.5">
          {(["quarterly", "yearly"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                period === p ? "bg-gold-500 text-white" : "text-soft hover:text-ink"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Revenue & profit margin">
          <RevenueMarginChart periods={revProfitPeriods} />
        </Panel>
        <Panel title="Assets vs liabilities (quarterly)">
          <AssetsLiabilitiesChart quarterly={charts.quarterly} />
        </Panel>
        <Panel title="Annual earnings per share">
          <AnnualBarsChart annual={charts.annual} metric="eps" />
        </Panel>
        <Panel title="P/E vs industry vs market">
          <PeComparisonChart
            company={keyStats.pe}
            industry={medians.sectorMedian}
            market={medians.marketMedian}
            sectorN={medians.sectorN}
            marketN={medians.marketN}
          />
          <p className="mt-2 text-[10px] leading-relaxed text-soft/80">
            Industry and market medians are computed in-house from the {medians.marketN} companies the
            club has studied so far — they sharpen as more get analysed.
          </p>
        </Panel>
      </div>

      {charts.dividends.length > 0 && (
        <Panel title="Recent dividends">
          <div className="flex flex-wrap gap-2">
            {charts.dividends.slice(0, 8).map((d, i) => (
              <div key={i} className="rounded-lg border border-sand px-2.5 py-1.5 text-xs">
                <span className="font-semibold text-ink">${d.cashAmount?.toFixed(2) ?? "—"}</span>
                <span className="ml-1.5 text-soft">{d.exDate ?? ""}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
