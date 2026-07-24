"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Home,
  Mail,
  Phone,
  Calendar,
  StickyNote,
  Trash2,
  Send,
  Activity as ActivityIcn,
  LifeBuoy,
  MessageSquare,
  Tag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TIER_CONFIG, type FamilyTier } from "@/lib/tier";
import { levelForXp, levelProgress } from "@/lib/xp";
import {
  fetchMembers,
  fetchNotes,
  addNote,
  deleteNote,
  relativeTime,
  shortDate,
  type MemberRow,
  type TimelineEvent,
  type AdminNote,
} from "@/lib/crm";
import {
  fetchContactSupport,
  fetchContactTimeline,
  type SupportTicketSummary,
} from "@/lib/contacts";
import {
  fetchLeadDetail,
  leadName,
  type LeadDetail,
} from "@/lib/marketing";
import {
  AdminAvatar,
  TierChip,
  RoleChip,
  ContactKindChip,
  ActivityIcon,
  LastSeenDot,
} from "@/components/admin/crm/ui";
import { StageBadge, TagPill } from "@/components/admin/crm/marketing-ui";
import {
  ContactCommsModal,
  type CommsTarget,
} from "@/components/admin/crm/ContactCommsModal";
import type { Stage } from "@/lib/marketing";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-400/15 text-amber-300",
  pending: "bg-blue-400/15 text-blue-300",
  resolved: "bg-emerald-400/15 text-emerald-300",
  closed: "bg-zinc-700/40 text-zinc-400",
};

