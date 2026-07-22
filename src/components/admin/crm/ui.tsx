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
import {
  tierChipClass,
  roleChipClass,
  recencyBucket,
  type TimelineType,
} from "@/lib/crm";

/* ── Avatar (admin dark theme, initials fallback) ─────────────────────────── */

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
    tier === "fta" ? "ring-2 ring-amber-400/60 ring-offset-1 ring-offset-[#0a0a0f]" : "";
  const base = `${AV_SIZES[size]} rounded-full shrink-0 ${ring}`;
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt={name || "Member"}
        loading="lazy"
        className={`${base} object-cover bg-zinc-800`}
      />
    );
  }
  return (
    <div
      className={`${base} bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold`}
    >
      {initialsOf(name)}
    </div>
  );
}

/* ── chips ────────────────────────────────────────────────────────────────── */

export function TierChip({ tier }: { tier: FamilyTier }) {
  return (
    <span
      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${tierChipClass(
        tier
      )}`}
    >
      {TIER_CONFIG[tier].label}
    </span>
  );
}

export function RoleChip({ role }: { role: string }) {
  return (
    <span
      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${roleChipClass(
        role
      )}`}
    >
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
    lead: { label: "Lead", cls: "text-sky-300 bg-sky-500/10" },
    free: { label: "Free", cls: "text-zinc-300 bg-zinc-700/50" },
    fic: { label: "FIC", cls: "text-blue-300 bg-blue-500/10" },
    fta: { label: "FTA", cls: "text-amber-300 bg-amber-400/10" },
  };
  const m = META[kind] ?? META.free;
  return (
    <span
      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

const DOT: Record<string, string> = {
  today: "bg-emerald-400",
  week: "bg-lime-400",
  month: "bg-amber-400",
  dormant: "bg-red-400",
  never: "bg-zinc-600",
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
  xp: { icon: Zap, color: "text-amber-400", bg: "bg-amber-400/10" },
  lesson: { icon: BookOpen, color: "text-emerald-400", bg: "bg-emerald-400/10" },
  quiz: { icon: HelpCircle, color: "text-blue-400", bg: "bg-blue-400/10" },
  post: { icon: MessageSquare, color: "text-purple-400", bg: "bg-purple-400/10" },
  comment: { icon: MessageCircle, color: "text-purple-300", bg: "bg-purple-400/10" },
  mission: { icon: Target, color: "text-pink-400", bg: "bg-pink-400/10" },
  rsvp: { icon: CalendarCheck, color: "text-sky-400", bg: "bg-sky-400/10" },
  badge: { icon: Award, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  chat: { icon: MessageCircle, color: "text-zinc-300", bg: "bg-zinc-700/40" },
  lead: { icon: UserPlus, color: "text-sky-400", bg: "bg-sky-400/10" },
  comm: { icon: Send, color: "text-teal-400", bg: "bg-teal-400/10" },
};

export function ActivityIcon({ type }: { type: TimelineType }) {
  const conf = ICONS[type] ?? {
    icon: Activity,
    color: "text-zinc-400",
    bg: "bg-zinc-800",
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
  accent = "text-zinc-100",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
      {sub ? <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p> : null}
    </div>
  );
}

/* ── SVG bar chart (lightweight, admin-styled) ────────────────────────────── */

export function BarChart({
  data,
  color = "#fbbf24",
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
    <div className="flex items-center gap-1 border-b border-zinc-800 mb-6">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
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
