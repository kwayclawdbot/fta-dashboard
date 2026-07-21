"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Home,
  Mail,
  Calendar,
  StickyNote,
  Trash2,
  Send,
  Activity as ActivityIcn,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { levelForXp, levelProgress } from "@/lib/xp";
import {
  fetchMembers,
  fetchTimeline,
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
  AdminAvatar,
  TierChip,
  RoleChip,
  ActivityIcon,
  LastSeenDot,
} from "@/components/admin/crm/ui";

export default function MemberDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const supabase = createClient();

  const [member, setMember] = useState<MemberRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      setNotes(await fetchNotes(supabase, userId));
    } catch {
      /* notes are non-critical */
    }
  }, [supabase, userId]);

  const load = useCallback(async () => {
    try {
      const [members, tl, { data: auth }] = await Promise.all([
        fetchMembers(supabase),
        fetchTimeline(supabase, userId, 60),
        supabase.auth.getUser(),
      ]);
      setMember(members.find((m) => m.id === userId) ?? null);
      setTimeline(tl);
      setAdminId(auth.user?.id ?? null);
      await loadNotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load member");
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, loadNotes]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitNote() {
    if (!newNote.trim() || !adminId) return;
    setSavingNote(true);
    try {
      await addNote(supabase, userId, adminId, newNote.trim());
      setNewNote("");
      await loadNotes();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="max-w-3xl mx-auto">
        <BackLink />
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400 mt-4">
          {error || "Member not found"}
        </div>
      </div>
    );
  }

  const lvl = levelForXp(member.xp_total);
  const prog = levelProgress(member.xp_total);

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
    <div className="max-w-6xl mx-auto">
      <BackLink />

      {/* Profile header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 mt-4">
        <div className="flex items-start gap-5 flex-wrap">
          <AdminAvatar
            name={member.display_name}
            avatarUrl={member.avatar_url}
            tier={member.tier}
            size="xl"
          />
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-zinc-100">
                {member.display_name || "—"}
              </h1>
              <RoleChip role={member.role} />
              <TierChip tier={member.tier} />
              {member.onboarding_complete ? (
                <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                  Onboarded
                </span>
              ) : (
                <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                  Onboarding
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-zinc-400 flex-wrap">
              {member.email ? (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {member.email}
                </span>
              ) : null}
              {member.family_id ? (
                <Link
                  href={`/admin/crm/families/${member.family_id}`}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300"
                >
                  <Home className="w-3.5 h-3.5" /> {member.family_name || "Family"}
                </Link>
              ) : (
                <span className="flex items-center gap-1.5 text-zinc-600">
                  <Home className="w-3.5 h-3.5" /> No family
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Joined{" "}
                {shortDate(member.joined_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <LastSeenDot iso={member.last_seen} /> Last seen{" "}
                {relativeTime(member.last_seen)}
              </span>
            </div>

            {/* Level / XP bar */}
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
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${prog.pct}%` }}
                />
              </div>
              {prog.next ? (
                <p className="text-[11px] text-zinc-600 mt-1">
                  {prog.toNext} XP to {prog.next.name}
                </p>
              ) : (
                <p className="text-[11px] text-zinc-600 mt-1">Max level</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        {/* Timeline */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
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

        {/* Right column: stats + notes */}
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <span className="text-sm font-medium text-zinc-300">Stats</span>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg bg-zinc-800/40 px-3 py-2"
                >
                  <p className="text-lg font-bold text-zinc-100">{s.value}</p>
                  <p className="text-[11px] text-zinc-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Admin notes */}
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
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/crm/members"
      className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" /> Back to members
    </Link>
  );
}
