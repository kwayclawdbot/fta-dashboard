"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  Copy,
  Check,
  Crown,
  GraduationCap,
  Clock,
  BookOpen,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface FamilyMember {
  id: string;
  display_name: string;
  role: string;
  track: string;
  age_group: string;
  avatar_url?: string;
  last_active?: string;
  lessons_completed: number;
}

interface FamilyData {
  id: string;
  name: string;
  plan_tier: string;
}

export default function FamilyPage() {
  const supabase = createClient();
  const router = useRouter();

  const [family, setFamily] = useState<FamilyData | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [userRole, setUserRole] = useState("");

  const loadFamily = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's profile to find family_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id, role")
      .eq("id", user.id)
      .single();

    setUserRole(profile?.role || "");

    if (!profile?.family_id) {
      setLoading(false);
      return;
    }

    // Get family data
    const { data: familyData } = await supabase
      .from("families")
      .select("id, name, plan_tier")
      .eq("id", profile.family_id)
      .single();

    if (familyData) {
      setFamily(familyData);
    }

    // Get family members
    const { data: memberData } = await supabase
      .from("profiles")
      .select("id, display_name, role, track, age_group, avatar_url")
      .eq("family_id", profile.family_id);

    if (memberData) {
      setMembers(memberData as FamilyMember[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  async function generateInviteLink() {
    if (!family) return;
    setGeneratingLink(true);

    // Generate a random invite code
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

    // Store invite in database
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("family_invites").insert({
      family_id: family.id,
      code,
      invited_by: user?.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const link = `${window.location.origin}/signup/invite/${code}`;
    setInviteLink(link);
    setGeneratingLink(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      challenge: "bg-green-500/10 text-green-400",
      academy: "bg-gold-400/10 text-gold-400",
      free: "bg-midnight-800 text-midnight-300",
    };
    return colors[tier] || colors.free;
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!family) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center">
        <Users className="w-8 h-8 text-midnight-500 mx-auto mb-3" />
        <h3 className="font-display text-xl font-bold text-midnight-100 mb-2">
          No Family Yet
        </h3>
        <p className="text-midnight-400 text-sm font-body mb-6 max-w-md mx-auto">
          Complete your onboarding to create a family and start inviting
          members to learn together.
        </p>
        <a
          href="/onboarding"
          className="cta-button inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm"
        >
          Complete Setup
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header -- plain text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-display text-2xl font-bold text-midnight-100">
              {family.name}
            </h2>
            <span
              className={`text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded ${tierBadge(
                family.plan_tier || "free"
              )}`}
            >
              {family.plan_tier || "Free"}
            </span>
          </div>
          <p className="text-midnight-400 text-sm font-body">
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
      </motion.div>

      {/* Members Grid */}
      {members.length === 0 ? (
        <div className="py-12 text-center">
          <Users className="w-6 h-6 text-midnight-500 mx-auto mb-2" />
          <p className="font-display text-base font-semibold text-midnight-200 mb-1">
            No Members Yet
          </p>
          <p className="text-midnight-400 text-sm font-body max-w-sm mx-auto">
            Invite your family members to start learning together.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member, i) => {
            const initials = (member.display_name || "U")
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="rounded-lg border border-midnight-700/40 bg-midnight-900/30 p-5 transition-colors hover:border-midnight-600/60"
              >
                <div className="flex items-start gap-3 mb-4">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.display_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gold-400/15 flex items-center justify-center text-gold-400 font-display font-bold text-xs shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-semibold text-sm text-midnight-100 truncate">
                        {member.display_name || "Member"}
                      </p>
                      {member.role === "parent" && (
                        <Crown className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-midnight-400 font-body capitalize">
                      {member.role || "Member"} &middot;{" "}
                      {member.track || "No track"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-xs text-midnight-400">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {member.last_active
                        ? new Date(member.last_active).toLocaleDateString()
                        : "Not active"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-midnight-400">
                    <BookOpen className="w-3 h-3 shrink-0" />
                    <span>{member.lessons_completed || 0} lessons</span>
                  </div>
                </div>

                {member.age_group && (
                  <div className="mt-3 flex items-center gap-1.5">
                    <GraduationCap className="w-3 h-3 text-midnight-500" />
                    <span className="text-[11px] text-midnight-500 capitalize font-body">
                      {member.age_group} track
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInviteModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
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
                    className="flex-1 px-3 py-2.5 rounded-lg bg-midnight-800 border border-midnight-700 text-midnight-200 text-sm font-mono truncate"
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
