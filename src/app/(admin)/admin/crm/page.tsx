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
  // One series is on screen at a time, so the bars are always the brand
  // accent — four hues here only ever meant "four different charts".
  { id: "active_users", label: "Active / day", color: "var(--accent-solid)" },
  { id: "signups", label: "Signups / day", color: "var(--accent-solid)" },
  { id: "posts", label: "Posts / day", color: "var(--accent-solid)" },
  { id: "lessons_completed", label: "Lessons / day", color: "var(--accent-solid)" },
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
        <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] text-ink">CRM</h1>
        <p className="text-soft text-sm mt-1">
          Members, families and platform activity
        </p>
      </div>


      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-accent">
          {error}
        </div>
      ) : overview ? (
        <div className="space-y-6">
          {/* Topline metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatTile
              label="Total members"
              value={overview.total_members}
              accent="text-ink"
            />
            <StatTile
              label="Families"
              value={overview.total_families}
              accent="text-ink"
            />
            <StatTile
              label="DAU"
              value={overview.dau}
              sub="active today"
              accent="text-soft"
            />
            <StatTile
              label="WAU"
              value={overview.wau}
              sub="active 7d"
              accent="text-soft"
            />
            <StatTile
              label="MAU"
              value={overview.mau}
              sub="active 30d"
              accent="text-accent"
            />
            <StatTile
              label="Tier split"
              value={
                <span className="text-base">
                  <span className="text-accent">{overview.tier_fta}</span>
                  <span className="text-soft/70"> / </span>
                  <span className="text-ink">{overview.tier_fic}</span>
                </span>
              }
              sub="FTA / FIC families"
            />
          </div>

          {/* Member tier breakdown bar */}
          <div className="club-b-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-soft" />
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                  Members by tier
                </span>
              </div>
              <span className="text-xs text-soft">
                {overview.members_fta} FTA · {overview.members_fic} FIC
              </span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden border border-sand bg-paper">
              <div
                className="bg-accent"
                style={{
                  width: `${
                    (overview.members_fta /
                      Math.max(1, overview.total_members)) *
                    100
                  }%`,
                }}
              />
              <div
                className="bg-ink/30"
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
          <div className="club-b-card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-soft" />
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                  Last 30 days
                </span>
                <span className="text-xs text-soft">
                  · {metricTotal} total
                </span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {METRICS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMetric(m.id)}
                    type="button"
                    aria-pressed={metric === m.id}
                    className={`f0-chip f0-press f0-focus px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                      metric === m.id ? "f0-chip-on" : "text-soft hover:text-ink"
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
            <div className="flex justify-between mt-2 text-[10px] text-soft/70">
              <span>{chartData[0]?.label}</span>
              <span>{chartData[chartData.length - 1]?.label}</span>
            </div>
          </div>

          {/* Three columns: newest, active families, at-risk */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Newest signups */}
            <div className="club-b-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-4 h-4 text-soft" />
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                  Newest signups
                </span>
              </div>
              <div className="space-y-2">
                {overview.newest_signups.length === 0 ? (
                  <p className="text-xs text-soft/70">No signups yet</p>
                ) : (
                  overview.newest_signups.map((m) => (
                    <Link
                      key={m.id}
                      href={`/admin/crm/members/${m.id}`}
                      className="flex items-center gap-2.5 py-1 rounded-md hover:bg-paper -mx-1 px-1 transition-colors"
                    >
                      <AdminAvatar
                        name={m.display_name}
                        avatarUrl={m.avatar_url}
                        tier={m.tier}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink truncate">
                          {m.display_name || "—"}
                        </p>
                        <p className="text-[11px] text-soft truncate">
                          {m.family_name || "No family"}
                        </p>
                      </div>
                      <span className="text-[10px] text-soft/70 shrink-0">
                        {relativeTime(m.joined_at)}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Most active families */}
            <div className="club-b-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-accent" />
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                  Most active families
                </span>
                <span className="text-[10px] text-soft/70">7d</span>
              </div>
              <div className="space-y-2">
                {overview.active_families.length === 0 ? (
                  <p className="text-xs text-soft/70">No activity this week</p>
                ) : (
                  overview.active_families.map((f) => (
                    <Link
                      key={f.family_id}
                      href={`/admin/crm/families/${f.family_id}`}
                      className="flex items-center gap-2 py-1 rounded-md hover:bg-paper -mx-1 px-1 transition-colors"
                    >
                      <Home className="w-3.5 h-3.5 text-soft shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink truncate">
                          {f.name || "Unnamed family"}
                        </p>
                        <p className="text-[11px] text-soft">
                          {f.active_members} active
                        </p>
                      </div>
                      <TierChip tier={f.tier} />
                      <span className="text-xs font-semibold text-accent shrink-0">
                        {f.events_7d}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* At-risk */}
            <div className="club-b-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-accent" />
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                  At risk
                </span>
                <span className="text-[10px] text-soft/70">14d+ inactive</span>
              </div>
              <div className="space-y-2">
                {overview.at_risk.length === 0 ? (
                  <p className="text-xs text-soft/70">
                    Nobody dormant — nice.
                  </p>
                ) : (
                  overview.at_risk.map((m) => (
                    <Link
                      key={m.id}
                      href={`/admin/crm/members/${m.id}`}
                      className="flex items-center gap-2.5 py-1 rounded-md hover:bg-paper -mx-1 px-1 transition-colors"
                    >
                      <AdminAvatar
                        name={m.display_name}
                        avatarUrl={m.avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink truncate">
                          {m.display_name || "—"}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <RoleChip role={m.role} />
                          <span className="text-[11px] text-soft truncate">
                            {m.family_name || "No family"}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-accent shrink-0">
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
              className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent-strong transition-colors"
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
