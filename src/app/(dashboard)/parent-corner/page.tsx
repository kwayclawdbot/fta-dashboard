"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookHeart,
  Lock,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  TimerReset,
  Trophy,
  Utensils,
  Lightbulb,
  Ban,
  CheckCircle2,
  Circle,
  Target,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentFicWeek, type FicWeek } from "@/lib/fic";
import { researchComplete, type WatchlistItem } from "@/lib/watchlist";
import Avatar from "@/components/Avatar";

/** Evergreen parent guidance — always available regardless of the week. */
const EVERGREEN = [
  {
    icon: BookHeart,
    title: "Education first, never a stock tip",
    body: "Nothing in the club is advice to buy or sell. We study how real businesses work so your kids build judgment. If a lesson ever starts to feel like a hot tip, steer it back to “what does this company actually do, and how does it make money?”",
  },
  {
    icon: ShieldAlert,
    title: "How to talk about risk",
    body: "Every company — even the biggest — has things that could go wrong. Normalize this. When your child names a strength, gently ask for a risk too. “What could make people buy less of this?” builds the habit of looking at both sides before forming an opinion.",
  },
  {
    icon: TimerReset,
    title: "Patience and the long game",
    body: "Investing rewards patience, and kids feel the pull to “win” fast. Remind them we’re building a habit — one company a week — not chasing quick money. The gambler hopes; the investor studies and waits.",
  },
  {
    icon: Trophy,
    title: "Praise the process, not the price",
    body: "Celebrate good questions and careful research, not whether a practice pick went up. “Great thinking on that risk” teaches more than “nice, it went up.” This keeps confidence tied to effort, which is the skill that lasts.",
  },
  {
    icon: Ban,
    title: "Keep it safe and pressure-free",
    body: "No real money is required to take part, and there’s no pressure to open accounts or contribute. Whether and how much your family sets aside is a private decision you make at home. Let each kid go at their own pace.",
  },
];

/** One child's at-a-glance state for the per-child strip. */
interface ChildStat {
  id: string;
  display_name: string;
  avatar_url: string | null;
  age_group: string | null;
  missionsThisWeek: number;
  watchlistCount: number;
  researchedCount: number;
  xpThisWeek: number;
}

