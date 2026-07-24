"use client";

import { useEffect, useState, useCallback } from "react";
import { m as mm, AnimatePresence } from "@/lib/motion";
import {
  UserPlus,
  Crown,
  GraduationCap,
  Trash2,
  X,
  Copy,
  Check,
  Award,
  Brain,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTier, type FamilyTier } from "@/lib/tier";
import TierBadge from "@/components/TierBadge";
import Avatar from "@/components/Avatar";
import { getBadgeSummaries, type BadgeSummary } from "@/lib/badges";

interface FamilyMember {
  id: string;
  display_name: string | null;
  role: string;
  track: string | null;
  age_group: string | null;
  avatar_url: string | null;
  email: string | null;
  onboarding_complete: boolean;
}

export default function FamilyMembersPage() {
  const router = useRouter();
  const supabase = createClient();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [summaries, setSummaries] = useState<Record<string, BadgeSummary>>({});
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string>("");
  const [tier, setTier] = useState<FamilyTier>("fic");

  // Parent view/clear of a family member's Kai memory (Lane 8B). Authorized by
  // the kai_memory_view / kai_memory_clear definer RPCs (parent-of-same-family).
  const [memoryFor, setMemoryFor] = useState<{ id: string; name: string } | null>(null);
  const [memoryText, setMemoryText] = useState<string | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryClearing, setMemoryClearing] = useState(false);

  async function openMemory(id: string, name: string) {
    setMemoryFor({ id, name });
    setMemoryText(null);
    setMemoryLoading(true);
    const { data } = await supabase.rpc("kai_memory_view", { p_user: id });
    const row = (data || {}) as { summary?: string };
    setMemoryText(row.summary || "");
    setMemoryLoading(false);
  }

  async function clearMemory() {
    if (!memoryFor) return;
    setMemoryClearing(true);
    await supabase.rpc("kai_memory_clear", { p_user: memoryFor.id });
    setMemoryText("");
    setMemoryClearing(false);
  }

  const loadMembers = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, family_id")
      .eq("id", user.id)
      .single();

    // Kid privacy lock: children go straight back to their own home.
    if (profile?.role === "child") {
      router.replace("/dashboard");
      return;
    }
    if (!profile || profile.role !== "parent") {
      router.replace("/dashboard");
      return;
    }

    setFamilyId(profile.family_id || "");

    if (!profile.family_id) {
      setLoading(false);
      return;
    }

    // Membership tier (FIC/FTA) — every member inherits it.
    setTier(await getFamilyTier(supabase, profile.family_id));

    const { data: memberData } = await supabase
      .from("profiles")
      .select("id, display_name, role, track, age_group, avatar_url, email, onboarding_complete")
      .eq("family_id", profile.family_id);

    const list = (memberData as FamilyMember[]) || [];
    setMembers(list);
    setLoading(false);

    // Earned-badge summaries (count + top credential) for every member.
    if (list.length) {
      setSummaries(await getBadgeSummaries(supabase, list.map((m) => m.id)));
    }
  }, [supabase, router]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function generateInviteLink() {
    if (!familyId) return;
    setGeneratingLink(true);

    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

    // family_invites has no `invited_by` column — sending it made PostgREST
    // reject the insert, so the "invite link" pointed at a code that was never
    // stored (a dead link). Insert only real columns; role defaults to 'child'.
    const { error: inviteErr } = await supabase.from("family_invites").insert({
      family_id: familyId,
      code,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (!inviteErr) setInviteLink(`${window.location.origin}/signup/invite/${code}`);
    setGeneratingLink(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRemoveMember(userId: string) {
    await supabase
      .from("profiles")
      .update({ family_id: null })
      .eq("id", userId);
    setMembers((prev) => prev.filter((m) => m.id !== userId));
    setConfirmRemove(null);
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setUpdatingRole(userId);
    await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);
    setMembers((prev) =>
      prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
    );
    setUpdatingRole(null);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <mm.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-2xl font-bold text-midnight-100">
              Manage Members
            </h2>
            <TierBadge tier={tier} size="md" />
          </div>
          <p className="text-midnight-400 text-sm font-body mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""} in your
            family
          </p>
        </div>
        <button
          onClick={() => {
            setShowInviteModal(true);
            if (!inviteLink) generateInviteLink();
          }}
          className="cta-button flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
      </mm.div>

      {/* Members list */}
      <mm.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.3 }}
      >
        {members.map((member) => {
          const isCurrentUser = member.id === currentUserId;
          const summary = summaries[member.id];

          return (
            <div
              key={member.id}
              className="flex items-center gap-4 py-4 border-b border-midnight-800/50 last:border-0"
            >
              {/* Avatar */}
              <Avatar
                name={member.display_name}
                avatarUrl={member.avatar_url}
                role={member.role}
                tier={tier}
                size="md"
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-display font-semibold text-midnight-100 truncate">
                    {member.display_name || "Member"}
                    {isCurrentUser && (
                      <span className="text-midnight-500 font-body font-normal ml-1">
                        (you)
                      </span>
                    )}
                  </p>
                  {member.role === "parent" && (
                    <Crown className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                  )}
                  {summary && summary.count > 0 && (
                    <span
                      title={`${summary.count} credential${summary.count !== 1 ? "s" : ""} earned`}
                      className="inline-flex items-center gap-1 rounded-md bg-chip-amber text-gold-800 px-1.5 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider shrink-0"
                    >
                      <Award className="w-2.5 h-2.5" />
                      {summary.topTitle}
                      {summary.count > 1 && <span className="opacity-70">+{summary.count - 1}</span>}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-midnight-400 font-body mt-0.5">
                  <span className="capitalize">{member.track || "No track"}</span>
                  {member.age_group && (
                    <>
                      <span className="text-midnight-600">&middot;</span>
                      <span className="capitalize flex items-center gap-1">
                        <GraduationCap className="w-3 h-3" />
                        {member.age_group}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Kai memory (parent can view/clear a member's Kai memory) */}
              {!isCurrentUser && (
                <button
                  onClick={() => openMemory(member.id, member.display_name || "This member")}
                  className="text-midnight-500 hover:text-gold-500 transition-colors shrink-0"
                  aria-label={`What Kai remembers about ${member.display_name || "this member"}`}
                  title="What Kai remembers"
                >
                  <Brain className="w-4 h-4" />
                </button>
              )}

              {/* Role dropdown */}
              {!isCurrentUser && (
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value)}
                  disabled={updatingRole === member.id}
                  className="bg-midnight-800 border border-midnight-700 rounded-md px-2 py-1 text-xs text-midnight-200 font-body shrink-0 focus:outline-none focus:border-midnight-600"
                >
                  <option value="parent">Parent</option>
                  <option value="teen">Teen</option>
                  <option value="child">Child</option>
                </select>
              )}

              {/* Remove button */}
              {!isCurrentUser && (
                <>
                  {confirmRemove === member.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-xs text-red-400 hover:text-red-300 font-body transition-colors"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => setConfirmRemove(null)}
                        className="text-xs text-midnight-400 hover:text-midnight-200 font-body transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(member.id)}
                      className="text-midnight-500 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </mm.div>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <>
            <mm.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInviteModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <mm.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto rounded-xl bg-midnight-900 border border-midnight-700 p-6 z-50"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-base font-bold text-midnight-100">
                  Invite Family Member
                </h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-midnight-400 hover:text-midnight-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-midnight-300 font-body mb-4">
                Share this link with a family member. It expires in 7 days.
              </p>

              {generatingLink ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="flex-1 px-3 py-2.5 rounded-lg bg-midnight-800 border border-midnight-700 text-midnight-200 text-sm truncate"
                  />
                  <button
                    onClick={handleCopy}
                    className="shrink-0 px-3 py-2.5 rounded-lg bg-midnight-800 border border-midnight-700 text-midnight-300 hover:text-midnight-100 hover:bg-midnight-700 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}

              <p className="text-[11px] text-midnight-500 mt-3 font-body">
                The invited member will join your family and can start learning
                immediately.
              </p>
            </mm.div>
          </>
        )}
      </AnimatePresence>

      {/* Kai memory panel (parent view/clear a member's memory — Lane 8B) */}
      <AnimatePresence>
        {memoryFor && (
          <>
            <mm.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMemoryFor(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <mm.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto rounded-xl bg-midnight-900 border border-midnight-700 p-6 z-50"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400/20">
                  <Brain className="h-4 w-4 text-gold-700" />
                </span>
                <h3 className="flex-1 font-display text-base font-bold text-midnight-100">
                  What Kai remembers about {memoryFor.name}
                </h3>
                <button
                  onClick={() => setMemoryFor(null)}
                  className="text-midnight-400 hover:text-midnight-200 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto rounded-lg border border-midnight-700 bg-midnight-800 p-3 text-sm text-midnight-200 font-body">
                {memoryLoading ? (
                  <span className="flex items-center gap-2 text-midnight-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </span>
                ) : memoryText ? (
                  memoryText
                ) : (
                  <span className="text-midnight-400">
                    Kai doesn&apos;t have any notes about {memoryFor.name} yet.
                  </span>
                )}
              </div>

              {!memoryLoading && memoryText && (
                <button
                  onClick={clearMemory}
                  disabled={memoryClearing}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-midnight-700 px-3 py-2.5 text-sm font-semibold text-midnight-300 transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                >
                  {memoryClearing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Clear {memoryFor.name}&apos;s Kai memory
                </button>
              )}
            </mm.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
