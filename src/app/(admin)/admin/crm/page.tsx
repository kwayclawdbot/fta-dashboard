"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Home,
  Activity,
  TrendingUp,
  AlertTriangle,
  UserPlus,
  Flame,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchOverview,
  fetchDaily,
  relativeTime,
  shortDate,
  type CrmOverview,
  type DailyPoint,
} from "@/lib/crm";
import {
  StatTile,
  BarChart,
  AdminAvatar,
  TierChip,
  RoleChip,
} from "@/components/admin/crm/ui";

type Metric = "active_users" | "signups" | "posts" | "lessons_completed";
const METRICS: { id: Metric; label: string; color: string }[] = [
  { id: "active_users", label: "Active / day", color: "#fbbf24" },
  { id: "signups", label: "Signups / day", color: "#34d399" },
  { id: "posts", label: "Posts / day", color: "#a78bfa" },
  { id: "lessons_completed", label: "Lessons / day", color: "#60a5fa" },
];

export default function CrmOverviewPage() {
  const supabase = createClient();
  const [overview, setOverview] = useState<CrmOverview | null>(null);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [metric, setMetric] = useState<Metric>("active_users");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ov, dl] = await Promise.all([
        fetchOverview(supabase),
        fetchDaily(supabase, 30),
      ]);
      setOverview(ov);
      setDaily(dl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load CRM overview");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const metricConf = METRICS.find((m) => m.id === metric)!;
  const chartData = daily.map((d) => ({
    label: shortDate(d.day),
    value: d[metric],
  }));
  const metricTotal = daily.reduce((s, d) => s + d[metric], 0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">CRM</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Members, families and platform activity
        </p>
      </div>


      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      ) : overview ? (
        <div className="space-y-6">
          {/* Topline metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatTile
              label="Total members"
              value={overview.total_members}
              accent="text-zinc-100"
            />
            <StatTile
              label="Families"
              value={overview.total_families}
              accent="text-zinc-100"
            />
            <StatTile
              label="DAU"
              value={overview.dau}
              sub="active today"
              accent="text-emerald-400"
            />
            <StatTile
              label="WAU"
              value={overview.wau}
              sub="active 7d"
              accent="text-lime-400"
            />
            <StatTile
              label="MAU"
              value={overview.mau}
              sub="active 30d"
              accent="text-amber-400"
            />
            <StatTile
              label="Tier split"
              value={
                <span className="text-base">
                  <span className="text-amber-400">{overview.tier_fta}</span>
                  <span className="text-zinc-600"> / </span>
                  <span className="text-zinc-300">{overview.tier_fic}</span>
                </span>
              }
              sub="FTA / FIC families"
            />
          </div>

          {/* Member tier breakdown bar */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-300">
                  Members by tier
                </span>
              </div>
              <span className="text-xs text-zinc-500">
                {overview.members_fta} FTA · {overview.members_fic} FIC
              </span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-zinc-800">
              <div
                className="bg-amber-400"
                style={{
                  width: `${
                    (overview.members_fta /
                      Math.max(1, overview.total_members)) *
                    100
                  }%`,
                }}
              />
              <div
                className="bg-zinc-600"
                style={{
                  width: `${
                    (overview.members_fic /
                      Math.max(1, overview.total_members)) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Activity chart */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-300">
                  Last 30 days
                </span>
                <span className="text-xs text-zinc-500">
                  · {metricTotal} total
                </span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {METRICS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMetric(m.id)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                      metric === m.id
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <BarChart
              data={chartData}
              color={metricConf.color}
              format={(d) => `${d.label}: ${d.value}`}
            />
            <div className="flex justify-between mt-2 text-[10px] text-zinc-600">
              <span>{chartData[0]?.label}</span>
              <span>{chartData[chartData.length - 1]?.label}</span>
            </div>
          </div>

          {/* Three columns: newest, active families, at-risk */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Newest signups */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-zinc-300">
                  Newest signups
                </span>
              </div>
              <div className="space-y-2">
                {overview.newest_signups.length === 0 ? (
                  <p className="text-xs text-zinc-600">No signups yet</p>
                ) : (
                  overview.newest_signups.map((m) => (
                    <Link
                      key={m.id}
                      href={`/admin/crm/members/${m.id}`}
                      className="flex items-center gap-2.5 py-1 rounded-md hover:bg-zinc-800/40 -mx-1 px-1 transition-colors"
                    >
                      <AdminAvatar
                        name={m.display_name}
                        avatarUrl={m.avatar_url}
                        tier={m.tier}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200 truncate">
                          {m.display_name || "—"}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {m.family_name || "No family"}
                        </p>
                      </div>
                      <span className="text-[10px] text-zinc-600 shrink-0">
                        {relativeTime(m.joined_at)}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Most active families */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-zinc-300">
                  Most active families
                </span>
                <span className="text-[10px] text-zinc-600">7d</span>
              </div>
              <div className="space-y-2">
                {overview.active_families.length === 0 ? (
                  <p className="text-xs text-zinc-600">No activity this week</p>
                ) : (
                  overview.active_families.map((f) => (
                    <Link
                      key={f.family_id}
                      href={`/admin/crm/families/${f.family_id}`}
                      className="flex items-center gap-2 py-1 rounded-md hover:bg-zinc-800/40 -mx-1 px-1 transition-colors"
                    >
                      <Home className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200 truncate">
                          {f.name || "Unnamed family"}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {f.active_members} active
                        </p>
                      </div>
                      <TierChip tier={f.tier} />
                      <span className="text-xs font-semibold text-amber-400 shrink-0">
                        {f.events_7d}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* At-risk */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium text-zinc-300">
                  At risk
                </span>
                <span className="text-[10px] text-zinc-600">14d+ inactive</span>
              </div>
              <div className="space-y-2">
                {overview.at_risk.length === 0 ? (
                  <p className="text-xs text-zinc-600">
                    Nobody dormant — nice.
                  </p>
                ) : (
                  overview.at_risk.map((m) => (
                    <Link
                      key={m.id}
                      href={`/admin/crm/members/${m.id}`}
                      className="flex items-center gap-2.5 py-1 rounded-md hover:bg-zinc-800/40 -mx-1 px-1 transition-colors"
                    >
                      <AdminAvatar
                        name={m.display_name}
                        avatarUrl={m.avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200 truncate">
                          {m.display_name || "—"}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <RoleChip role={m.role} />
                          <span className="text-[11px] text-zinc-500 truncate">
                            {m.family_name || "No family"}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-red-400/80 shrink-0">
                        {relativeTime(m.last_seen)}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              href="/admin/crm/members"
              className="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              View full member directory
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