export default function ParentCornerPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isParent, setIsParent] = useState(false);
  const [week, setWeek] = useState<FicWeek | null>(null);
  const [children, setChildren] = useState<ChildStat[]>([]);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, family_id")
        .eq("id", user.id)
        .single();
      const parent = profile?.role === "parent" || profile?.role === "admin";
      setIsParent(parent);
      if (parent) {
        setWeek(await getCurrentFicWeek(supabase));
        if (profile?.family_id) {
          void loadChildStrip(profile.family_id).catch(() => {});
        }
      }
      setLoading(false);
    }

    // Per-child "your family this week" strip (audit #4). ONE batched fetch —
    // roster + this-week missions + family watchlist + this-week XP — then all
    // roll-ups happen in memory. No per-child round trips (no N+1).
    async function loadChildStrip(familyId: string) {
      const { data: roster } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, age_group, role")
        .eq("family_id", familyId);
      const kids = (roster || []).filter((m) => m.role === "child");
      if (kids.length === 0) return;
      const kidIds = kids.map((k) => k.id);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoIso = weekAgo.toISOString();

      const [missionsRes, watchlistRes, xpRes] = await Promise.all([
        supabase
          .from("mission_completions")
          .select("user_id")
          .in("user_id", kidIds)
          .gte("completed_at", weekAgoIso),
        // Watchlist is family-scoped; filter by champion_id in memory so it's
        // one query, not one per child.
        supabase
          .from("family_watchlist")
          .select("champion_id, how_they_make_money, strength, risk, trend")
          .eq("family_id", familyId),
        supabase
          .from("xp_events")
          .select("user_id, amount")
          .in("user_id", kidIds)
          .gte("created_at", weekAgoIso),
      ]);

      const missionCount: Record<string, number> = {};
      (missionsRes.data || []).forEach((r) => {
        missionCount[r.user_id] = (missionCount[r.user_id] || 0) + 1;
      });

      const wlCount: Record<string, number> = {};
      const researchedCount: Record<string, number> = {};
      (watchlistRes.data || []).forEach((r) => {
        const cid = (r as { champion_id: string | null }).champion_id;
        if (!cid) return;
        wlCount[cid] = (wlCount[cid] || 0) + 1;
        if (researchComplete(r as Partial<WatchlistItem>)) {
          researchedCount[cid] = (researchedCount[cid] || 0) + 1;
        }
      });

      const xpByKid: Record<string, number> = {};
      (xpRes.data || []).forEach((r: { user_id: string; amount: number }) => {
        xpByKid[r.user_id] = (xpByKid[r.user_id] || 0) + (r.amount || 0);
      });

      setChildren(
        kids.map((k) => ({
          id: k.id,
          display_name: k.display_name || "Member",
          avatar_url: k.avatar_url,
          age_group: k.age_group,
          missionsThisWeek: missionCount[k.id] || 0,
          watchlistCount: wlCount[k.id] || 0,
          researchedCount: researchedCount[k.id] || 0,
          xpThisWeek: xpByKid[k.id] || 0,
        }))
      );
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-56 rounded-lg bg-sand/60" />
        <div className="h-64 rounded-2xl bg-sand/40" />
      </div>
    );
  }

  if (!isParent) {
    return (
      <div className="max-w-lg mx-auto paper-card p-8 text-center mt-10">
        <Lock className="w-8 h-8 text-gold-500 mx-auto mb-3" />
        <h1 className="font-display text-xl font-semibold text-ink mb-2">
          Parent Corner
        </h1>
        <p className="text-soft mb-5">
          This space is just for parents and guardians — coaching for the
          grown-ups guiding the family.
        </p>
        <Link
          href="/dashboard"
          className="cta-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const parentSections: { icon: React.ElementType; title: string; body: string | null }[] =
    week
      ? [
          {
            icon: Sparkles,
            title: "What your child learned",
            body: week.parent_what_child_learned,
          },
          {
            icon: Utensils,
            title: "Dinner-table questions",
            body: week.parent_dinner_questions,
          },
          {
            icon: Lightbulb,
            title: "Explain it simply",
            body: week.parent_explain_simply,
          },
          {
            icon: Ban,
            title: "What not to do",
            body: week.parent_what_not_to_do,
          },
          {
            icon: ShieldAlert,
            title: "The risk talk",
            body: week.parent_risk_talk,
          },
          {
            icon: TimerReset,
            title: "On patience",
            body: week.parent_patience,
          },
        ].filter((s) => s.body)
      : [];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-amber text-gold-800 text-xs font-semibold">
            <BookHeart className="w-3.5 h-3.5" />
            Parent Corner
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Coaching for the grown-ups
        </h1>
        <p className="text-soft mt-1 max-w-2xl leading-relaxed">
          You don&apos;t need to be a market expert to lead this at home. Each
          week we hand you the conversation — what your kids learned, how to talk
          about it, and what to avoid.
        </p>
      </div>

      {/* Per-child strip — "your family this week at a glance" (audit #4).
          Sits above the weekly reading so the guiding parent sees where their
          OWN kids are before the coaching text. */}
      {children.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-ink mb-3">
            Your family this week
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {children.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="paper-card p-4 flex items-center gap-3"
              >
                <Avatar
                  name={c.display_name}
                  avatarUrl={c.avatar_url}
                  role="child"
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-ink text-sm truncate">
                    {c.display_name}
                    {c.age_group && (
                      <span className="ml-1.5 text-xs font-body font-normal text-soft capitalize">
                        {c.age_group}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1 text-xs text-soft"
                      title="Missions completed this week"
                    >
                      {c.missionsThisWeek > 0 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-midnight-600" />
                      )}
                      {c.missionsThisWeek > 0
                        ? `${c.missionsThisWeek} mission${c.missionsThisWeek === 1 ? "" : "s"}`
                        : "No mission yet"}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-xs text-soft"
                      title="Companies on the watchlist they champion (researched)"
                    >
                      <Target className="w-3.5 h-3.5 text-gold-600" />
                      {c.watchlistCount > 0
                        ? `${c.watchlistCount} pick${c.watchlistCount === 1 ? "" : "s"}${
                            c.researchedCount > 0
                              ? ` · ${c.researchedCount} researched`
                              : ""
                          }`
                        : "No picks yet"}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium text-gold-700"
                      title="XP earned this week"
                    >
                      <Zap className="w-3.5 h-3.5 text-gold-500" />
                      {c.xpThisWeek > 0 ? `+${c.xpThisWeek} XP` : "0 XP"}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* This week's parent content */}
      {week ? (
        <div className="paper-card p-6 lg:p-7">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="font-display text-lg font-semibold text-ink">
              This week: {week.class_title}
            </h2>
            {week.company_name && (
              <span className="text-xs text-soft">
                · {week.company_name}
                {week.company_ticker ? ` (${week.company_ticker})` : ""}
              </span>
            )}
          </div>
          {parentSections.length === 0 ? (
            <p className="text-sm text-soft mt-2">
              This week&apos;s parent notes are being prepared.
            </p>
          ) : (
            <div className="space-y-5 mt-4">
              {parentSections.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gold-400/15 flex items-center justify-center shrink-0">
                      <Icon className="w-[18px] h-[18px] text-gold-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-soft mb-0.5">
                        {s.title}
                      </p>
                      <p className="text-sm text-ink leading-relaxed whitespace-pre-line">
                        {s.body}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          {week.parent_prompt && (
            <div className="mt-5 p-4 rounded-xl bg-chip-amber/60 border border-gold-200/60">
              <p className="text-xs font-bold uppercase tracking-wider text-gold-800 mb-1">
                This week&apos;s prompt
              </p>
              <p className="text-sm text-ink leading-relaxed">
                {week.parent_prompt}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="paper-card p-6">
          <p className="text-sm text-soft">
            This week&apos;s content is being prepared. The evergreen guidance
            below always applies.
          </p>
        </div>
      )}

      {/* Evergreen guidance */}
      <div>
        <h2 className="font-display text-lg font-semibold text-ink mb-3">
          Always-on guidance
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {EVERGREEN.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="paper-card p-5">
                <div className="w-9 h-9 rounded-lg bg-gold-400/15 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-gold-700" />
                </div>
                <h3 className="font-display font-semibold text-ink mb-1">
                  {s.title}
                </h3>
                <p className="text-sm text-soft leading-relaxed">{s.body}</p>
              </div>
            );
          })}
          <div className="paper-card p-5 flex flex-col justify-center">
            <div className="w-9 h-9 rounded-lg bg-gold-400/15 flex items-center justify-center mb-3">
              <MessageCircle className="w-5 h-5 text-gold-700" />
            </div>
            <h3 className="font-display font-semibold text-ink mb-1">
              Talk it out with other parents
            </h3>
            <p className="text-sm text-soft leading-relaxed mb-2">
              Other families are learning alongside you. Swap questions and wins
              in the community.
            </p>
            <Link
              href="/community"
              className="text-sm font-medium text-gold-700 hover:text-gold-800"
            >
              Open community →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
