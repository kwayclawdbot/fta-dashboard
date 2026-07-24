"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Flame, Users, RefreshCw, Download, Activity, TrendingUp, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Cohort shape returned by the admin_challenge_cohort RPC (migration 126). */
interface CohortMember {
  email: string | null;
  first_name: string | null;
  created_at: string;
  user_id: string | null;
  onboarding_complete: boolean | null;
  tier: string | null;
  expires_at: string | null;
  /** Acquisition source (funnel vs organic) — from marketing_leads.custom.src. */
  src: string | null;
  xp: number;
  alert_rules: number;
  posts: number;
}
interface SequenceStat {
  step: string;
  sent: number;
  pending: number;
  other: number;
  first_scheduled: string;
}
interface CohortData {
  total: number;
  activated: number;
  engaged: number;
  converted_paid: number;
  pass_active: number;
  downgraded_free: number;
  signups_by_day: { day: string; signups: number }[];
  signups_by_source?: { source: string; signups: number }[];
  sequences?: SequenceStat[];
  members: CohortMember[];
}

/** Human labels for challenge_sequences steps (mirrors CHALLENGE_STEPS order). */
const STEP_LABELS: Record<string, string> = {
  welcome: "Registration welcome",
  aug_watchlist: "Aug · Community Watchlist",
  aug_kai: "Aug · Ask Kai + research",
  aug_screener: "Aug · Screener + alerts",
  aug_belts: "Aug · Belts + leaderboard",
  show_d3: "Show-up · D-3",
  show_d1: "Show-up · D-1",
  show_dayof: "Show-up · day-of",
  day1: "Day 1 · Foundations",
  day2: "Day 2 · Research with Kai",
  day3: "Day 3 · Community Watchlist",
  day4: "Day 4 · Screener + practice",
  day5: "Day 5 · Putting it together",
  close_stats: "Close · Week recap",
  close_offer: "Close · $99 + $1,500 offer",
  close_lastcall: "Close · Last call",
};
const STEP_ORDER = Object.keys(STEP_LABELS);

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function StatTile({
  label,
  value,
  sub,
  accent = "text-zinc-100",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ChallengeCohortPage() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<CohortData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rpc, error: rpcErr } = await supabase.rpc("admin_challenge_cohort");
      if (rpcErr) throw new Error(rpcErr.message);
      setData(rpc as CohortData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load challenge cohort");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["email", "first_name", "source", "signed_up", "activated", "tier", "pass_expires", "xp", "alert_rules", "posts"],
      ...data.members.map((m) => [
        m.email || "",
        m.first_name || "",
        m.src || "organic",
        m.created_at,
        m.onboarding_complete ? "yes" : "no",
        m.tier || "",
        m.expires_at || "",
        String(m.xp),
        String(m.alert_rules),
        String(m.posts),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `challenge-cohort-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const maxDay = data?.signups_by_day.reduce((m, d) => Math.max(m, d.signups), 0) || 0;

  // Acquisition split: funnel-attributed (any src) vs organic (no src). The RPC
  // buckets no-src signups under the literal 'organic' source.
  const sources = data?.signups_by_source ?? [];
  const sourceTotal = sources.reduce((n, s) => n + s.signups, 0);
  const funnelCount = sources
    .filter((s) => s.source !== "organic")
    .reduce((n, s) => n + s.signups, 0);
  const organicCount = sources
    .filter((s) => s.source === "organic")
    .reduce((n, s) => n + s.signups, 0);
  const SOURCE_LABELS: Record<string, string> = {
    funnel: "Challenge funnel",
    organic: "Organic / direct",
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" /> 5-Day Investing Challenge
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Cohort signups, activation, engagement and post-challenge conversion.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 px-2 py-1.5"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <Link
            href="/admin/crm"
            className="text-sm text-zinc-400 hover:text-amber-400 transition-colors"
          >
            ← Back to CRM
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Topline funnel */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatTile label="Signups" value={data.total} accent="text-zinc-100" />
            <StatTile
              label="Activated"
              value={data.activated}
              sub={`${pct(data.activated, data.total)}% finished wizard`}
              accent="text-lime-400"
            />
            <StatTile
              label="Engaged"
              value={data.engaged}
              sub={`${pct(data.engaged, data.total)}% XP / alerts / posts`}
              accent="text-sky-400"
            />
            <StatTile
              label="Pass active"
              value={data.pass_active}
              sub="full Club now"
              accent="text-amber-400"
            />
            <StatTile
              label="Converted"
              value={data.converted_paid}
              sub={`${pct(data.converted_paid, data.total)}% paid on`}
              accent="text-emerald-400"
            />
            <StatTile
              label="Downgraded"
              value={data.downgraded_free}
              sub="dropped to free"
              accent="text-zinc-400"
            />
          </div>

          {/* Signups over time */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-300">Signups over time</span>
            </div>
            {data.signups_by_day.length === 0 ? (
              <p className="text-xs text-zinc-600">No challenge signups yet.</p>
            ) : (
              <div className="space-y-2">
                {data.signups_by_day.map((d) => (
                  <div key={d.day} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-zinc-500 tabular-nums shrink-0">{d.day}</span>
                    <div className="flex-1 h-5 rounded bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded"
                        style={{ width: `${maxDay ? Math.max((d.signups / maxDay) * 100, 4) : 0}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs text-zinc-300 tabular-nums">{d.signups}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Acquisition source — funnel vs organic split */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-zinc-300">Acquisition source</span>
              <span className="text-[11px] text-zinc-600">(funnel vs organic)</span>
            </div>
            {sourceTotal === 0 ? (
              <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> No attributed signups yet — the
                club-site funnel stamps <code className="text-zinc-500">?src=funnel</code>;
                everything else counts as organic.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <StatTile
                    label="From the funnel"
                    value={funnelCount}
                    sub={`${pct(funnelCount, sourceTotal)}% of cohort`}
                    accent="text-emerald-400"
                  />
                  <StatTile
                    label="Organic / direct"
                    value={organicCount}
                    sub={`${pct(organicCount, sourceTotal)}% of cohort`}
                    accent="text-zinc-300"
                  />
                </div>
                <div className="space-y-2">
                  {sources.map((s) => (
                    <div key={s.source} className="flex items-center gap-3">
                      <span className="w-32 text-xs text-zinc-400 shrink-0 truncate">
                        {SOURCE_LABELS[s.source] || s.source}
                      </span>
                      <div className="flex-1 h-5 rounded bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded ${
                            s.source === "organic"
                              ? "bg-gradient-to-r from-zinc-600 to-zinc-500"
                              : "bg-gradient-to-r from-emerald-600 to-emerald-400"
                          }`}
                          style={{ width: `${sourceTotal ? Math.max((s.signups / sourceTotal) * 100, 4) : 0}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs text-zinc-300 tabular-nums">
                        {s.signups}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Email sequence status */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-zinc-300">Email sequence</span>
              <span className="text-[11px] text-zinc-600">
                (owner-directed; gated by challenge_emails_enabled)
              </span>
            </div>
            {(() => {
              const seq = data.sequences ?? [];
              const byStep = new Map(seq.map((s) => [s.step, s]));
              const totalSent = seq.reduce((n, s) => n + s.sent, 0);
              const totalPending = seq.reduce((n, s) => n + s.pending, 0);
              if (data.total === 0) {
                return (
                  <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> No cohort yet — steps schedule per signup.
                    16 templates ready: instant welcome, 4 August value emails, 3 show-up emails,
                    5 daily missions, 3 close emails.
                  </p>
                );
              }
              return (
                <>
                  <div className="flex gap-4 mb-3 text-xs text-zinc-400">
                    <span>
                      <span className="text-emerald-400 font-semibold tabular-nums">{totalSent}</span> sent
                    </span>
                    <span>
                      <span className="text-amber-400 font-semibold tabular-nums">{totalPending}</span> scheduled
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {STEP_ORDER.map((step) => {
                      const s = byStep.get(step);
                      return (
                        <div key={step} className="flex items-center gap-3 text-xs">
                          <span className="w-52 text-zinc-400 shrink-0 truncate">
                            {STEP_LABELS[step]}
                          </span>
                          <span className="w-16 text-right tabular-nums text-emerald-400">
                            {s ? s.sent : 0} sent
                          </span>
                          <span className="w-20 text-right tabular-nums text-amber-400">
                            {s ? s.pending : 0} pending
                          </span>
                          {s && s.other > 0 && (
                            <span className="text-right tabular-nums text-zinc-600">
                              {s.other} skip/supp
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>

          {/* Members */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-medium text-zinc-300">
                  Cohort members
                  <span className="text-zinc-600 ml-1.5">({data.members.length})</span>
                </span>
              </div>
              {data.members.length > 0 && (
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-md px-2.5 py-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              )}
            </div>
            {data.members.length === 0 ? (
              <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> No challenge signups yet — they'll appear here
                as the funnel drives them in.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                      <th className="py-2 pr-4 font-semibold">Member</th>
                      <th className="py-2 px-3 font-semibold">Source</th>
                      <th className="py-2 px-3 font-semibold">Wizard</th>
                      <th className="py-2 px-3 font-semibold">Tier</th>
                      <th className="py-2 px-3 font-semibold text-right">XP</th>
                      <th className="py-2 px-3 font-semibold text-right">Rules</th>
                      <th className="py-2 px-3 font-semibold text-right">Posts</th>
                      <th className="py-2 pl-3 font-semibold text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((m) => (
                      <tr key={(m.user_id || m.email) ?? Math.random()} className="border-b border-zinc-800/50">
                        <td className="py-2 pr-4 text-zinc-200">
                          {m.first_name || "—"}
                          <span className="text-zinc-600 ml-1.5 text-xs">{m.email}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              m.src && m.src !== "organic"
                                ? "bg-emerald-500/10 text-emerald-300"
                                : "bg-zinc-700/30 text-zinc-500"
                            }`}
                          >
                            {m.src && m.src !== "organic" ? m.src : "organic"}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              m.onboarding_complete
                                ? "bg-lime-500/10 text-lime-300"
                                : "bg-zinc-700/30 text-zinc-500"
                            }`}
                          >
                            {m.onboarding_complete ? "done" : "pending"}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              m.tier === "free"
                                ? "bg-zinc-700/30 text-zinc-400"
                                : m.tier === "fta"
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-sky-500/10 text-sky-300"
                            }`}
                          >
                            {m.tier || "—"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-zinc-300 tabular-nums">{m.xp}</td>
                        <td className="py-2 px-3 text-right text-zinc-400 tabular-nums">{m.alert_rules}</td>
                        <td className="py-2 px-3 text-right text-zinc-400 tabular-nums">{m.posts}</td>
                        <td className="py-2 pl-3 text-right text-zinc-500 text-xs">
                          {new Date(m.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
