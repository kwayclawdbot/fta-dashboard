"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  RefreshCw,
  Snowflake,
  X,
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
  ArrowRightLeft,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchLeads,
  fetchLeadDetail,
  setStage,
  updateLead,
  syncConversions,
  leadName,
  relativeTime,
  daysSince,
  PIPELINE_STAGES,
  STAGE_META,
  type Lead,
  type Stage,
  type LeadDetail,
  type EventType,
} from "@/lib/marketing";
import {
  StageBadge,
  SourceBadge,
  ColdBadge,
  TagPill,
} from "@/components/admin/crm/marketing-ui";

const EVENT_ICON: Record<EventType, { icon: typeof Mail; color: string }> = {
  imported: { icon: Sparkles, color: "text-zinc-400" },
  emailed: { icon: Mail, color: "text-blue-400" },
  smsed: { icon: MessageSquare, color: "text-emerald-400" },
  opened: { icon: Mail, color: "text-sky-400" },
  clicked: { icon: Mail, color: "text-violet-400" },
  replied: { icon: MessageSquare, color: "text-amber-400" },
  stage_changed: { icon: ArrowRightLeft, color: "text-amber-400" },
  converted: { icon: CheckCircle2, color: "text-emerald-400" },
};

export default function PipelinePage() {
  const supabase = useMemo(() => createClient(), []);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coldOnly, setColdOnly] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Stage | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // drawer
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    try {
      setLeads(await fetchLeads(supabase));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const openDrawer = useCallback(
    async (id: string) => {
      setOpenId(id);
      setDetailLoading(true);
      setDetail(null);
      try {
        const d = await fetchLeadDetail(supabase, id);
        setDetail(d);
        setNoteDraft(d?.lead?.notes || "");
      } finally {
        setDetailLoading(false);
      }
    },
    [supabase]
  );

  function closeDrawer() {
    setOpenId(null);
    setDetail(null);
  }

  async function moveLead(id: string, stage: Stage) {
    const prev = leads;
    // optimistic
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage, last_activity_at: new Date().toISOString(), is_cold: false } : l)));
    try {
      await setStage(supabase, id, stage);
      await load();
      if (openId === id) await openDrawer(id);
    } catch (e) {
      setLeads(prev);
      setError(e instanceof Error ? e.message : "Move failed");
    }
  }

  async function runSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await syncConversions(supabase);
      setSyncMsg(res.converted > 0 ? `Converted ${res.converted} lead(s) matched to accounts` : "No new conversions — all leads checked");
      await load();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function saveNote() {
    if (!openId) return;
    setSavingNote(true);
    try {
      await updateLead(supabase, openId, { notes: noteDraft });
      setDetail((d) => (d && d.lead ? { ...d, lead: { ...d.lead, notes: noteDraft } } : d));
    } finally {
      setSavingNote(false);
    }
  }

  const columns = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const s of PIPELINE_STAGES) map[s] = [];
    for (const l of leads) {
      if (coldOnly && !l.is_cold) continue;
      if (map[l.stage]) map[l.stage].push(l);
    }
    return map;
  }, [leads, coldOnly]);

  return (
    <div className="max-w-full mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Marketing · Pipeline</h1>
          <p className="text-zinc-400 text-sm mt-1">Drag leads across stages · click a card for the full timeline</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setColdOnly((v) => !v)}
            className={`inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg font-medium transition-colors ${coldOnly ? "bg-cyan-500/15 text-cyan-300" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          >
            <Snowflake className="w-4 h-4" /> Cold only
          </button>
          <button
            onClick={runSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 font-medium hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Sync conversions
          </button>
        </div>
      </div>


      {syncMsg && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-sm text-emerald-300">{syncMsg}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2 text-sm text-red-400">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const meta = STAGE_META[stage];
            const items = columns[stage] || [];
            return (
              <div
                key={stage}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage); }}
                onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const id = e.dataTransfer.getData("text/lead") || dragId;
                  if (id) moveLead(id, stage);
                  setDragId(null);
                }}
                className={`w-72 shrink-0 rounded-xl border bg-zinc-900/40 flex flex-col ${dragOver === stage ? "border-amber-400/60 bg-amber-400/5" : "border-zinc-800"}`}
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    <span className="text-sm font-semibold text-zinc-200">{meta.label}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{items.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[120px] flex-1">
                  {items.map((l) => {
                    const ds = daysSince(l.last_activity_at);
                    return (
                      <div
                        key={l.id}
                        draggable
                        onDragStart={(e) => { setDragId(l.id); e.dataTransfer.setData("text/lead", l.id); e.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => openDrawer(l.id)}
                        className={`rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5 cursor-pointer hover:border-zinc-700 transition-colors ${dragId === l.id ? "opacity-40" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-200 truncate">{leadName(l)}</div>
                            <div className="text-[11px] text-zinc-500 truncate">{l.email}</div>
                          </div>
                          {l.is_cold && <ColdBadge />}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <SourceBadge source={l.source} />
                          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-600">
                            <Clock className="w-3 h-3" />
                            {ds === null ? "—" : ds === 0 ? "today" : `${ds}d`}
                          </span>
                        </div>
                        {l.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {l.tags.slice(0, 3).map((t) => <TagPill key={t} tag={t} />)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {items.length === 0 && <div className="text-center text-[11px] text-zinc-700 py-6">Drop here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* drawer */}
      {openId && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={closeDrawer}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md h-full bg-[#0d0d12] border-l border-zinc-800 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {detailLoading || !detail?.lead ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-100">{leadName(detail.lead)}</h2>
                    <p className="text-sm text-zinc-500">{detail.lead.email}</p>
                    {detail.lead.phone && <p className="text-xs text-zinc-600">{detail.lead.phone}</p>}
                  </div>
                  <button onClick={closeDrawer} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <StageBadge stage={detail.lead.stage} />
                  <SourceBadge source={detail.lead.source} />
                  {detail.lead.converted_profile_id && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-emerald-300 bg-emerald-500/10">Account linked</span>
                  )}
                </div>

                {/* stage select + convert */}
                <div className="rounded-lg border border-zinc-800 p-3 mb-4">
                  <label className="text-xs text-zinc-500 block mb-1.5">Move to stage</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={detail.lead.stage}
                      onChange={(e) => moveLead(detail.lead!.id, e.target.value as Stage)}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-sm text-zinc-100"
                    >
                      {PIPELINE_STAGES.concat(["unsubscribed"]).map((s) => (
                        <option key={s} value={s}>{STAGE_META[s].label}</option>
                      ))}
                    </select>
                    {detail.lead.stage !== "converted" && (
                      <button onClick={() => moveLead(detail.lead!.id, "converted")} className="inline-flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 font-medium hover:bg-emerald-500/25 whitespace-nowrap">
                        <CheckCircle2 className="w-4 h-4" /> Convert
                      </button>
                    )}
                  </div>
                </div>

                {/* notes */}
                <div className="mb-4">
                  <label className="text-xs text-zinc-500 block mb-1.5">Notes</label>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
                    placeholder="Private notes about this lead…"
                  />
                  <button onClick={saveNote} disabled={savingNote} className="mt-2 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50">
                    {savingNote ? "Saving…" : "Save notes"}
                  </button>
                </div>

                {detail.lead.tags.length > 0 && (
                  <div className="mb-4">
                    <label className="text-xs text-zinc-500 block mb-1.5">Tags</label>
                    <div className="flex flex-wrap gap-1">{detail.lead.tags.map((t) => <TagPill key={t} tag={t} />)}</div>
                  </div>
                )}

                {/* timeline */}
                <div>
                  <label className="text-xs text-zinc-500 block mb-2">Timeline</label>
                  <div className="space-y-2">
                    {detail.events.length === 0 ? (
                      <p className="text-xs text-zinc-600">No events yet.</p>
                    ) : (
                      detail.events.map((ev) => {
                        const conf = EVENT_ICON[ev.type] || EVENT_ICON.imported;
                        const Icon = conf.icon;
                        const metaStr =
                          ev.type === "stage_changed" && ev.meta
                            ? `${(ev.meta as { from?: string }).from ?? ""} → ${(ev.meta as { to?: string }).to ?? ""}`
                            : ev.type === "converted"
                              ? "matched to an account"
                              : (ev.meta as { source?: string })?.source
                                ? `via ${(ev.meta as { source?: string }).source}`
                                : "";
                        return (
                          <div key={ev.id} className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-zinc-800/60 flex items-center justify-center shrink-0">
                              <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-zinc-300 capitalize">{ev.type.replace("_", " ")}</p>
                              {metaStr && <p className="text-[11px] text-zinc-500">{metaStr}</p>}
                            </div>
                            <span className="text-[10px] text-zinc-600 shrink-0">{relativeTime(ev.created_at)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
