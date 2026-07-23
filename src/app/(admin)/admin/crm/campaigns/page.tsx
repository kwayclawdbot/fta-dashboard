"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Mail,
  MessageSquare,
  Send,
  Eye,
  AlertTriangle,
  Plus,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchCampaigns,
  createCampaign,
  segmentLeads,
  fetchLeads,
  relativeTime,
  PIPELINE_STAGES,
  STAGE_META,
  type Campaign,
  type Stage,
} from "@/lib/marketing";

export default function CampaignsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainBanner, setDomainBanner] = useState(false);

  // builder
  const [show, setShow] = useState(false);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("Hi {{first_name}},\n\n");
  const [segStages, setSegStages] = useState<Stage[]>([]);
  const [segTags, setSegTags] = useState<string[]>([]);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cs, leads] = await Promise.all([fetchCampaigns(supabase), fetchLeads(supabase)]);
      setCampaigns(cs);
      const tagSet = new Set<string>();
      leads.forEach((l) => l.tags.forEach((t) => tagSet.add(t)));
      setAllTags([...tagSet].sort());
      // Surface the DNS banner retroactively if any email campaign has failures.
      if (cs.some((c) => c.channel === "email" && c.sends_failed > 0)) setDomainBanner(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const segment = useMemo(() => ({ stages: segStages, tags: segTags }), [segStages, segTags]);

  const refreshCount = useCallback(async () => {
    try {
      const rows = await segmentLeads(supabase, segment);
      setRecipientCount(rows.length);
    } catch {
      setRecipientCount(null);
    }
  }, [supabase, segment]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token || ""}`, "Content-Type": "application/json" };
  }

  function toggleStage(s: Stage) {
    setSegStages((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }
  function toggleTag(t: string) {
    setSegTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  async function saveAndSend(dryRun: boolean) {
    setSendMsg(null);
    if (!name.trim()) { setSendMsg("Name the campaign first"); return; }
    if (!bodyText.trim()) { setSendMsg("Body is empty"); return; }
    if (channel === "email" && !subject.trim()) { setSendMsg("Email needs a subject"); return; }
    setBusy(true);
    try {
      const { id } = await createCampaign(supabase, {
        name: name.trim(),
        channel,
        body: bodyText,
        subject: channel === "email" ? subject : undefined,
        segment,
      });
      const res = await fetch("/api/marketing/campaigns/send", {
        method: "POST",
        headers: await authHeader(),
        body: JSON.stringify({ campaign_id: id, dry_run: dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      if (data.domain_blocked) setDomainBanner(true);
      const parts = [
        data.dry_run ? "Dry-run" : "Live send",
        `${data.recipients} recipients`,
        `${data.sent} sent`,
        `${data.failed} failed`,
        `${data.skipped} skipped`,
      ];
      if (data.forced_dry_run) parts.push("(SMS forced to dry-run — shared Twilio number)");
      setSendMsg(parts.join(" · "));
      // reset builder
      setName("");
      setSubject("");
      setBodyText("Hi {{first_name}},\n\n");
      setSegStages([]);
      setSegTags([]);
      setShow(false);
      await load();
    } catch (e) {
      setSendMsg(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  const previewBody = bodyText.replace(/\{\{\s*first_name\s*\}\}/gi, "Jordan");

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Marketing · Campaigns</h1>
          <p className="text-zinc-400 text-sm mt-1">Email &amp; SMS blasts to segmented lead lists</p>
        </div>
        <button onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-amber-400 text-zinc-950 font-semibold hover:bg-amber-300 transition-colors">
          <Plus className="w-4 h-4" /> New campaign
        </button>
      </div>


      {domainBanner && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            <p className="font-semibold">Email sending blocked: verify familyinvestingclub.com in Resend</p>
            <p className="text-amber-200/80 text-xs mt-1">Owner action: add the Resend DNS records (SPF/DKIM) at GoDaddy for familyinvestingclub.com, then confirm the domain in the Resend dashboard. Until then email campaigns record as failed; SMS and the rest of the pipeline are unaffected.</p>
          </div>
        </div>
      )}

      {/* builder */}
      {show && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 mb-6 space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setChannel("email")} className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg font-medium ${channel === "email" ? "bg-blue-500/15 text-blue-300" : "bg-zinc-800 text-zinc-400"}`}>
              <Mail className="w-4 h-4" /> Email
            </button>
            <button onClick={() => setChannel("sms")} className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg font-medium ${channel === "sms" ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>
              <MessageSquare className="w-4 h-4" /> SMS
            </button>
          </div>

          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name (internal)" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600" />

          {channel === "email" && (
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600" />
          )}

          <div>
            <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={channel === "sms" ? 4 : 8} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 font-mono" placeholder="Message body… use {{first_name}} to personalize" />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-zinc-600">{"Merge: {{first_name}} {{last_name}}"}{channel === "sms" && " · \"Reply STOP to opt out\" auto-appended"}</span>
              <button onClick={() => setPreview((v) => !v)} className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200">
                <Eye className="w-3.5 h-3.5" /> {preview ? "Hide" : "Preview"}
              </button>
            </div>
          </div>

          {preview && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              {channel === "email" && <p className="text-xs text-zinc-500 mb-1">Subject: <span className="text-zinc-300">{subject || "—"}</span></p>}
              <p className="text-sm text-zinc-200 whitespace-pre-wrap">{previewBody}</p>
              {channel === "sms" && <p className="text-sm text-zinc-500 mt-2">Reply STOP to opt out.</p>}
              {channel === "email" && <p className="text-[11px] text-zinc-600 mt-3 pt-2 border-t border-zinc-800">Footer: Family Investing Club · Unsubscribe link (per-recipient signed token)</p>}
            </div>
          )}

          {/* segment */}
          <div className="rounded-lg border border-zinc-800 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-zinc-400" />
              <span className="text-sm text-zinc-300">Audience</span>
              <span className="ml-auto text-sm font-semibold text-amber-400">{recipientCount ?? "…"} recipients</span>
            </div>
            <p className="text-[11px] text-zinc-600 mb-1.5">Stages (none = all except unsubscribed)</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PIPELINE_STAGES.map((s) => (
                <button key={s} onClick={() => toggleStage(s)} className={`text-[11px] px-2 py-1 rounded-md ${segStages.includes(s) ? `${STAGE_META[s].bg} ${STAGE_META[s].text}` : "bg-zinc-800 text-zinc-500"}`}>
                  {STAGE_META[s].label}
                </button>
              ))}
            </div>
            {allTags.length > 0 && (
              <>
                <p className="text-[11px] text-zinc-600 mb-1.5">Tags (any match)</p>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((t) => (
                    <button key={t} onClick={() => toggleTag(t)} className={`text-[11px] px-2 py-1 rounded-md ${segTags.includes(t) ? "bg-amber-400/15 text-amber-300" : "bg-zinc-800 text-zinc-500"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => saveAndSend(true)} disabled={busy} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 font-medium hover:bg-zinc-700 disabled:opacity-50">
              <Eye className="w-4 h-4" /> Save &amp; dry-run
            </button>
            <button onClick={() => saveAndSend(false)} disabled={busy} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-amber-400 text-zinc-950 font-semibold hover:bg-amber-300 disabled:opacity-50">
              <Send className="w-4 h-4" /> {busy ? "Sending…" : channel === "email" ? "Save & send email" : "Save & send (SMS→dry-run)"}
            </button>
            {sendMsg && <span className="text-xs text-zinc-400">{sendMsg}</span>}
          </div>
          {channel === "sms" && (
            <p className="text-[11px] text-cyan-400/80">SMS batch sends are forced to dry-run from the UI — this Twilio number is shared with the Kai product. Live SMS requires an explicit server-side override.</p>
          )}
        </div>
      )}

      {sendMsg && !show && <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-2 text-sm text-zinc-300">{sendMsg}</div>}

      {/* list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-zinc-500 text-sm">No campaigns yet. Create one above.</div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex items-center gap-4 flex-wrap">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.channel === "email" ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                {c.channel === "email" ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-200 truncate">{c.name}</div>
                <div className="text-xs text-zinc-500 truncate">{c.channel === "email" ? c.subject || "(no subject)" : c.body.slice(0, 60)}</div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-400">{c.sends_sent} sent</span>
                <span className="text-red-400">{c.sends_failed} failed</span>
                <span className="text-zinc-500">{c.sends_skipped} skipped</span>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${c.status === "sent" ? "text-emerald-300 bg-emerald-500/10" : c.status === "failed" ? "text-red-300 bg-red-500/10" : "text-zinc-400 bg-zinc-800"}`}>{c.status}</span>
              <span className="text-[11px] text-zinc-600 w-16 text-right">{relativeTime(c.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
