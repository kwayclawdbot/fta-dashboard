"use client";

/**
 * Financial visuals for the research page (Lane 9), concrete WSZ/Ziggma specs:
 *   • RevenueMarginChart      — quarterly Revenue + Net-Income paired bars with a
 *                               Profit-Margin line on a secondary axis.
 *   • AssetsLiabilitiesChart  — Assets vs Liabilities paired bars + Debt/Equity
 *                               line on a secondary axis.
 *   • AnnualBarsChart         — annual Revenue (or EPS) bars; the estimates slot
 *                               is intentionally left EMPTY v1 (no analyst feed).
 *   • PeComparisonChart       — Company vs Industry vs Market PE, in-house medians.
 *   • RsiDial                 — RSI(14) gauge dial.
 *
 * Pure presentational SVG (theme-aware via tokens/currentColor, responsive via
 * viewBox). Same house style as the Kai report charts.
 */

import type { ResearchQuarter, ResearchAnnual } from "@/lib/research/types";
import { abbreviateMoney } from "@/lib/kai/report";

const EmptyNote = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-dashed border-sand px-3 py-8 text-center text-sm text-soft">
    {children}
  </div>
);

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
    {label}
  </span>
);
const LegendLine = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="inline-block h-0.5 w-3.5 rounded" style={{ backgroundColor: color }} />
    {label}
  </span>
);

const GOLD = "#d4a017";
const TEAL = "#0ea5a4";
const ORANGE = "#f59e0b";
const RED = "#dc2626";

/* ────────────────── paired bars + secondary-axis line core ──────────────── */

interface PairedSpec {
  labels: string[];
  barA: (number | null)[]; // primary big bar
  barB: (number | null)[]; // secondary paired bar
  line: (number | null)[]; // secondary-axis line (%/ratio)
  barAColor: string;
  barBColor: string;
  lineColor: string;
  fmtBar: (v: number) => string;
  fmtLine: (v: number) => string;
  height?: number;
}

