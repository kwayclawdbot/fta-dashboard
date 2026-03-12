"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Flame,
  Award,
  Play,
  Calendar,
  ArrowRight,
  Users,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import MilestoneAlert from "@/components/dashboard/MilestoneAlert";

const stats = [
  { label: "Lessons", value: 0, icon: BookOpen },
  { label: "Streak", value: 0, icon: Flame },
  { label: "Badges", value: 0, icon: Award },
];

interface FamilyActivity {
  member_name: string | null;
  lesson_title: string;
  completed_at: string;
}

interface Milestone {
  member_name: string | null;
  achievement: string;
  timestamp: string;
}

export default function DashboardPage() {
  const [displayName, setDisplayName] = useState("");
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const [familyName, setFamilyName] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [isParent, setIsParent] = useState(false);
  const [familyActivities, setFamilyActivities] = useState<FamilyActivity[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setDisplayName(
      user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        "Trader"
    );

    // Check profile for onboarding status & family
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete, family_id, role")
      .eq("id", user.id)
      .single();

    if (profile) {
      setOnboardingComplete(profile.onboarding_complete ?? false);
      const parentRole = profile.role === "parent";
      setIsParent(parentRole);

      if (profile.family_id) {
        // Get family info
        const { data: family } = await supabase
          .from("families")
          .select("name")
          .eq("id", profile.family_id)
          .single();

        if (family) {
          setFamilyName(family.name);
        }

        // Count members
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("family_id", profile.family_id);

        setMemberCount(count || 0);

        // Load family activity + milestones for parents
        if (parentRole) {
          try {
            const [actData, mileData] = await Promise.all([
              apiFetch<{ activities: FamilyActivity[] }>(
                "/api/v1/family-dashboard/activity"
              ),
              apiFetch<{ milestones: Milestone[] }>(
                "/api/v1/family-dashboard/milestones"
              ),
            ]);
            setFamilyActivities(actData.activities.slice(0, 3));
            setMilestones(mileData.milestones.slice(0, 3));
          } catch {
            // silent -- parent dashboard data is supplementary
          }
        }
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Onboarding CTA Banner */}
      {!onboardingComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 border-l-2 border-gold-400 pl-4 py-3"
        >
          <AlertCircle className="w-5 h-5 text-gold-400 shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1">
            <p className="font-display text-sm font-semibold text-midnight-100">
              Complete Your Setup
            </p>
            <p className="text-sm text-midnight-400 font-body mt-0.5">
              Finish onboarding to create your family and unlock all features.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="cta-button flex items-center gap-2 px-4 py-2 rounded-lg text-sm shrink-0"
          >
            Complete Setup
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      )}

      {/* Welcome -- plain text, no card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mb-10"
      >
        <h2 className="font-display text-3xl font-bold text-midnight-50">
          Welcome back, {displayName || "Trader"}
        </h2>
        <p className="text-midnight-400 text-base mt-1 font-body">
          Let&apos;s keep building your family&apos;s legacy.
        </p>
      </motion.div>

      {/* Stats -- inline row, no cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.3 }}
        className="flex items-center gap-0 mb-10"
      >
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`flex items-center gap-3 pr-8 ${
                i > 0 ? "pl-8 border-l border-midnight-700/50" : ""
              }`}
            >
              <Icon className="w-4 h-4 text-midnight-400" />
              <div>
                <p className="font-display text-2xl font-bold text-midnight-50 leading-none">
                  {stat.value}
                </p>
                <p className="text-xs text-midnight-400 font-body mt-0.5">
                  {stat.label}
                </p>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Continue Learning -- prominent section, no card wrapper */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="mb-10 border-t border-midnight-800/50 pt-6"
      >
        <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-4">
          Continue Learning
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center shrink-0">
            <Play className="w-5 h-5 text-gold-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-midnight-300 font-body">
              No courses started yet. Begin your first lesson to start tracking progress.
            </p>
          </div>
          <Link
            href="/courses"
            className="text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors whitespace-nowrap flex items-center gap-1"
          >
            Browse courses
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>

      {/* Family info + Upcoming session -- two column */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8 border-t border-midnight-800/50 pt-6"
      >
        {/* Family */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-midnight-400" />
            <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider">
              Your Family
            </h3>
          </div>
          {familyName ? (
            <div className="mb-3">
              <p className="font-display text-lg font-semibold text-midnight-100">
                {familyName}
              </p>
              <p className="text-sm text-midnight-400 font-body">
                {memberCount} member{memberCount !== 1 ? "s" : ""}
              </p>
            </div>
          ) : (
            <p className="text-sm text-midnight-400 font-body mb-3">
              No family created yet. Complete onboarding to get started.
            </p>
          )}
          <Link
            href="/family"
            className="text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors flex items-center gap-1"
          >
            {familyName ? "Manage family" : "Set up family"}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Upcoming Live Session */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-midnight-400" />
            <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider">
              Upcoming Session
            </h3>
          </div>
          <p className="text-sm text-midnight-400 font-body mb-3">
            No upcoming sessions scheduled. Check back soon for live trading sessions.
          </p>
          <Link
            href="/live-sessions"
            className="text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors flex items-center gap-1"
          >
            View schedule
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>

      {/* Family Activity -- parents only */}
      {isParent && (milestones.length > 0 || familyActivities.length > 0) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="border-t border-midnight-800/50 pt-6 mt-10"
        >
          {/* Milestone alerts */}
          {milestones.length > 0 && (
            <div className="mb-6">
              {milestones.map((m, i) => (
                <MilestoneAlert
                  key={i}
                  memberName={m.member_name || "Member"}
                  achievement={m.achievement}
                  timestamp={m.timestamp}
                />
              ))}
            </div>
          )}

          {/* Recent family activity */}
          {familyActivities.length > 0 && (
            <div>
              <h3 className="font-display text-sm font-semibold text-midnight-300 uppercase tracking-wider mb-4">
                Family Activity
              </h3>
              {familyActivities.map((act, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2.5 border-b border-midnight-800/50 last:border-0"
                >
                  <p className="text-sm text-midnight-300 font-body flex-1 min-w-0 truncate">
                    <span className="text-midnight-100">
                      {act.member_name || "Member"}
                    </span>{" "}
                    completed {act.lesson_title}
                  </p>
                  <span className="text-xs text-midnight-500 font-body shrink-0">
                    {(() => {
                      const diff = Date.now() - new Date(act.completed_at).getTime();
                      const mins = Math.floor(diff / 60000);
                      const hours = Math.floor(diff / 3600000);
                      const days = Math.floor(diff / 86400000);
                      if (mins < 60) return `${mins}m ago`;
                      if (hours < 24) return `${hours}h ago`;
                      return `${days}d ago`;
                    })()}
                  </span>
                </div>
              ))}
              <Link
                href="/family/overview"
                className="text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors flex items-center gap-1 mt-3"
              >
                View all activity
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
