"use client";

import Link from "next/link";
import { STAGE_META, SOURCE_META, type Stage } from "@/lib/marketing";

/* ── Marketing sub-nav (spans the whole CRM incl. marketing pages) ─────────── */

export function MarketingNav({
  active,
}: {
  active:
    | "overview"
    | "members"
    | "leads"
    | "pipeline"
    | "campaigns"
    | "support";
}) {
  const tabs = [
    { id: "overview", label: "Overview", href: "/admin/crm" },
    { id: "members", label: "Contacts", href: "/admin/crm/members" },
    { id: "leads", label: "Leads", href: "/admin/crm/leads" },
    { id: "pipeline", label: "Pipeline", href: "/admin/crm/pipeline" },
    { id: "campaigns", label: "Campaigns", href: "/admin/crm/campaigns" },
    { id: "support", label: "Support", href: "/admin/crm/support" },
  ] as const;
  return (
    <div className="mb-6 flex items-center gap-2 overflow-x-auto club2-track">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={active === t.id ? "page" : undefined}
          className={`f0-chip f0-press f0-focus shrink-0 whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${
            active === t.id ? "f0-chip-on" : "text-soft hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/* ── badges ───────────────────────────────────────────────────────────────────
   The stage meta in `@/lib/marketing` still carries the old per-stage hue
   classes; only its LABEL is read here. A pipeline stage is not price, so the
   console marks it by weight — the two ends of the funnel (converted, gone)
   are the only stages that get a fill. */

const CHIP =
  "f0-chip px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]";

const STAGE_TONE: Record<Stage, string> = {
  new: "text-ink",
  contacted: "text-soft",
  engaged: "text-ink",
  nurture: "text-soft",
  converted: "f0-chip-accent text-accent",
  cold: "text-soft",
  unsubscribed: "text-soft opacity-70",
};

export function StageBadge({ stage }: { stage: Stage }) {
  const m = STAGE_META[stage];
  return <span className={`${CHIP} ${STAGE_TONE[stage] ?? "text-soft"}`}>{m.label}</span>;
}

export function SourceBadge({ source }: { source: string }) {
  const m = SOURCE_META[source] || { label: source };
  return <span className={`${CHIP} text-soft`}>{m.label}</span>;
}

export function ColdBadge() {
  return <span className={`${CHIP} text-soft`}>❄ Cold</span>;
}

/* ── tag pill ─────────────────────────────────────────────────────────────── */

export function TagPill({ tag }: { tag: string }) {
  return (
    <span className="f0-chip px-1.5 py-0.5 text-[10px] text-soft">{tag}</span>
  );
}

/* ── small stat tile (self-contained; mirrors ui.tsx StatTile) ────────────── */

export function MiniStat({
  label,
  value,
  accent = "text-ink",
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="club-b-card p-4">
      <p className={`font-mono text-2xl font-semibold tabular-nums ${accent}`}>
        {value}
      </p>
      <p className="mt-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
        {label}
      </p>
    </div>
  );
}
