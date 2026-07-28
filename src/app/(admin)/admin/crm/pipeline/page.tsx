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
  imported: { icon: Sparkles, color: "text-soft" },
  emailed: { icon: Mail, color: "text-soft" },
  smsed: { icon: MessageSquare, color: "text-soft" },
  opened: { icon: Mail, color: "text-soft" },
  clicked: { icon: Mail, color: "text-soft" },
  replied: { icon: MessageSquare, color: "text-accent" },
  stage_changed: { icon: ArrowRightLeft, color: "text-accent" },
  converted: { icon: CheckCircle2, color: "text-soft" },
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
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] text-ink">Marketing · Pipeline</h1>
          <p className="text-soft text-sm mt-1">Drag leads across stages · click a card for the full timeline</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setColdOnly((v) => !v)}
            aria-pressed={coldOnly}
            className={`f0-chip f0-press f0-focus inline-flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] ${coldOnly ? "f0-chip-on" : "text-soft hover:text-ink"}`}
          >
            <Snowflake className="w-4 h-4" /> Cold only
          </button>
          <button
            onClick={runSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-sand bg-card text-soft font-medium hover:bg-paper disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Sync conversions
          </button>
        </div>
      </div>


      {syncMsg && <div className="mb-4 rounded-lg border border-sand bg-paper px-4 py-2 text-sm text-soft">{syncMsg}</div>}
      {error && <div className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
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
                className={`w-72 shrink-0 rounded-xl border bg-card flex flex-col ${dragOver === stage ? "border-accent/60 bg-accent/5" : "border-sand"}`}
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-sand">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent" aria-hidden />
                    <span className="text-sm font-semibold text-ink">{meta.label}</span>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-soft">{items.length}</span>
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
                        className={`rounded-lg border border-sand bg-card p-2.5 cursor-pointer hover:border-accent/50 transition-colors ${dragId === l.id ? "opacity-40" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-ink truncate">{leadName(l)}</div>
                            <div className="text-[11px] text-soft truncate">{l.email}</div>
                          </div>
                          {l.is_cold && <ColdBadge />}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <SourceBadge source={l.source} />
                          <span className="inline-flex items-center gap-1 text-[10px] text-soft/70">
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
                  {items.length === 0 && <div className="text-center text-[11px] text-soft/70 py-6">Drop here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* drawer */}
      {openId && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={closeDrawer}>
          <div className="absolute inset-0 bg-scrim" />
          <div className="relative w-full max-w-md h-full bg-card border-l border-sand overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {detailLoading || !detail?.lead ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-display text-[17px] font-extrabold text-ink">{leadName(detail.lead)}</h2>
                    <p className="text-sm text-soft">{detail.lead.email}</p>
                    {detail.lead.phone && <p className="text-xs text-soft/70">{detail.lead.phone}</p>}
                  </div>
                  <button onClick={closeDrawer} className="p-1.5 rounded-lg text-soft hover:text-ink hover:bg-paper">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <StageBadge stage={detail.lead.stage} />
                  <SourceBadge source={detail.lead.source} />
                  {detail.lead.converted_profile_id && (
                    <span className="f0-chip px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-soft">Account linked</span>
                  )}
                </div>

                {/* stage select + convert */}
                <div className="club-b-card p-3 mb-4">
                  <label className="text-xs text-soft block mb-1.5">Move to stage</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={detail.lead.stage}
                      onChange={(e) => moveLead(detail.lead!.id, e.target.value as Stage)}
                      className="flex-1 bg-paper border border-sand rounded-lg px-2 py-1.5 text-sm text-ink"
                    >
                      {PIPELINE_STAGES.concat(["unsubscribed"]).map((s) => (
                        <option key={s} value={s}>{STAGE_META[s].label}</option>
                      ))}
                    </select>
                    {detail.lead.stage !== "converted" && (
                      <button onClick={() => moveLead(detail.lead!.id, "converted")} className="inline-flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg border border-sand bg-card text-soft font-medium hover:bg-paper whitespace-nowrap">
                        <CheckCircle2 className="w-4 h-4" /> Convert
                      </button>
                    )}
                  </div>
                </div>

                {/* notes */}
                <div className="mb-4">
                  <label className="text-xs text-soft block mb-1.5">Notes</label>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={3}
                    className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink placeholder:text-soft/70"
                    placeholder="Private notes about this lead…"
                  />
                  <button onClick={saveNote} disabled={savingNote} className="mt-2 text-xs px-2.5 py-1.5 rounded-lg border border-sand bg-card text-ink hover:bg-paper disabled:opacity-50">
                    {savingNote ? "Saving…" : "Save notes"}
                  </button>
                </div>

                {detail.lead.tags.length > 0 && (
                  <div className="mb-4">
                    <label className="text-xs text-soft block mb-1.5">Tags</label>
                    <div className="flex flex-wrap gap-1">{detail.lead.tags.map((t) => <TagPill key={t} tag={t} />)}</div>
                  </div>
                )}

                {/* timeline */}
                <div>
                  <label className="text-xs text-soft block mb-2">Timeline</label>
                  <div className="space-y-2">
                    {detail.events.length === 0 ? (
                      <p className="text-xs text-soft/70">No events yet.</p>
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
                            <div className="w-7 h-7 rounded-lg border border-sand bg-paper flex items-center justify-center shrink-0">
                              <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-ink capitalize">{ev.type.replace("_", " ")}</p>
                              {metaStr && <p className="text-[11px] text-soft">{metaStr}</p>}
                            </div>
                            <span className="text-[10px] text-soft/70 shrink-0">{relativeTime(ev.created_at)}</span>
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
