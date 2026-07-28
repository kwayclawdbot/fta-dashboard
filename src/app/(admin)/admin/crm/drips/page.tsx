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
  sent: "f0-chip-on",
  pending: "f0-chip-accent text-accent",
  failed: "f0-chip-accent text-accent",
  skipped: "text-soft",
  suppressed: "text-soft",
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
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] text-ink flex items-center gap-2">
            <Mail className="w-5 h-5 text-accent" /> Welcome Drip
          </h1>
          <p className="text-soft text-sm mt-1">
            5-email series (D0/D1/D3/D5/D7) auto-enrolled at wizard completion. Sent daily by cron.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="text-sm text-soft hover:text-accent-strong transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <Link href="/admin/crm" className="text-sm text-soft hover:text-accent-strong transition-colors">
            ← Back to CRM
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
          {error}
        </div>
      )}

      {/* Hard gate */}
      <div className="mb-6 club-b-card p-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="text-sm font-semibold text-ink flex items-center gap-2">
            Sending {enabled === null ? "…" : enabled ? "ENABLED" : "PAUSED"}
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                enabled ? "bg-accent" : "border border-sand"
              }`}
            />
          </div>
          <div className="text-xs text-soft mt-1 max-w-lg">
            While paused the cron enrolls members but sends zero mail. Flip this on only after the
            template look is approved. {totalPending} step{totalPending === 1 ? "" : "s"} queued.
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={busy || enabled === null}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
            enabled
              ? "bg-accent/15 text-accent hover:bg-accent/25"
              : "bg-card text-soft hover:bg-paper"
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
            <div key={s} className="club-b-card p-4">
              <div className="text-xs font-semibold text-accent">{STEP_LABEL[s]}</div>
              <div className="font-mono text-2xl font-semibold tabular-nums text-ink mt-1">{c.sent || 0}</div>
              <div className="text-[11px] text-soft mt-1">
                sent · {c.pending || 0} queued
                {c.failed ? ` · ${c.failed} failed` : ""}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-sm text-soft mb-2">
        {totalSent} sent · {totalPending} queued · showing latest {rows.length}
      </div>

      {/* Recent rows */}
      <div className="club-b-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
            <tr>
              <th className="text-left font-medium px-4 py-3">Member</th>
              <th className="text-left font-medium px-4 py-3">Step</th>
              <th className="text-left font-medium px-4 py-3">Variant</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-left font-medium px-4 py-3">When</th>
              <th className="text-left font-medium px-4 py-3">Resend ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-soft">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-soft">
                  No drip enrollments yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-paper">
                  <td className="px-4 py-3">
                    <div className="text-ink">{r.profiles?.display_name || "—"}</div>
                    <div className="text-xs text-soft">{r.profiles?.email || r.user_id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3 text-ink">{STEP_LABEL[r.step] ?? r.step}</td>
                  <td className="px-4 py-3 text-soft">{r.variant}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`f0-chip px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                        STATUS_STYLE[r.status] || "text-soft"
                      }`}
                    >
                      {r.status}
                    </span>
                    {r.error && <div className="text-[11px] text-accent mt-1">{r.error}</div>}
                  </td>
                  <td className="px-4 py-3 text-soft">
                    {r.sent_at ? relTime(r.sent_at) : `sched ${relTime(r.scheduled_at)}`}
                  </td>
                  <td className="px-4 py-3 text-xs text-soft font-mono">
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
