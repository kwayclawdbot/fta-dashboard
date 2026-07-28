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
        <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] text-ink flex items-center gap-2">
          <Filter className="w-5 h-5 text-accent" /> Free-Class Funnel
        </h1>
        <p className="text-soft text-sm mt-1">
          Per-step conversion, source attribution and partial leads.
        </p>
      </div>
      <Link
        href="/admin/crm"
        className="text-sm text-soft hover:text-accent-strong transition-colors"
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
  accent = "text-ink",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="club-b-card p-4">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-soft mt-1">{label}</p>
      {sub && <p className="text-[11px] text-soft/70 mt-0.5">{sub}</p>}
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
          className="bg-paper border border-sand rounded-md px-3 py-1.5 text-sm text-ink"
        />
        <span className="text-soft/70 text-sm">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="bg-paper border border-sand rounded-md px-3 py-1.5 text-sm text-ink"
        />
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-strong px-2 py-1.5"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-accent">
          {error}
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Topline */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Sessions started" value={data.totals.sessions} accent="text-ink" />
            <StatTile
              label="Engaged"
              value={data.totals.engaged}
              sub={`${pct(data.totals.engaged, data.totals.sessions)}% of sessions`}
              accent="text-soft"
            />
            <StatTile
              label="Emails captured"
              value={data.totals.email_captured}
              sub={`${pct(data.totals.email_captured, data.totals.sessions)}% of sessions`}
              accent="text-soft"
            />
            <StatTile
              label="Registered"
              value={data.totals.registered}
              sub={`${pct(data.totals.registered, data.totals.sessions)}% conversion`}
              accent="text-accent"
            />
          </div>

          {/* Per-step funnel */}
          <div className="club-b-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-soft" />
              <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">Step-by-step conversion</span>
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
                      <span className="text-ink font-medium">{STEP_LABEL[s.step] || s.step}</span>
                      <span className="text-soft font-mono tabular-nums">
                        {s.sessions} · {fromLanding}% of landing
                        {i > 0 && (
                          <span className={stepDrop < 60 ? "text-accent ml-1.5" : "text-soft/70 ml-1.5"}>
                            ({stepDrop}% step)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-6 rounded-md bg-paper overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent to-accent rounded-md transition-all"
                        style={{ width: `${Math.max(width, s.sessions > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Source / UTM breakdown */}
          <div className="club-b-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <ArrowRight className="w-4 h-4 text-soft" />
              <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">Source attribution</span>
            </div>
            {data.sources.length === 0 ? (
              <p className="text-xs text-soft/70">No sessions in range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-left font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft border-b border-sand">
                      <th className="py-2 pr-4 font-semibold">utm_source</th>
                      <th className="py-2 px-3 font-semibold text-right">Sessions</th>
                      <th className="py-2 px-3 font-semibold text-right">Emails</th>
                      <th className="py-2 px-3 font-semibold text-right">Registered</th>
                      <th className="py-2 pl-3 font-semibold text-right">Conv %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sources.map((s) => (
                      <tr key={s.source} className="border-b border-sand">
                        <td className="py-2 pr-4 text-ink">{s.source}</td>
                        <td className="py-2 px-3 text-right text-ink font-mono tabular-nums">{s.sessions}</td>
                        <td className="py-2 px-3 text-right text-soft font-mono tabular-nums">{s.email_captured}</td>
                        <td className="py-2 px-3 text-right text-accent font-mono tabular-nums">{s.registered}</td>
                        <td className="py-2 pl-3 text-right text-soft font-mono tabular-nums">
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
          <div className="club-b-card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-soft" />
                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                  Partial leads
                  <span className="text-soft/70 ml-1.5">
                    · email given, not registered ({leads.length})
                  </span>
                </span>
              </div>
              {leads.length > 0 && (
                <button
                  onClick={exportLeads}
                  className="inline-flex items-center gap-1.5 text-xs text-soft hover:text-ink border border-sand rounded-md px-2.5 py-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              )}
            </div>
            {leads.length === 0 ? (
              <p className="text-xs text-soft/70 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> No abandoned email leads in range — everyone
                who left an email finished.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-left font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft border-b border-sand">
                      <th className="py-2 pr-4 font-semibold">Email</th>
                      <th className="py-2 px-3 font-semibold">Status</th>
                      <th className="py-2 px-3 font-semibold">Source</th>
                      <th className="py-2 px-3 font-semibold">SMS</th>
                      <th className="py-2 pl-3 font-semibold text-right">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr key={l.id} className="border-b border-sand">
                        <td className="py-2 pr-4 text-ink">{l.email}</td>
                        <td className="py-2 px-3">
                          <span className="f0-chip px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-soft">
                            {l.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-soft">{l.utm_source}</td>
                        <td className="py-2 px-3 text-soft">{l.sms_optin ? "✓" : "—"}</td>
                        <td className="py-2 pl-3 text-right text-soft text-xs">
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
