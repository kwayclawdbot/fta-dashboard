"use client";

import Link from "next/link";
import { STAGE_META, SOURCE_META, type Stage } from "@/lib/marketing";

/* ── Marketing sub-nav (spans the whole CRM incl. marketing pages) ─────────── */

export function MarketingNav({
  active,
}: {
  active: "overview" | "members" | "leads" | "pipeline" | "campaigns";
}) {
  const tabs = [
    { id: "overview", label: "Overview", href: "/admin/crm" },
    { id: "members", label: "Members", href: "/admin/crm/members" },
    { id: "leads", label: "Leads", href: "/admin/crm/leads" },
    { id: "pipeline", label: "Pipeline", href: "/admin/crm/pipeline" },
    { id: "campaigns", label: "Campaigns", href: "/admin/crm/campaigns" },
  ] as const;
  return (
    <div className="flex items-center gap-1 border-b border-zinc-800 mb-6 overflow-x-auto">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 whitespace-nowrap transition-colors ${
            active === t.id
              ? "border-amber-400 text-amber-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/* ── badges ───────────────────────────────────────────────────────────────── */

export function StageBadge({ stage }: { stage: Stage }) {
  const m = STAGE_META[stage];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${m.text} ${m.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const m = SOURCE_META[source] || { label: source, text: "text-zinc-400" };
  return (
    <span
      className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-800 ${m.text}`}
    >
      {m.label}
    </span>
  );
}

export function ColdBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-cyan-300 bg-cyan-500/10">
      ❄ Cold
    </span>
  );
}

/* ── tag pill ─────────────────────────────────────────────────────────────── */

export function TagPill({ tag }: { tag: string }) {
  return (
    <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
      {tag}
    </span>
  );
}

/* ── small stat tile (self-contained; mirrors ui.tsx StatTile) ────────────── */

export function MiniStat({
  label,
  value,
  accent = "text-zinc-100",
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </div>
  );
}
