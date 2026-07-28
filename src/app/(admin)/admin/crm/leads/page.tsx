"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  UserPlus,
  Search,
  Facebook,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchLeads,
  importLeads,
  addLead,
  parseCsv,
  guessColumnMap,
  EMAIL_RE,
  leadName,
  relativeTime,
  STAGES,
  PIPELINE_STAGES,
  type Lead,
  type Stage,
  type ImportRow,
} from "@/lib/marketing";
import {
  StageBadge,
  SourceBadge,
  ColdBadge,
  TagPill,
  MiniStat,
} from "@/components/admin/crm/marketing-ui";

type FieldKey = "email" | "first_name" | "last_name" | "phone" | "tags";
const FIELD_LABELS: Record<FieldKey, string> = {
  email: "Email *",
  first_name: "First name",
  last_name: "Last name",
  phone: "Phone",
  tags: "Tags",
};

export default function LeadsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "all" | "cold">("all");

  // add-lead form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", first_name: "", last_name: "", phone: "", tags: "" });
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  // csv import
  const [csvRows, setCsvRows] = useState<string[][] | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [colMap, setColMap] = useState<Record<FieldKey, number>>({ email: -1, first_name: -1, last_name: -1, phone: -1, tags: -1 });
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // fb card
  const [fbConfig, setFbConfig] = useState<{ webhook_url: string; verify_token: string | null; configured: boolean } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLeads(await fetchLeads(supabase));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token || ""}`, "Content-Type": "application/json" };
  }, [supabase]);

  const loadFbConfig = useCallback(async () => {
    const res = await fetch("/api/marketing/fb-config", { headers: await authHeader() });
    if (res.ok) setFbConfig(await res.json());
  }, [authHeader]);

  useEffect(() => {
    loadFbConfig();
  }, [loadFbConfig]);

  /* ── stats ──────────────────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const byStage: Record<string, number> = {};
    let cold = 0;
    for (const l of leads) {
      byStage[l.stage] = (byStage[l.stage] || 0) + 1;
      if (l.is_cold) cold++;
    }
    return { total: leads.length, byStage, cold };
  }, [leads]);

  /* ── filtered rows ──────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (stageFilter === "cold" && !l.is_cold) return false;
      if (stageFilter !== "all" && stageFilter !== "cold" && l.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        l.email.toLowerCase().includes(q) ||
        (l.first_name || "").toLowerCase().includes(q) ||
        (l.last_name || "").toLowerCase().includes(q) ||
        l.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [leads, search, stageFilter]);

  /* ── add lead ───────────────────────────────────────────────────────────── */
  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg(null);
    if (!EMAIL_RE.test(addForm.email.trim())) {
      setAddMsg("Enter a valid email");
      return;
    }
    setAddBusy(true);
    try {
      const res = await addLead(supabase, {
        email: addForm.email.trim(),
        first_name: addForm.first_name.trim() || undefined,
        last_name: addForm.last_name.trim() || undefined,
        phone: addForm.phone.trim() || undefined,
        tags: addForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        source: "manual",
      });
      setAddMsg(res.created ? "Lead added" : "Lead already existed — details updated");
      setAddForm({ email: "", first_name: "", last_name: "", phone: "", tags: "" });
      await load();
    } catch (err) {
      setAddMsg(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAddBusy(false);
    }
  }

  /* ── csv ────────────────────────────────────────────────────────────────── */
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportSummary(null);
    const text = await file.text();
    const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
    if (rows.length === 0) {
      setImportSummary("CSV appears empty");
      return;
    }
    const headers = rows[0];
    setCsvRows(rows);
    setCsvHeaders(headers);
    setHasHeader(true);
    const g = guessColumnMap(headers);
    setColMap({
      email: g.email,
      first_name: g.first_name,
      last_name: g.last_name,
      phone: g.phone,
      tags: g.tags,
    });
  }

  const previewRows = useMemo(() => {
    if (!csvRows) return [];
    return hasHeader ? csvRows.slice(1) : csvRows;
  }, [csvRows, hasHeader]);

  function buildImportRows(): ImportRow[] {
    const out: ImportRow[] = [];
    for (const r of previewRows) {
      const email = colMap.email >= 0 ? (r[colMap.email] || "").trim() : "";
      if (!EMAIL_RE.test(email)) continue;
      const tagsRaw = colMap.tags >= 0 ? (r[colMap.tags] || "") : "";
      out.push({
        email,
        first_name: colMap.first_name >= 0 ? (r[colMap.first_name] || "").trim() : undefined,
        last_name: colMap.last_name >= 0 ? (r[colMap.last_name] || "").trim() : undefined,
        phone: colMap.phone >= 0 ? (r[colMap.phone] || "").trim() : undefined,
        tags: tagsRaw ? tagsRaw.split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : undefined,
      });
    }
    return out;
  }

  const validCount = useMemo(() => buildImportRows().length, [previewRows, colMap]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runImport() {
    const rows = buildImportRows();
    if (rows.length === 0) {
      setImportSummary("No valid rows (need a mapped email column with valid emails)");
      return;
    }
    setImportBusy(true);
    setImportSummary(null);
    try {
      const res = await importLeads(supabase, rows, "csv");
      setImportSummary(`Imported ${res.imported} new · updated ${res.updated} existing · skipped ${res.skipped}`);
      setCsvRows(null);
      setCsvHeaders([]);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      setImportSummary(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] text-ink">Marketing · Leads</h1>
          <p className="text-soft text-sm mt-1">Import contacts, add leads, connect ad sources</p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="f0-press f0-focus inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-accent text-[color:var(--accent-on)] font-semibold hover:bg-accent-strong transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Add lead
        </button>
      </div>


      {/* stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <MiniStat label="Total leads" value={stats.total} />
        {PIPELINE_STAGES.map((s) => (
          <MiniStat key={s} label={s} value={stats.byStage[s] || 0} accent={s === "converted" ? "text-accent" : "text-ink"} />
        ))}
      </div>

      {/* add-lead form */}
      {showAdd && (
        <form onSubmit={submitAdd} className="club-b-card p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="email@example.com" className="bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink placeholder:text-soft/70" />
            <input value={addForm.first_name} onChange={(e) => setAddForm({ ...addForm, first_name: e.target.value })} placeholder="First name" className="bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink placeholder:text-soft/70" />
            <input value={addForm.last_name} onChange={(e) => setAddForm({ ...addForm, last_name: e.target.value })} placeholder="Last name" className="bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink placeholder:text-soft/70" />
            <input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} placeholder="Phone (+1…)" className="bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink placeholder:text-soft/70" />
            <input value={addForm.tags} onChange={(e) => setAddForm({ ...addForm, tags: e.target.value })} placeholder="tags, comma, sep" className="bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink placeholder:text-soft/70" />
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button disabled={addBusy} className="f0-press f0-focus text-sm px-3 py-2 rounded-lg bg-accent text-[color:var(--accent-on)] font-semibold hover:bg-accent-strong disabled:opacity-50 transition-colors">
              {addBusy ? "Adding…" : "Save lead"}
            </button>
            {addMsg && <span className="text-xs text-soft">{addMsg}</span>}
          </div>
        </form>
      )}

      {/* CSV import + FB connect */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* CSV */}
        <div className="club-b-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Upload className="w-4 h-4 text-accent" />
            <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">Import CSV</span>
          </div>
          {!csvRows ? (
            <div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="block w-full text-sm text-soft file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-paper file:text-ink file:text-sm hover:file:bg-paper file:cursor-pointer" />
              <p className="text-xs text-soft/70 mt-2">Any CSV. You&apos;ll map columns next. Email required; dedupe by email + source.</p>
              {importSummary && <p className="text-xs text-soft mt-2">{importSummary}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs text-soft">
                <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
                First row is a header
              </label>
              <div className="space-y-2">
                {(Object.keys(FIELD_LABELS) as FieldKey[]).map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <span className="text-xs text-soft w-20 shrink-0">{FIELD_LABELS[f]}</span>
                    <select
                      value={colMap[f]}
                      onChange={(e) => setColMap({ ...colMap, [f]: Number(e.target.value) })}
                      className="flex-1 bg-paper border border-sand rounded-lg px-2 py-1.5 text-xs text-ink"
                    >
                      <option value={-1}>— none —</option>
                      {csvHeaders.map((h, i) => (
                        <option key={i} value={i}>
                          {hasHeader ? h || `Column ${i + 1}` : `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-soft">{validCount} valid rows (of {previewRows.length})</p>
              <div className="flex items-center gap-2">
                <button onClick={runImport} disabled={importBusy || validCount === 0} className="f0-press f0-focus text-sm px-3 py-1.5 rounded-lg bg-accent text-[color:var(--accent-on)] font-semibold hover:bg-accent-strong disabled:opacity-50 transition-colors">
                  {importBusy ? "Importing…" : `Import ${validCount}`}
                </button>
                <button onClick={() => { setCsvRows(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-sm px-3 py-1.5 rounded-lg text-soft hover:text-ink">
                  Cancel
                </button>
              </div>
              {importSummary && <p className="text-xs text-soft">{importSummary}</p>}
            </div>
          )}
        </div>

        {/* FB connect */}
        <div className="club-b-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Facebook className="w-4 h-4 text-soft" />
            <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">Connect Facebook Lead Ads</span>
            <span className={`ml-auto f0-chip px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${fbConfig?.configured ? "f0-chip-accent text-accent" : "text-soft"}`}>
              {fbConfig?.configured ? "Webhook ready" : "Owner setup needed"}
            </span>
          </div>
          <p className="text-xs text-soft mb-3">
            The receiving webhook is live. To turn on the feed, the owner completes the Meta side (needs a Meta developer app + Page access token — that part is owner-blocked).
          </p>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-soft">Callback URL</span>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 bg-paper border border-sand rounded px-2 py-1.5 text-ink truncate">{fbConfig?.webhook_url || "…"}</code>
                <button onClick={() => copyText(fbConfig?.webhook_url || "", "url")} className="p-1.5 rounded border border-sand bg-card hover:bg-paper text-ink">
                  {copied === "url" ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <span className="text-soft">Verify token</span>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 bg-paper border border-sand rounded px-2 py-1.5 text-ink truncate">{fbConfig?.verify_token || "…"}</code>
                <button onClick={() => copyText(fbConfig?.verify_token || "", "tok")} className="p-1.5 rounded border border-sand bg-card hover:bg-paper text-ink">
                  {copied === "tok" ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <ol className="text-[11px] text-soft mt-3 space-y-1 list-decimal list-inside">
            <li>Create a Meta developer app (developers.facebook.com) → add the Webhooks + Lead Ads products.</li>
            <li>Under Webhooks → object &quot;Page&quot;, paste the Callback URL + Verify token above, subscribe to the <code className="text-soft">leadgen</code> field.</li>
            <li>Generate a Page access token for the FIC page and subscribe the page to the app.</li>
            <li>New Lead Ad submissions then land here automatically as source &quot;facebook&quot;.</li>
          </ol>
        </div>
      </div>

      {/* filters */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-soft absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, tag…" className="w-full bg-paper border border-sand rounded-lg pl-9 pr-3 py-2 text-sm text-ink placeholder:text-soft/70" />
        </div>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as Stage | "all" | "cold")} className="bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink">
          <option value="all">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          <option value="cold">❄ Cold only</option>
        </select>
        <button onClick={load} className="p-2 rounded-lg border border-sand bg-card hover:bg-paper text-ink" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-accent">{error}</div>
      ) : (
        <div className="club-b-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-sand bg-paper font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                <th className="text-left font-medium px-4 py-3">Lead</th>
                <th className="text-left font-medium px-4 py-3">Source</th>
                <th className="text-left font-medium px-4 py-3">Stage</th>
                <th className="text-left font-medium px-4 py-3">Tags</th>
                <th className="text-left font-medium px-4 py-3">Activity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-soft/70 text-sm">No leads match.</td></tr>
              ) : (
                filtered.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => router.push(`/admin/crm/members/lead-${l.id}`)}
                    className="border-t border-sand hover:bg-paper cursor-pointer"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-ink">{leadName(l)}</div>
                      <div className="text-xs text-soft">{l.email}</div>
                    </td>
                    <td className="px-4 py-2.5"><SourceBadge source={l.source} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <StageBadge stage={l.stage} />
                        {l.is_cold && <ColdBadge />}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {l.tags.slice(0, 4).map((t) => <TagPill key={t} tag={t} />)}
                        {l.tags.length > 4 && <span className="text-[10px] text-soft/70">+{l.tags.length - 4}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-soft">{relativeTime(l.last_activity_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
