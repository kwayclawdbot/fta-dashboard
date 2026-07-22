"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Filter, Users, Mail, UserCheck, ArrowRight, RefreshCw, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchFunnelAnalytics,
  fetchFunnelPartialLeads,
  STEP_LABEL,
  pct,
  type FunnelAnalytics,
  type PartialLead,
} from "@/lib/funnel-admin";

/** Local CRM sub-nav — a narrow link back so this page stays self-owned. */
function FunnelHeader() {
  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Filter className="w-5 h-5 text-amber-400" /> Free-Class Funnel
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Per-step conversion, source attribution and partial leads.
        </p>
      </div>
      <Link
        href="/admin/crm"
        className="text-sm text-zinc-400 hover:text-amber-400 transition-colors"
      >
        ← Back to CRM
      </Link>
    </div>
  );
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

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function FunnelAnalyticsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 30 * 864e5)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [data, setData] = useState<FunnelAnalytics | null>(null);
  const [leads, setLeads] = useState<PartialLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromIso = new Date(`${from}T00:00:00`).toISOString();
      const toIso = new Date(`${to}T23:59:59`).toISOString();
      const [a, l] = await Promise.all([
        fetchFunnelAnalytics(supabase, fromIso, toIso),
        fetchFunnelPartialLeads(supabase, fromIso, toIso),
      ]);
      setData(a);
      setLeads(l);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load funnel analytics");
    } finally {
      setLoading(false);
    }
  }, [supabase, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const topStep = data?.steps.reduce((m, s) => Math.max(m, s.sessions), 0) || 0;
  const landing = data?.steps.find((s) => s.step === "landing")?.sessions || 0;

  function exportLeads() {
    const rows = [
      ["email", "phone", "sms_optin", "status", "utm_source", "utm_campaign", "created_at"],
      ...leads.map((l) => [
        l.email,
        l.phone || "",
        String(l.sms_optin),
        l.status,
        l.utm_source,
        l.utm_campaign || "",
        l.created_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `funnel-partial-leads-${from}_${to}.csv`;
    a.click();
  }

  return (
    <div className="max-w-6xl mx-auto">
      <FunnelHeader />

      {/* Date range */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200"
        />
        <span className="text-zinc-600 text-sm">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-zinc-200"
        />
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 px-2 py-1.5"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
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
          {/* Topline */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Sessions started" value={data.totals.sessions} accent="text-zinc-100" />
            <StatTile
              label="Engaged"
              value={data.totals.engaged}
              sub={`${pct(data.totals.engaged, data.totals.sessions)}% of sessions`}
              accent="text-lime-400"
            />
            <StatTile
              label="Emails captured"
              value={data.totals.email_captured}
              sub={`${pct(data.totals.email_captured, data.totals.sessions)}% of sessions`}
              accent="text-sky-400"
            />
            <StatTile
              label="Registered"
              value={data.totals.registered}
              sub={`${pct(data.totals.registered, data.totals.sessions)}% conversion`}
              accent="text-amber-400"
            />
          </div>

          {/* Per-step funnel */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-300">Step-by-step conversion</span>
            </div>
            <div className="space-y-2.5">
              {data.steps.map((s, i) => {
                const prev = i > 0 ? data.steps[i - 1].sessions : s.sessions;
                const width = topStep ? (s.sessions / topStep) * 100 : 0;
                const fromLanding = pct(s.sessions, landing);
                const stepDrop = i > 0 ? pct(s.sessions, prev) : 100;
                return (
                  <div key={s.step}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-zinc-300 font-medium">{STEP_LABEL[s.step] || s.step}</span>
                      <span className="text-zinc-500 tabular-nums">
                        {s.sessions} · {fromLanding}% of landing
                        {i > 0 && (
                          <span className={stepDrop < 60 ? "text-red-400/80 ml-1.5" : "text-zinc-600 ml-1.5"}>
                            ({stepDrop}% step)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-6 rounded-md bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-md transition-all"
                        style={{ width: `${Math.max(width, s.sessions > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Source / UTM breakdown */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ArrowRight className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-300">Source attribution</span>
            </div>
            {data.sources.length === 0 ? (
              <p className="text-xs text-zinc-600">No sessions in range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                      <th className="py-2 pr-4 font-semibold">utm_source</th>
                      <th className="py-2 px-3 font-semibold text-right">Sessions</th>
                      <th className="py-2 px-3 font-semibold text-right">Emails</th>
                      <th className="py-2 px-3 font-semibold text-right">Registered</th>
                      <th className="py-2 pl-3 font-semibold text-right">Conv %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sources.map((s) => (
                      <tr key={s.source} className="border-b border-zinc-800/50">
                        <td className="py-2 pr-4 text-zinc-200">{s.source}</td>
                        <td className="py-2 px-3 text-right text-zinc-300 tabular-nums">{s.sessions}</td>
                        <td className="py-2 px-3 text-right text-sky-400 tabular-nums">{s.email_captured}</td>
                        <td className="py-2 px-3 text-right text-amber-400 tabular-nums">{s.registered}</td>
                        <td className="py-2 pl-3 text-right text-zinc-400 tabular-nums">
                          {pct(s.registered, s.sessions)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Partial leads */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-medium text-zinc-300">
                  Partial leads
                  <span className="text-zinc-600 ml-1.5">
                    · email given, not registered ({leads.length})
                  </span>
                </span>
              </div>
              {leads.length > 0 && (
                <button
                  onClick={exportLeads}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-md px-2.5 py-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              )}
            </div>
            {leads.length === 0 ? (
              <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> No abandoned email leads in range — everyone
                who left an email finished.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                      <th className="py-2 pr-4 font-semibold">Email</th>
                      <th className="py-2 px-3 font-semibold">Status</th>
                      <th className="py-2 px-3 font-semibold">Source</th>
                      <th className="py-2 px-3 font-semibold">SMS</th>
                      <th className="py-2 pl-3 font-semibold text-right">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr key={l.id} className="border-b border-zinc-800/50">
                        <td className="py-2 pr-4 text-zinc-200">{l.email}</td>
                        <td className="py-2 px-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300">
                            {l.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-zinc-400">{l.utm_source}</td>
                        <td className="py-2 px-3 text-zinc-400">{l.sms_optin ? "✓" : "—"}</td>
                        <td className="py-2 pl-3 text-right text-zinc-500 text-xs">
                          {new Date(l.created_at).toLocaleDateString("en-US", {
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
