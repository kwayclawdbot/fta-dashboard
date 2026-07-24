"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mail, RefreshCw, Power, PowerOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Welcome-drip visibility (Lane 13B) — recent sends, per-step counts, and the
 *  drip_enabled hard gate. Deliberately minimal: no builder. */

const STEP_ORDER = [0, 1, 3, 5, 7] as const;
const STEP_LABEL: Record<number, string> = { 0: "D0", 1: "D1", 3: "D3", 5: "D5", 7: "D7" };
const STATUS_STYLE: Record<string, string> = {
  sent: "text-emerald-300 bg-emerald-500/10",
  pending: "text-amber-300 bg-amber-500/10",
  failed: "text-red-300 bg-red-500/10",
  skipped: "text-zinc-400 bg-zinc-500/10",
  suppressed: "text-zinc-400 bg-zinc-500/10",
};

interface DripRow {
  id: string;
  user_id: string;
  step: number;
  variant: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  resend_id: string | null;
  error: string | null;
  profiles: { display_name: string | null; email: string | null } | null;
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  if (m < 60) return `${diff < 0 ? "in " : ""}${m}m${diff < 0 ? "" : " ago"}`;
  const h = Math.round(m / 60);
  if (h < 48) return `${diff < 0 ? "in " : ""}${h}h${diff < 0 ? "" : " ago"}`;
  return new Date(iso).toLocaleDateString();
}

export default function DripsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<DripRow[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [{ data: drips, error: dErr }, { data: flag }] = await Promise.all([
      supabase
        .from("email_drips")
        .select(
          "id, user_id, step, variant, status, scheduled_at, sent_at, resend_id, error, profiles(display_name, email)"
        )
        .order("scheduled_at", { ascending: false })
        .limit(200),
      supabase.from("app_settings").select("value").eq("key", "drip_enabled").maybeSingle(),
    ]);
    if (dErr) setError(dErr.message);
    setRows((drips as unknown as DripRow[]) ?? []);
    setEnabled(flag?.value === true);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = useCallback(async () => {
    if (enabled === null) return;
    setBusy(true);
    const next = !enabled;
    const { error: uErr } = await supabase
      .from("app_settings")
      .upsert(
        { key: "drip_enabled", value: next, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (uErr) setError(uErr.message);
    else setEnabled(next);
    setBusy(false);
  }, [enabled, supabase]);

  // Per-step / per-status counts.
  const counts = useMemo(() => {
    const byStep: Record<number, Record<string, number>> = {};
    for (const s of STEP_ORDER) byStep[s] = {};
    for (const r of rows) {
      const b = byStep[r.step] ?? (byStep[r.step] = {});
      b[r.status] = (b[r.status] || 0) + 1;
    }
    return byStep;
  }, [rows]);

  const totalSent = rows.filter((r) => r.status === "sent").length;
  const totalPending = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" /> Welcome Drip
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            5-email series (D0/D1/D3/D5/D7) auto-enrolled at wizard completion. Sent daily by cron.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="text-sm text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <Link href="/admin/crm" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors">
            ← Back to CRM
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Hard gate */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            Sending {enabled === null ? "…" : enabled ? "ENABLED" : "PAUSED"}
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                enabled ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
          </div>
          <div className="text-xs text-zinc-500 mt-1 max-w-lg">
            While paused the cron enrolls members but sends zero mail. Flip this on only after the
            template look is approved. {totalPending} step{totalPending === 1 ? "" : "s"} queued.
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={busy || enabled === null}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
            enabled
              ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
              : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
          }`}
        >
          {enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          {enabled ? "Pause sending" : "Enable sending"}
        </button>
      </div>

      {/* Per-step counts */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {STEP_ORDER.map((s) => {
          const c = counts[s] || {};
          return (
            <div key={s} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-xs font-semibold text-amber-400">{STEP_LABEL[s]}</div>
              <div className="text-2xl font-bold text-zinc-100 mt-1">{c.sent || 0}</div>
              <div className="text-[11px] text-zinc-500 mt-1">
                sent · {c.pending || 0} queued
                {c.failed ? ` · ${c.failed} failed` : ""}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-sm text-zinc-500 mb-2">
        {totalSent} sent · {totalPending} queued · showing latest {rows.length}
      </div>

      {/* Recent rows */}
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-400 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-4 py-3">Member</th>
              <th className="text-left font-medium px-4 py-3">Step</th>
              <th className="text-left font-medium px-4 py-3">Variant</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-left font-medium px-4 py-3">When</th>
              <th className="text-left font-medium px-4 py-3">Resend ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  No drip enrollments yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-900/40">
                  <td className="px-4 py-3">
                    <div className="text-zinc-200">{r.profiles?.display_name || "—"}</div>
                    <div className="text-xs text-zinc-500">{r.profiles?.email || r.user_id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{STEP_LABEL[r.step] ?? r.step}</td>
                  <td className="px-4 py-3 text-zinc-400">{r.variant}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[r.status] || "text-zinc-400 bg-zinc-500/10"
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.error && <div className="text-[11px] text-red-400/80 mt-1">{r.error}</div>}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {r.sent_at ? relTime(r.sent_at) : `sched ${relTime(r.scheduled_at)}`}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 font-mono">
                    {r.resend_id ? r.resend_id.slice(0, 12) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
