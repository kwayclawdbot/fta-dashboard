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
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.01em] text-ink">Marketing · Campaigns</h1>
          <p className="text-soft text-sm mt-1">Email &amp; SMS blasts to segmented lead lists</p>
        </div>
        <button onClick={() => setShow((v) => !v)} className="f0-press f0-focus inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-accent text-[color:var(--accent-on)] font-semibold hover:bg-accent-strong transition-colors">
          <Plus className="w-4 h-4" /> New campaign
        </button>
      </div>


      {domainBanner && (
        <div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div className="text-sm text-accent">
            <p className="font-semibold">Email sending blocked: verify familyinvestingclub.com in Resend</p>
            <p className="text-accent/80 text-xs mt-1">Owner action: add the Resend DNS records (SPF/DKIM) at GoDaddy for familyinvestingclub.com, then confirm the domain in the Resend dashboard. Until then email campaigns record as failed; SMS and the rest of the pipeline are unaffected.</p>
          </div>
        </div>
      )}

      {/* builder */}
      {show && (
        <div className="club-b-card p-5 mb-6 space-y-4">
          <div className="flex items-center gap-2">
            <button type="button" aria-pressed={channel === "email"} onClick={() => setChannel("email")} className={`f0-chip f0-press f0-focus inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${channel === "email" ? "f0-chip-on" : "text-soft hover:text-ink"}`}>
              <Mail className="w-4 h-4" /> Email
            </button>
            <button type="button" aria-pressed={channel === "sms"} onClick={() => setChannel("sms")} className={`f0-chip f0-press f0-focus inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] ${channel === "sms" ? "f0-chip-on" : "text-soft hover:text-ink"}`}>
              <MessageSquare className="w-4 h-4" /> SMS
            </button>
          </div>

          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name (internal)" className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink placeholder:text-soft/70" />

          {channel === "email" && (
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink placeholder:text-soft/70" />
          )}

          <div>
            <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={channel === "sms" ? 4 : 8} className="w-full bg-paper border border-sand rounded-lg px-3 py-2 text-sm text-ink placeholder:text-soft/70 font-mono" placeholder="Message body… use {{first_name}} to personalize" />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-soft/70">{"Merge: {{first_name}} {{last_name}}"}{channel === "sms" && " · \"Reply STOP to opt out\" auto-appended"}</span>
              <button onClick={() => setPreview((v) => !v)} className="inline-flex items-center gap-1 text-[11px] text-soft hover:text-ink">
                <Eye className="w-3.5 h-3.5" /> {preview ? "Hide" : "Preview"}
              </button>
            </div>
          </div>

          {preview && (
            <div className="club-b-card p-3">
              {channel === "email" && <p className="text-xs text-soft mb-1">Subject: <span className="text-ink">{subject || "—"}</span></p>}
              <p className="text-sm text-ink whitespace-pre-wrap">{previewBody}</p>
              {channel === "sms" && <p className="text-sm text-soft mt-2">Reply STOP to opt out.</p>}
              {channel === "email" && <p className="text-[11px] text-soft/70 mt-3 pt-2 border-t border-sand">Footer: Cheat Code Club · Unsubscribe link (per-recipient signed token)</p>}
            </div>
          )}

          {/* segment */}
          <div className="rounded-lg border border-sand p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-soft" />
              <span className="text-sm text-ink">Audience</span>
              <span className="ml-auto text-sm font-semibold text-accent">{recipientCount ?? "…"} recipients</span>
            </div>
            <p className="text-[11px] text-soft/70 mb-1.5">Stages (none = all except unsubscribed)</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {PIPELINE_STAGES.map((s) => (
                <button key={s} type="button" aria-pressed={segStages.includes(s)} onClick={() => toggleStage(s)} className={`f0-chip f0-press f0-focus px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${segStages.includes(s) ? "f0-chip-on" : "text-soft hover:text-ink"}`}>
                  {STAGE_META[s].label}
                </button>
              ))}
            </div>
            {allTags.length > 0 && (
              <>
                <p className="text-[11px] text-soft/70 mb-1.5">Tags (any match)</p>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((t) => (
                    <button key={t} type="button" aria-pressed={segTags.includes(t)} onClick={() => toggleTag(t)} className={`f0-chip f0-press f0-focus px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${segTags.includes(t) ? "f0-chip-on" : "text-soft hover:text-ink"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => saveAndSend(true)} disabled={busy} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-sand bg-card text-ink font-medium hover:bg-paper disabled:opacity-50">
              <Eye className="w-4 h-4" /> Save &amp; dry-run
            </button>
            <button onClick={() => saveAndSend(false)} disabled={busy} className="f0-press f0-focus inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-accent text-[color:var(--accent-on)] font-semibold hover:bg-accent-strong disabled:opacity-50">
              <Send className="w-4 h-4" /> {busy ? "Sending…" : channel === "email" ? "Save & send email" : "Save & send (SMS→dry-run)"}
            </button>
            {sendMsg && <span className="text-xs text-soft">{sendMsg}</span>}
          </div>
          {channel === "sms" && (
            <p className="text-[11px] text-soft">SMS batch sends are forced to dry-run from the UI — this Twilio number is shared with the Kai product. Live SMS requires an explicit server-side override.</p>
          )}
        </div>
      )}

      {sendMsg && !show && <div className="mb-4 rounded-lg border border-sand bg-paper px-4 py-2 text-sm text-ink">{sendMsg}</div>}

      {/* list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-accent">{error}</div>
      ) : campaigns.length === 0 ? (
        <div className="club-b-card p-10 text-center text-soft text-sm">No campaigns yet. Create one above.</div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <div key={c.id} className="club-b-card p-4 flex items-center gap-4 flex-wrap">
              <div className="w-9 h-9 rounded-lg border border-sand bg-paper flex items-center justify-center shrink-0 text-soft">
                {c.channel === "email" ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink truncate">{c.name}</div>
                <div className="text-xs text-soft truncate">{c.channel === "email" ? c.subject || "(no subject)" : c.body.slice(0, 60)}</div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-soft">{c.sends_sent} sent</span>
                <span className="text-accent">{c.sends_failed} failed</span>
                <span className="text-soft">{c.sends_skipped} skipped</span>
              </div>
              <span className={`f0-chip text-[10px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 ${c.status === "sent" ? "f0-chip-on" : c.status === "failed" ? "f0-chip-accent text-accent" : "text-soft"}`}>{c.status}</span>
              <span className="text-[11px] text-soft/70 w-16 text-right">{relativeTime(c.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
