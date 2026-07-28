"use client";

import Link from "next/link";
import {
  Zap,
  BookOpen,
  HelpCircle,
  MessageSquare,
  MessageCircle,
  Target,
  CalendarCheck,
  Award,
  Activity,
  UserPlus,
  Send,
} from "lucide-react";
import { initialsOf } from "@/components/Avatar";
import type { FamilyTier } from "@/lib/tier";
import { TIER_CONFIG } from "@/lib/tier";
import { recencyBucket, type TimelineType } from "@/lib/crm";

/* ── Avatar (paper canvas, initials fallback) ─────────────────────────────── */

/** One chip geometry for the whole console: hairline card, or ink fill when
 *  the chip is the marked one. Colour never carries the meaning alone. */
const CHIP = "f0-chip px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]";

const AV_SIZES: Record<string, string> = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-9 h-9 text-xs",
  lg: "w-12 h-12 text-sm",
  xl: "w-16 h-16 text-lg",
};

export function AdminAvatar({
  name,
  avatarUrl,
  tier,
  size = "md",
}: {
  name?: string | null;
  avatarUrl?: string | null;
  tier?: FamilyTier | null;
  size?: keyof typeof AV_SIZES;
}) {
  const ring =
    tier === "fta" ? "ring-2 ring-accent/60 ring-offset-1 ring-offset-card" : "";
  const base = `${AV_SIZES[size]} rounded-full shrink-0 ${ring}`;
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt={name || "Member"}
        loading="lazy"
        className={`${base} object-cover bg-paper`}
      />
    );
  }
  return (
    <div
      className={`${base} border border-sand bg-paper text-ink flex items-center justify-center font-bold`}
    >
      {initialsOf(name)}
    </div>
  );
}

/* ── chips ────────────────────────────────────────────────────────────────── */

export function TierChip({ tier }: { tier: FamilyTier }) {
  // FTA is the one tier the console marks; everything else is a hairline chip.
  return (
    <span className={`${CHIP} ${tier === "fta" ? "f0-chip-accent text-accent" : "text-soft"}`}>
      {TIER_CONFIG[tier].label}
    </span>
  );
}

export function RoleChip({ role }: { role: string }) {
  // Admin is the only role worth marking in a console full of members.
  return (
    <span className={`${CHIP} ${role === "admin" ? "f0-chip-on" : "text-soft"}`}>
      {role}
    </span>
  );
}

export function ContactKindChip({
  kind,
}: {
  kind: "lead" | "free" | "fic" | "fta";
}) {
  const META: Record<string, { label: string; cls: string }> = {
    lead: { label: "Lead", cls: "text-soft" },
    free: { label: "Free", cls: "text-soft" },
    fic: { label: "FIC", cls: "text-ink" },
    fta: { label: "FTA", cls: "f0-chip-accent text-accent" },
  };
  const m = META[kind] ?? META.free;
  return <span className={`${CHIP} ${m.cls}`}>{m.label}</span>;
}

/* Recency reads as WEIGHT, not hue — green/red belong to price. A live
   contact gets the solid accent dot, a cold one an empty hairline ring. */
const DOT: Record<string, string> = {
  today: "bg-accent",
  week: "bg-ink",
  month: "bg-soft",
  dormant: "bg-soft/40",
  never: "border border-sand",
};

export function LastSeenDot({ iso }: { iso: string | null | undefined }) {
  const bucket = recencyBucket(iso);
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${DOT[bucket]}`}
      title={`Activity: ${bucket}`}
    />
  );
}

/* ── activity timeline icon ───────────────────────────────────────────────── */

const ICONS: Record<
  TimelineType,
  { icon: typeof Zap; color: string; bg: string }
> = {
  xp: { icon: Zap, color: "text-accent", bg: "bg-accent/10" },
  lesson: { icon: BookOpen, color: "text-soft", bg: "bg-paper" },
  quiz: { icon: HelpCircle, color: "text-soft", bg: "bg-paper" },
  post: { icon: MessageSquare, color: "text-soft", bg: "bg-paper" },
  comment: { icon: MessageCircle, color: "text-soft", bg: "bg-paper" },
  mission: { icon: Target, color: "text-soft", bg: "bg-paper" },
  rsvp: { icon: CalendarCheck, color: "text-soft", bg: "bg-paper" },
  badge: { icon: Award, color: "text-soft", bg: "bg-paper" },
  chat: { icon: MessageCircle, color: "text-ink", bg: "bg-paper" },
  lead: { icon: UserPlus, color: "text-soft", bg: "bg-paper" },
  comm: { icon: Send, color: "text-soft", bg: "bg-paper" },
};

export function ActivityIcon({ type }: { type: TimelineType }) {
  const conf = ICONS[type] ?? {
    icon: Activity,
    color: "text-soft",
    bg: "bg-paper",
  };
  const Icon = conf.icon;
  return (
    <div
      className={`w-8 h-8 rounded-lg ${conf.bg} flex items-center justify-center shrink-0`}
    >
      <Icon className={`w-4 h-4 ${conf.color}`} />
    </div>
  );
}

/* ── stat tile ────────────────────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  sub,
  accent = "text-ink",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
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
      {sub ? <p className="mt-1 text-[11px] text-soft">{sub}</p> : null}
    </div>
  );
}

/* ── SVG bar chart (lightweight, admin-styled) ────────────────────────────── */

export function BarChart({
  data,
  color = "var(--accent-solid)",
  height = 140,
  format,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  format?: (d: { label: string; value: number }) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length || 1;
  const gap = 2;
  const barW = 100 / n;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 8);
          const x = i * barW;
          return (
            <g key={i}>
              <rect
                x={x + gap / 2}
                y={height - h}
                width={barW - gap}
                height={Math.max(h, d.value > 0 ? 1.5 : 0)}
                rx={0.6}
                fill={color}
                opacity={0.85}
              >
                <title>
                  {format ? format(d) : `${d.label}: ${d.value}`}
                </title>
              </rect>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── CRM sub-nav tabs ─────────────────────────────────────────────────────── */

export function CrmNav({ active }: { active: "overview" | "members" }) {
  const tabs = [
    { id: "overview", label: "Overview", href: "/admin/crm" },
    { id: "members", label: "Members", href: "/admin/crm/members" },
  ] as const;
  return (
    <div className="mb-6 flex items-center gap-2">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={active === t.id ? "page" : undefined}
          className={`f0-chip f0-press f0-focus px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${
            active === t.id ? "f0-chip-on" : "text-soft hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