export default function ContactDetailPage() {
  const params = useParams<{ userId: string }>();
  const raw = params.userId;
  const isLead = raw.startsWith("lead-");
  const leadId = isLead ? raw.slice(5) : null;
  const userId = isLead ? null : raw;
  const supabase = useMemo(() => createClient(), []);

  const [member, setMember] = useState<MemberRow | null>(null);
  const [lead, setLead] = useState<LeadDetail["lead"] | null>(null);
  const [familyProfile, setFamilyProfile] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [support, setSupport] = useState<SupportTicketSummary[]>([]);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    channel: "email" | "sms";
    target: CommsTarget;
  } | null>(null);

  const email = isLead ? lead?.email ?? null : member?.email ?? null;

  const loadTimelineAndSupport = useCallback(
    async (em: string | null) => {
      const [tl, sp] = await Promise.all([
        fetchContactTimeline(supabase, { userId, email: em, limit: 80 }),
        fetchContactSupport(supabase, { userId, email: em }),
      ]);
      setTimeline(tl);
      setSupport(sp);
    },
    [supabase, userId]
  );

  const load = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      setAdminId(auth.user?.id ?? null);

      if (isLead && leadId) {
        const detail = await fetchLeadDetail(supabase, leadId);
        const l = detail?.lead ?? null;
        setLead(l);
        await loadTimelineAndSupport(l?.email ?? null);
      } else if (userId) {
        const members = await fetchMembers(supabase);
        const m = members.find((x) => x.id === userId) ?? null;
        setMember(m);
        await loadTimelineAndSupport(m?.email ?? null);
        // Feature-detect the onboarding lane's family-profile RPC (ships in
        // parallel — absent today, so failures are swallowed gracefully).
        if (m?.family_id) {
          try {
            const { data, error: fpErr } = await supabase.rpc(
              "admin_family_profile",
              { p_family_id: m.family_id }
            );
            if (!fpErr && data && typeof data === "object")
              setFamilyProfile(data as Record<string, unknown>);
          } catch {
            /* RPC not deployed yet — ignore */
          }
        }
        try {
          setNotes(await fetchNotes(supabase, userId));
        } catch {
          /* notes non-critical */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contact");
    } finally {
      setLoading(false);
    }
  }, [supabase, isLead, leadId, userId, loadTimelineAndSupport]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitNote() {
    if (!newNote.trim() || !adminId || !userId) return;
    setSavingNote(true);
    try {
      await addNote(supabase, userId, adminId, newNote.trim());
      setNewNote("");
      setNotes(await fetchNotes(supabase, userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  }

  async function removeNote(id: string) {
    await deleteNote(supabase, id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  function openModal(channel: "email" | "sms") {
    const target: CommsTarget = isLead
      ? {
          record: "lead",
          contact_id: leadId!,
          name: lead ? leadName(lead) : null,
          email: lead?.email ?? null,
          phone: lead?.phone ?? null,
          first_name: lead?.first_name ?? null,
          stage: lead?.stage ?? null,
        }
      : {
          record: "member",
          contact_id: userId!,
          name: member?.display_name ?? null,
          email: member?.email ?? null,
          phone: null,
          first_name:
            (member?.display_name || "").trim().split(/\s+/)[0] || null,
        };
    setModal({ channel, target });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || (!member && !lead)) {
    return (
      <div className="max-w-3xl mx-auto">
        <BackLink />
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400 mt-4">
          {error || "Contact not found"}
        </div>
      </div>
    );
  }

  const displayName = isLead
    ? lead
      ? leadName(lead)
      : "Lead"
    : member?.display_name || "—";
  const canEmail = !!email;
  const canSms = isLead ? !!lead?.phone : false;

  return (
    <div className="max-w-6xl mx-auto">
      <BackLink />

      {/* Profile header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mt-4">
        <div className="flex items-start gap-5 flex-wrap">
          <AdminAvatar
            name={displayName}
            avatarUrl={member?.avatar_url}
            tier={isLead ? "free" : member?.tier}
            size="xl"
          />
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-zinc-100">{displayName}</h1>
              {isLead ? (
                <>
                  <ContactKindChip kind="lead" />
                  {lead?.stage ? <StageBadge stage={lead.stage as Stage} /> : null}
                </>
              ) : (
                <>
                  {member && <RoleChip role={member.role} />}
                  {member && <TierChip tier={member.tier} />}
                  {member?.onboarding_complete ? (
                    <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                      Onboarded
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                      Onboarding
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-4 mt-2 text-sm text-zinc-400 flex-wrap">
              {email ? (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {email}
                </span>
              ) : null}
              {isLead && lead?.phone ? (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {lead.phone}
                </span>
              ) : null}
              {!isLead && member?.family_id ? (
                <Link
                  href={`/admin/crm/families/${member.family_id}`}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300"
                >
                  <Home className="w-3.5 h-3.5" />{" "}
                  {member.family_name || "Family"}
                </Link>
              ) : null}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {isLead ? "Added " : "Joined "}
                {shortDate(isLead ? lead?.created_at : member?.joined_at)}
              </span>
              {!isLead && member ? (
                <span className="flex items-center gap-1.5">
                  <LastSeenDot iso={member.last_seen} /> Last seen{" "}
                  {relativeTime(member.last_seen)}
                </span>
              ) : null}
              {/* FTA Club clock (migration 127) — the Challenge year-1 Club
                  window. Lapsed = academy for life, Club gated to free. */}
              {!isLead && member?.club_until ? (
                <span
                  className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded font-semibold ${
                    member.club_lapsed
                      ? "bg-red-400/10 text-red-400"
                      : "bg-emerald-400/10 text-emerald-400"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {member.club_lapsed ? "Club lapsed " : "Club until "}
                  {shortDate(member.club_until)}
                </span>
              ) : null}
            </div>

            {/* Member level / XP bar */}
            {!isLead && member ? <XpBar member={member} /> : null}

            {/* Comms buttons */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => openModal("email")}
                disabled={!canEmail}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-amber-400 text-zinc-950 font-semibold hover:bg-amber-300 disabled:opacity-40 transition-colors"
              >
                <Mail className="w-4 h-4" /> Email
              </button>
              <button
                onClick={() => openModal("sms")}
                disabled={!canSms}
                title={
                  canSms
                    ? "Send SMS"
                    : isLead
                      ? "No phone on file"
                      : "SMS available for lead contacts with a phone"
                }
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-zinc-700 text-zinc-200 hover:border-amber-400/50 hover:text-amber-400 disabled:opacity-40 transition-colors"
              >
                <MessageSquare className="w-4 h-4" /> SMS
              </button>
            </div>

            {/* Admin controls — role + membership tier (ported from the retired
                /admin/users directory; the family-tier flip goes through the
                admin_set_family_tier RPC, the single source access gates read). */}
            {!isLead && member ? <MemberAdminControls member={member} /> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        {/* Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ActivityIcn className="w-4 h-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-300">
                Activity timeline
              </span>
              <span className="text-xs text-zinc-500">
                · {timeline.length} events
              </span>
            </div>
            {timeline.length === 0 ? (
              <p className="text-sm text-zinc-600 py-8 text-center">
                No activity recorded yet
              </p>
            ) : (
              <div className="space-y-1">
                {timeline.map((e, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-2 border-b border-zinc-800/40 last:border-0"
                  >
                    <ActivityIcon type={e.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-200 break-words">
                        {e.title}
                      </p>
                      {e.meta ? (
                        <p className="text-[11px] text-zinc-600 truncate">
                          {e.meta}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className="text-[11px] text-zinc-600 shrink-0 whitespace-nowrap"
                      title={new Date(e.ts).toLocaleString()}
                    >
                      {relativeTime(e.ts)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Support history */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <LifeBuoy className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-zinc-300">
                Support history
              </span>
              <span className="text-xs text-zinc-500">
                · {support.length} ticket{support.length !== 1 ? "s" : ""}
              </span>
            </div>
            {support.length === 0 ? (
              <p className="text-sm text-zinc-600 py-6 text-center">
                No support tickets
                {isLead ? " (no matching member account)" : ""}
              </p>
            ) : (
              <div className="space-y-2">
                {support.map((t) => (
                  <Link
                    key={t.id}
                    href="/admin/crm/support"
                    className="block rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5 hover:border-amber-400/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-zinc-100">
                        {t.subject}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          STATUS_STYLES[t.status] || STATUS_STYLES.closed
                        }`}
                      >
                        {t.status}
                      </span>
                      <span className="text-[11px] text-zinc-600 ml-auto">
                        {relativeTime(t.last_message_at)}
                      </span>
                    </div>
                    {t.last_message ? (
                      <p className="text-xs text-zinc-500 mt-1 truncate">
                        <span className="text-zinc-600">
                          {t.last_sender === "team"
                            ? "Team: "
                            : t.last_sender === "ai"
                              ? "Bot: "
                              : ""}
                        </span>
                        {t.last_message}
                      </p>
                    ) : null}
                    <p className="text-[11px] text-zinc-600 mt-1">
                      {t.message_count} message
                      {t.message_count !== 1 ? "s" : ""} · {t.category}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Member stats */}
          {!isLead && member ? <MemberStats member={member} /> : null}

          {/* Lead details */}
          {isLead && lead ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <span className="text-sm font-medium text-zinc-300">
                Lead details
              </span>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Source" value={lead.source} />
                <Row label="Stage" value={lead.stage} />
                {lead.consent_source ? (
                  <Row label="Consent" value={lead.consent_source} />
                ) : null}
              </dl>
              {lead.tags?.length ? (
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1.5">
                    <Tag className="w-3.5 h-3.5" /> Tags
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {lead.tags.map((t) => (
                      <TagPill key={t} tag={t} />
                    ))}
                  </div>
                </div>
              ) : null}
              {lead.custom && Object.keys(lead.custom).length ? (
                <div className="mt-3">
                  <p className="text-xs text-zinc-500 mb-1.5">Quiz / details</p>
                  <dl className="space-y-1.5 text-sm">
                    {Object.entries(lead.custom).map(([k, v]) => (
                      <Row key={k} label={humanize(k)} value={stringify(v)} />
                    ))}
                  </dl>
                </div>
              ) : null}
              {lead.notes ? (
                <div className="mt-3">
                  <p className="text-xs text-zinc-500 mb-1">Notes</p>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                    {lead.notes}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Household & goals (onboarding lane, feature-detected) */}
          {!isLead && familyProfile ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <span className="text-sm font-medium text-zinc-300">
                Household &amp; goals
              </span>
              <dl className="mt-3 space-y-1.5 text-sm">
                {profileEntries(familyProfile).map(([k, v]) => (
                  <Row key={k} label={humanize(k)} value={v} />
                ))}
              </dl>
            </div>
          ) : null}

          {/* Admin notes (members only) */}
          {!isLead && userId ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-zinc-300">
                  Admin notes
                </span>
              </div>
              <div className="flex gap-2 mb-3">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add an internal note…"
                  rows={2}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/50 placeholder:text-zinc-600 resize-none"
                />
                <button
                  onClick={submitNote}
                  disabled={!newNote.trim() || savingNote}
                  className="self-end bg-amber-400 text-zinc-950 rounded-lg px-3 py-2 text-sm font-medium hover:bg-amber-300 transition-colors disabled:opacity-40"
                  title="Save note"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {notes.length === 0 ? (
                  <p className="text-xs text-zinc-600">No notes yet</p>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      className="group rounded-lg bg-zinc-800/40 px-3 py-2"
                    >
                      <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">
                        {n.note}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-zinc-600">
                          {n.author?.display_name || "Admin"} ·{" "}
                          {shortDate(n.created_at)}
                        </span>
                        <button
                          onClick={() => removeNote(n.id)}
                          className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {modal && (
        <ContactCommsModal
          target={modal.target}
          channel={modal.channel}
          onClose={() => setModal(null)}
          onSent={() => loadTimelineAndSupport(email)}
        />
      )}
    </div>
  );
}

function XpBar({ member }: { member: MemberRow }) {
  const lvl = levelForXp(member.xp_total);
  const prog = levelProgress(member.xp_total);
  return (
    <div className="mt-4 max-w-md">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-zinc-300 font-medium">
          Level {lvl.level} · {lvl.name}
        </span>
        <span className="text-amber-400/80">
          {member.xp_total.toLocaleString()} XP
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full bg-amber-400" style={{ width: `${prog.pct}%` }} />
      </div>
      {prog.next ? (
        <p className="text-[11px] text-zinc-600 mt-1">
          {prog.toNext} XP to {prog.next.name}
        </p>
      ) : (
        <p className="text-[11px] text-zinc-600 mt-1">Max level</p>
      )}
    </div>
  );
}

function MemberStats({ member }: { member: MemberRow }) {
  const STATS: { label: string; value: number }[] = [
    { label: "Lessons", value: member.lessons_completed },
    { label: "Quizzes", value: member.quizzes_taken },
    { label: "Quizzes passed", value: member.quizzes_passed },
    { label: "Posts", value: member.posts },
    { label: "Comments", value: member.comments },
    { label: "Missions", value: member.missions },
    { label: "Watchlist", value: member.watchlist_adds },
    { label: "RSVPs", value: member.rsvps },
    { label: "Badges", value: member.badges },
    { label: "Chat msgs", value: member.chat_messages },
  ];
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <span className="text-sm font-medium text-zinc-300">Stats</span>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-lg bg-zinc-800/40 px-3 py-2">
            <p className="text-lg font-bold text-zinc-100">{s.value}</p>
            <p className="text-[11px] text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-zinc-500 shrink-0">{label}</dt>
      <dd className="text-zinc-200 text-right break-words capitalize">
        {value || "—"}
      </dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/crm/members"
      className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" /> Back to contacts
    </Link>
  );
}

/* ── helpers for arbitrary onboarding/quiz shapes ─────────────────────────── */

function humanize(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Only surface scalar / string-array fields from an unknown RPC shape. */
function profileEntries(obj: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === "") continue;
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean" ||
      (Array.isArray(v) && v.every((x) => typeof x === "string"))
    ) {
      out.push([k, stringify(v)]);
    }
  }
  return out.slice(0, 12);
}

/**
 * Role + membership-tier editor, ported from the retired /admin/users
 * directory so the merge into CRM Contacts loses no capability. Role writes to
 * profiles.role directly; the tier flip goes through admin_set_family_tier
 * (migration 029) which upserts/cancels the family's enrollment — the single
 * source of truth every access gate reads. Renders only for members that have
 * a family (tier is a family-level concept).
 */
const ADMIN_ROLE_OPTIONS = ["parent", "child", "coach", "admin"];
const ADMIN_TIER_OPTIONS: FamilyTier[] = ["fic", "fta"];

function MemberAdminControls({ member }: { member: MemberRow }) {
  const supabase = useMemo(() => createClient(), []);
  const [role, setRole] = useState(member.role);
  const [tier, setTier] = useState<FamilyTier>(member.tier);
  const [savingRole, setSavingRole] = useState(false);
  const [savingTier, setSavingTier] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function changeRole(next: string) {
    const prev = role;
    setRole(next);
    setSavingRole(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ role: next })
      .eq("id", member.id);
    setSavingRole(false);
    if (error) {
      setRole(prev);
      setMsg("Could not change role.");
    }
  }

  async function changeTier(next: FamilyTier) {
    if (!member.family_id) return;
    const prev = tier;
    setTier(next);
    setSavingTier(true);
    setMsg(null);
    const { error } = await supabase.rpc("admin_set_family_tier", {
      p_family_id: member.family_id,
      p_tier: next,
    });
    setSavingTier(false);
    if (error) {
      setTier(prev);
      setMsg("Could not change tier.");
    } else {
      setMsg(`Family set to ${TIER_CONFIG[next].label}.`);
    }
  }

  return (
    <div className="mt-4 flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-1.5 text-xs text-zinc-500">
        Role
        <select
          value={role}
          disabled={savingRole}
          onChange={(e) => changeRole(e.target.value)}
          className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-amber-400/50 disabled:opacity-50"
        >
          {ADMIN_ROLE_OPTIONS.map((r) => (
            <option key={r} value={r} className="bg-zinc-900">
              {r}
            </option>
          ))}
        </select>
      </label>
      {member.family_id ? (
        <label className="flex items-center gap-1.5 text-xs text-zinc-500">
          Tier
          <select
            value={tier}
            disabled={savingTier}
            title="Membership tier — sets the whole family"
            onChange={(e) => changeTier(e.target.value as FamilyTier)}
            className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-amber-300 focus:outline-none focus:border-amber-400/50 disabled:opacity-50"
          >
            {ADMIN_TIER_OPTIONS.map((t) => (
              <option key={t} value={t} className="bg-zinc-900 text-zinc-100">
                {TIER_CONFIG[t].label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {msg ? <span className="text-xs text-amber-300">{msg}</span> : null}
    </div>
  );
}
