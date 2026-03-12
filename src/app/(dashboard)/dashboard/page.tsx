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
  UserPlus,
  Settings,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const stats = [
  { label: "Lessons Completed", value: 0, icon: BookOpen, color: "text-gold-400" },
  { label: "Current Streak", value: 0, icon: Flame, color: "text-gold-500" },
  { label: "Badges Earned", value: 0, icon: Award, color: "text-gold-400" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4 },
  }),
};

const quickLinks = [
  { label: "Invite Family", href: "/family", icon: UserPlus, desc: "Add members to your family" },
  { label: "View Courses", href: "/courses", icon: BookOpen, desc: "Browse available courses" },
  { label: "Settings", href: "/settings", icon: Settings, desc: "Manage your account" },
];

export default function DashboardPage() {
  const [displayName, setDisplayName] = useState("");
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const [familyName, setFamilyName] = useState("");
  const [memberCount, setMemberCount] = useState(0);

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
      .select("onboarding_complete, family_id")
      .eq("id", user.id)
      .single();

    if (profile) {
      setOnboardingComplete(profile.onboarding_complete ?? false);

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
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Onboarding CTA Banner */}
      {!onboardingComplete && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glow-border-strong rounded-xl bg-gradient-to-r from-gold-400/5 to-gold-600/5 p-5"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gold-400/20 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-gold-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-base font-semibold text-gold-400">
                Complete Your Setup
              </h3>
              <p className="text-sm text-midnight-300 font-body mt-0.5">
                Finish onboarding to create your family and unlock all features.
              </p>
            </div>
            <Link
              href="/onboarding"
              className="cta-button flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm shrink-0"
            >
              Complete Setup
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      )}

      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="font-display text-2xl font-bold text-midnight-100">
          Welcome back,{" "}
          <span className="text-gradient-gold">{displayName || "Trader"}</span>
        </h2>
        <p className="text-midnight-400 text-sm mt-1 font-body">
          Let&apos;s keep building your family&apos;s legacy.
        </p>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="glow-border rounded-xl bg-midnight-900/60 p-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-midnight-50">
                    {stat.value}
                  </p>
                  <p className="text-xs text-midnight-400 font-body">
                    {stat.label}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Family Card + Continue Learning */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Your Family */}
        <motion.div
          custom={3}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="glow-border rounded-xl bg-midnight-900/60 p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-midnight-100">
                Your Family
              </h3>
              <p className="text-sm text-midnight-400 mt-1 font-body">
                Manage your family group
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-gold-400" />
            </div>
          </div>

          {familyName ? (
            <div className="rounded-lg bg-midnight-800/60 border border-midnight-700 p-4 mb-4">
              <p className="font-display text-base font-semibold text-midnight-100">
                {familyName}
              </p>
              <p className="text-xs text-midnight-400 mt-1 font-body">
                {memberCount} member{memberCount !== 1 ? "s" : ""}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-midnight-800/60 border border-midnight-700 p-4 mb-4">
              <p className="text-sm text-midnight-300 font-body">
                No family created yet. Complete onboarding to get started.
              </p>
            </div>
          )}

          <Link
            href="/family"
            className="inline-flex items-center gap-1.5 text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors"
          >
            {familyName ? "Manage family" : "Set up family"}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Continue Learning */}
        <motion.div
          custom={4}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="glow-border rounded-xl bg-midnight-900/60 p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-midnight-100">
                Continue Learning
              </h3>
              <p className="text-sm text-midnight-400 mt-1 font-body">
                Pick up where you left off
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
              <Play className="w-5 h-5 text-gold-400" />
            </div>
          </div>

          <div className="rounded-lg bg-midnight-800/60 border border-midnight-700 p-4 mb-4">
            <p className="text-sm text-midnight-300 font-body">
              No courses started yet. Begin your first lesson to start tracking
              progress.
            </p>
          </div>

          <Link
            href="/courses"
            className="inline-flex items-center gap-1.5 text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors"
          >
            Browse courses
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {quickLinks.map((link, i) => {
          const Icon = link.icon;
          return (
            <motion.div
              key={link.href}
              custom={5 + i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <Link
                href={link.href}
                className="group block glow-border rounded-xl bg-midnight-900/60 p-5 hover:bg-midnight-800/60 transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-gold-400/10 flex items-center justify-center group-hover:bg-gold-400/20 transition-colors">
                    <Icon className="w-4 h-4 text-gold-400" />
                  </div>
                  <h4 className="font-display text-sm font-semibold text-midnight-100 group-hover:text-gold-400 transition-colors">
                    {link.label}
                  </h4>
                </div>
                <p className="text-xs text-midnight-400 font-body">
                  {link.desc}
                </p>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Upcoming Live Session */}
      <motion.div
        custom={8}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="glow-border rounded-xl bg-midnight-900/60 p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-midnight-100">
              Upcoming Live Session
            </h3>
            <p className="text-sm text-midnight-400 mt-1 font-body">
              Next scheduled session
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-gold-400" />
          </div>
        </div>

        <div className="rounded-lg bg-midnight-800/60 border border-midnight-700 p-4 mb-4">
          <p className="text-sm text-midnight-300 font-body">
            No upcoming sessions scheduled. Check back soon for live trading
            sessions.
          </p>
        </div>

        <Link
          href="/live-sessions"
          className="inline-flex items-center gap-1.5 text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors"
        >
          View schedule
          <ArrowRight className="w-4 h-4" />
        </Link>
      </motion.div>
    </div>
  );
}