function PairedBarsLine(spec: PairedSpec) {
  const { labels, barA, barB, line } = spec;
  const H = spec.height ?? 220;
  const W = 640;
  const padT = 18;
  const padB = 30;
  const padX = 34;

  const barVals = [...barA, ...barB].filter((v): v is number => v != null);
  if (barVals.length === 0) return <EmptyNote>Not enough data to chart.</EmptyNote>;
  const maxBar = Math.max(...barVals, 1);
  const minBar = Math.min(...barVals, 0);
  const barRange = maxBar - minBar || 1;

  const lineVals = line.filter((v): v is number => v != null);
  const maxLine = lineVals.length ? Math.max(...lineVals, 0) : 1;
  const minLine = lineVals.length ? Math.min(...lineVals, 0) : 0;
  const lineRange = maxLine - minLine || 1;

  const n = labels.length;
  const slot = (W - padX * 2) / n;
  const barW = Math.min(slot * 0.28, 22);

  const yBar = (v: number) => padT + (1 - (v - minBar) / barRange) * (H - padT - padB);
  const yLine = (v: number) => padT + (1 - (v - minLine) / lineRange) * (H - padT - padB);
  const zero = yBar(0);
  const cx = (i: number) => padX + slot * i + slot / 2;

  const linePts = line
    .map((v, i) => (v == null ? null : `${cx(i).toFixed(1)},${yLine(v).toFixed(1)}`))
    .filter((p): p is string => p != null);

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" className="block">
        {/* zero / baseline */}
        <line x1={padX} x2={W - padX} y1={zero} y2={zero} className="text-sand" stroke="currentColor" strokeWidth={1} />
        {labels.map((lab, i) => {
          const a = barA[i];
          const b = barB[i];
          return (
            <g key={i}>
              {a != null && (
                <rect
                  x={cx(i) - barW - 1}
                  y={Math.min(yBar(a), zero)}
                  width={barW}
                  height={Math.max(Math.abs(yBar(a) - zero), 1)}
                  rx={2}
                  fill={spec.barAColor}
                />
              )}
              {b != null && (
                <rect
                  x={cx(i) + 1}
                  y={Math.min(yBar(b), zero)}
                  width={barW}
                  height={Math.max(Math.abs(yBar(b) - zero), 1)}
                  rx={2}
                  fill={b < 0 ? RED : spec.barBColor}
                />
              )}
              <text x={cx(i)} y={H - padB + 14} textAnchor="middle" className="fill-soft" fontSize={9.5}>
                {lab}
              </text>
            </g>
          );
        })}
        {/* secondary-axis line */}
        {linePts.length >= 2 && (
          <polyline
            points={linePts.join(" ")}
            fill="none"
            stroke={spec.lineColor}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {line.map((v, i) =>
          v == null ? null : (
            <circle key={i} cx={cx(i)} cy={yLine(v)} r={2.5} fill={spec.lineColor} />
          )
        )}
      </svg>
    </div>
  );
}

/* ─────────────────────────── Revenue + margin ──────────────────────────── */

export function RevenueMarginChart({
  periods,
}: {
  periods: { label: string; revenue: number | null; netIncome: number | null }[];
}) {
  if (!periods || periods.length < 2) return <EmptyNote>Financials aren&apos;t available for this company.</EmptyNote>;
  const q = periods.slice(-8);
  const margin = q.map((p) => (p.revenue && p.netIncome != null ? (p.netIncome / p.revenue) * 100 : null));
  return (
    <div>
      <PairedBarsLine
        labels={q.map((p) => p.label)}
        barA={q.map((p) => p.revenue)}
        barB={q.map((p) => p.netIncome)}
        line={margin}
        barAColor={GOLD}
        barBColor={TEAL}
        lineColor={ORANGE}
        fmtBar={abbreviateMoney}
        fmtLine={(v) => `${v.toFixed(0)}%`}
      />
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-soft">
        <LegendDot color={GOLD} label="Revenue" />
        <LegendDot color={TEAL} label="Net income" />
        <LegendLine color={ORANGE} label="Profit margin" />
      </div>
    </div>
  );
}

/* ────────────────────────── Assets vs liabilities ──────────────────────── */

export function AssetsLiabilitiesChart({ quarterly }: { quarterly: ResearchQuarter[] }) {
  const withBal = (quarterly || []).filter((q) => q.assets != null || q.liabilities != null);
  if (withBal.length < 2) return <EmptyNote>Balance-sheet data isn&apos;t available for this company.</EmptyNote>;
  const q = withBal.slice(-8);
  const de = q.map((p) => (p.liabilities != null && p.equity && p.equity > 0 ? p.liabilities / p.equity : null));
  return (
    <div>
      <PairedBarsLine
        labels={q.map((p) => p.label)}
        barA={q.map((p) => p.assets)}
        barB={q.map((p) => p.liabilities)}
        line={de}
        barAColor="#1f2937"
        barBColor={TEAL}
        lineColor={ORANGE}
        fmtBar={abbreviateMoney}
        fmtLine={(v) => v.toFixed(1)}
      />
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-soft">
        <LegendDot color="#1f2937" label="Assets" />
        <LegendDot color={TEAL} label="Liabilities" />
        <LegendLine color={ORANGE} label="Debt / equity" />
      </div>
    </div>
  );
}

/* ───────────────────────── Annual revenue / EPS bars ───────────────────── */

export function AnnualBarsChart({
  annual,
  metric,
}: {
  annual: ResearchAnnual[];
  metric: "revenue" | "eps";
}) {
  const rows = (annual || []).filter((a) => a[metric] != null);
  if (rows.length < 2) return <EmptyNote>Annual {metric === "eps" ? "EPS" : "revenue"} history isn&apos;t available.</EmptyNote>;

  const H = 200;
  const W = 640;
  const padT = 18;
  const padB = 28;
  const padX = 14;
  const vals = rows.map((a) => a[metric] as number);
  const max = Math.max(...vals, metric === "eps" ? 0.01 : 1);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const n = rows.length;
  const slot = (W - padX * 2) / n;
  const barW = Math.min(slot * 0.5, 46);
  const y = (v: number) => padT + (1 - (v - min) / range) * (H - padT - padB);
  const zero = y(0);
  const cx = (i: number) => padX + slot * i + slot / 2;
  const fmt = (v: number) => (metric === "eps" ? `$${v.toFixed(2)}` : abbreviateMoney(v));

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" className="block">
        <line x1={padX} x2={W - padX} y1={zero} y2={zero} className="text-sand" stroke="currentColor" strokeWidth={1} />
        {rows.map((a, i) => {
          const v = a[metric] as number;
          const yy = Math.min(y(v), zero);
          return (
            <g key={i}>
              <rect x={cx(i) - barW / 2} y={yy} width={barW} height={Math.max(Math.abs(y(v) - zero), 1)} rx={3} fill={v < 0 ? RED : GOLD} />
              <text x={cx(i)} y={yy - 5} textAnchor="middle" className="fill-soft" fontSize={10} fontWeight={600}>
                {fmt(v)}
              </text>
              <text x={cx(i)} y={H - padB + 14} textAnchor="middle" className="fill-soft" fontSize={10}>
                {a.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─────────────────── PE vs Industry vs Market (in-house) ────────────────── */

export function PeComparisonChart({
  company,
  industry,
  market,
  sectorN,
  marketN,
}: {
  company: number | null;
  industry: number | null;
  market: number | null;
  sectorN: number;
  marketN: number;
}) {
  const bars = [
    { label: "Company", v: company, color: "#3b82f6", n: null as number | null },
    { label: "Industry", v: industry, color: ORANGE, n: sectorN },
    { label: "Market", v: market, color: TEAL, n: marketN },
  ];
  const vals = bars.map((b) => b.v).filter((v): v is number => v != null && v > 0);
  if (company == null || company <= 0) {
    return <EmptyNote>A P/E comparison needs positive earnings — not available here.</EmptyNote>;
  }
  const max = Math.max(...vals, 1);
  const H = 190;
  const W = 640;
  const padT = 18;
  const padB = 34;
  const slotW = W / bars.length;
  const barW = 78;
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const baseY = H - padB;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" className="block">
        <line x1={0} x2={W} y1={baseY} y2={baseY} className="text-sand" stroke="currentColor" strokeWidth={1} />
        {bars.map((b, i) => {
          const cx = slotW * i + slotW / 2;
          if (b.v == null || b.v <= 0) {
            return (
              <text key={i} x={cx} y={baseY - 8} textAnchor="middle" className="fill-soft" fontSize={11}>
                {b.label}: —
              </text>
            );
          }
          const yy = y(b.v);
          return (
            <g key={i}>
              <rect x={cx - barW / 2} y={yy} width={barW} height={baseY - yy} rx={4} fill={b.color} />
              <text x={cx} y={yy - 6} textAnchor="middle" className="fill-ink" fontSize={13} fontWeight={700}>
                {b.v.toFixed(1)}×
              </text>
              <text x={cx} y={baseY + 15} textAnchor="middle" className="fill-soft" fontSize={11} fontWeight={600}>
                {b.label}
              </text>
              {b.n != null && (
                <text x={cx} y={baseY + 28} textAnchor="middle" className="fill-soft" fontSize={9}>
                  ({b.n} studied)
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ───────────────────────────────── RSI dial ────────────────────────────── */

export function RsiDial({ rsi }: { rsi: number | null }) {
  const W = 150;
  const H = 92;
  const cx = W / 2;
  const cy = H - 10;
  const r = 62;
  const stroke = 11;
  const clamped = rsi == null ? null : Math.max(0, Math.min(100, rsi));

  // Zones: <30 oversold (green area for value but red-ish trend), 30-70 neutral, >70 overbought.
  const arc = (from: number, to: number, color: string) => {
    const a0 = Math.PI - (from / 100) * Math.PI;
    const a1 = Math.PI - (to / 100) * Math.PI;
    const p0 = { x: cx + r * Math.cos(a0), y: cy - r * Math.sin(a0) };
    const p1 = { x: cx + r * Math.cos(a1), y: cy - r * Math.sin(a1) };
    return <path d={`M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${r} ${r} 0 0 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`} fill="none" stroke={color} strokeWidth={stroke} />;
  };
  const needleA = clamped == null ? Math.PI / 2 : Math.PI - (clamped / 100) * Math.PI;
  const nx = cx + (r - 6) * Math.cos(needleA);
  const ny = cy - (r - 6) * Math.sin(needleA);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }} role="img" aria-label="RSI dial">
        {arc(0, 30, "#16a34a")}
        {arc(30, 70, "#94a3b8")}
        {arc(70, 100, "#dc2626")}
        {clamped != null && (
          <>
            <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)} className="text-ink" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={4} className="text-ink" fill="currentColor" />
          </>
        )}
      </svg>
      <div className="-mt-2 text-center">
        <div className="font-display text-lg font-bold text-ink">{clamped == null ? "—" : clamped.toFixed(0)}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-soft">
          RSI {clamped == null ? "" : clamped < 30 ? "· oversold" : clamped > 70 ? "· overbought" : "· neutral"}
        </div>
      </div>
    </div>
  );
}
