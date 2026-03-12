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

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

export default function FamilyPage() {
  const supabase = createClient();

  const [family, setFamily] = useState<FamilyData | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  const loadFamily = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's profile to find family_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", user.id)
      .single();

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
      .select("id, display_name, role, track, age_group, avatar_url, last_active, lessons_completed")
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
      challenge: "bg-green-500/10 text-green-400 border-green-500/20",
      academy: "bg-gold-400/10 text-gold-400 border-gold-400/20",
      free: "bg-midnight-600/30 text-midnight-300 border-midnight-600",
    };
    return colors[tier] || colors.free;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!family) {
    return (
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glow-border rounded-xl bg-midnight-900/60 p-12 text-center"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-gold-400/10 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-gold-400" />
          </div>
          <h3 className="font-display text-xl font-bold text-midnight-100 mb-2">
            No Family Yet
          </h3>
          <p className="text-midnight-400 text-sm font-body mb-6 max-w-md mx-auto">
            Complete your onboarding to create a family and start inviting
            members to learn together.
          </p>
          <a
            href="/onboarding"
            className="cta-button inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm"
          >
            Complete Setup
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-display text-2xl font-bold text-midnight-100">
              {family.name}
            </h2>
            <span
              className={`text-[10px] font-display font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${tierBadge(
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

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setShowInviteModal(true);
            if (!inviteLink) generateInviteLink();
          }}
          className="cta-button flex items-center gap-2 px-5 py-3 rounded-lg text-sm self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          Invite Family Member
        </motion.button>
      </motion.div>

      {/* Members Grid */}
      {members.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glow-border rounded-xl bg-midnight-900/60 p-12 text-center"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-gold-400/10 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-gold-400" />
          </div>
          <h3 className="font-display text-lg font-semibold text-midnight-100 mb-2">
            No Members Yet
          </h3>
          <p className="text-midnight-400 text-sm font-body max-w-sm mx-auto">
            Invite your family members to start learning together. Share the
            invite link to get started.
          </p>
        </motion.div>
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
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ y: -4 }}
                className="glow-border rounded-xl bg-midnight-900/60 p-5 transition-all"
              >
                <div className="flex items-start gap-3 mb-4">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.display_name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-gold-400/20"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gold-400/20 flex items-center justify-center text-gold-400 font-display font-bold text-sm shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-semibold text-midnight-100 truncate">
                        {member.display_name || "Member"}
                      </p>
                      {member.role === "parent" && (
                        <Crown className="w-4 h-4 text-gold-400 shrink-0" />
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
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {member.last_active
                        ? new Date(member.last_active).toLocaleDateString()
                        : "Not yet active"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-midnight-400">
                    <BookOpen className="w-3.5 h-3.5 shrink-0" />
                    <span>{member.lessons_completed || 0} lessons</span>
                  </div>
                </div>

                {member.age_group && (
                  <div className="mt-3 flex items-center gap-2">
                    <GraduationCap className="w-3.5 h-3.5 text-midnight-500" />
                    <span className="text-xs text-midnight-500 capitalize font-body">
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto glow-border-strong rounded-2xl bg-midnight-900 p-6 z-50"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-bold text-gold-400">
                  Invite Family Member
                </h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-midnight-400 hover:text-midnight-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-midnight-300 font-body mb-5">
                Share this link with a family member. It expires in 7 days.
              </p>

              {generatingLink ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="flex-1 px-4 py-3 rounded-lg bg-midnight-800 border border-midnight-600 text-midnight-200 text-sm font-mono truncate"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopy}
                    className="shrink-0 px-4 py-3 rounded-lg bg-gold-400/10 border border-gold-400/30 text-gold-400 hover:bg-gold-400/20 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </motion.button>
                </div>
              )}

              <p className="text-xs text-midnight-500 mt-4 font-body">
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
