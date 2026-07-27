"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { m } from "@/lib/motion";
import {
  BookHeart,
  Lock,
  ShieldAlert,
  Sparkles,
  TimerReset,
  Trophy,
  Utensils,
  Lightbulb,
  Ban,
  ChevronRight,
  Mail,
  BookOpen,
  MessagesSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentFicWeek, type FicWeek } from "@/lib/fic";
import Avatar from "@/components/Avatar";
import {
  PageIntro,
  EditorialSection,
  ObjectCard,
  StatusChip,
} from "@/components/grammar";
import {
  familyInsight,
  type FamilyInsight,
  type MasteryRow,
  type SkillRow,
} from "@/lib/family/insight";

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

/** One child's weekly report — the deterministic insight + identity. */
interface ChildReport {
  id: string;
  display_name: string;
  avatar_url: string | null;
  age_group: string | null;
  insight: FamilyInsight;
}

export default function ParentCornerPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isParent, setIsParent] = useState(false);
  const [week, setWeek] = useState<FicWeek | null>(null);
  const [reports, setReports] = useState<ChildReport[]>([]);

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
        const w = await getCurrentFicWeek(supabase);
        setWeek(w);
        if (profile?.family_id) {
          void loadReports(profile.family_id, w).catch(() => {});
        }
      }
      setLoading(false);
    }

    // Per-child weekly report — DETERMINISTIC, no LLM. One batched read of the
    // roster + every kid's skill_mastery + the skills graph, then the insight
    // (ahead-on / behind-on + starters + strengths) is computed in memory.
    async function loadReports(familyId: string, w: FicWeek | null) {
      const { data: roster } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, age_group, role")
        .eq("family_id", familyId);
      const kids = (roster || []).filter((m) => m.role === "child");
      if (kids.length === 0) return;
      const kidIds = kids.map((k) => k.id);

      const [masteryRes, skillsRes] = await Promise.all([
        supabase
          .from("skill_mastery")
          .select("user_id, skill_id, mastery_score, attempts")
          .in("user_id", kidIds),
        supabase.from("skills").select("id, domain"),
      ]);

      const skills = (skillsRes.data || []) as SkillRow[];
      const masteryByKid: Record<string, MasteryRow[]> = {};
      (masteryRes.data || []).forEach(
        (r: MasteryRow & { user_id: string }) => {
          (masteryByKid[r.user_id] ||= []).push({
            skill_id: r.skill_id,
            mastery_score: r.mastery_score,
            attempts: r.attempts,
          });
        }
      );

      // Fallback conversation starters from the week's dinner questions.
      const fallback = (w?.parent_dinner_questions || "")
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean);

      setReports(
        kids.map((k) => {
          const name = (k.display_name || "Member").split(" ")[0];
          return {
            id: k.id,
            display_name: k.display_name || "Member",
            avatar_url: k.avatar_url,
            age_group: k.age_group,
            insight: familyInsight(
              name,
              masteryByKid[k.id] || [],
              skills,
              fallback
            ),
          };
        })
      );
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
        <div className="h-9 w-56 rounded-lg bg-sand/60" />
        <div className="h-48 rounded-2xl bg-sand/40" />
        <div className="h-40 rounded-2xl bg-sand/40" />
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

  // The single primary child's starters lead the CONVERSATION STARTERS block;
  // with multiple kids each report carries its own weakest-domain starters.
  const leadStarters =
    reports[0]?.insight.starters ??
    (week?.parent_dinner_questions || "")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 3);

  const parentSections: {
    icon: React.ElementType;
    title: string;
    body: string | null;
  }[] = week
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
        { icon: Ban, title: "What not to do", body: week.parent_what_not_to_do },
        {
          icon: ShieldAlert,
          title: "The risk talk",
          body: week.parent_risk_talk,
        },
        { icon: TimerReset, title: "On patience", body: week.parent_patience },
      ].filter((s) => s.body)
    : [];

  const FOR_YOU = [
    { icon: BookOpen, label: "Parent & teacher guide", href: "/parent-corner/guide" },
    { icon: MessagesSquare, label: "Lesson plans pack", href: "/learn" },
    { icon: MessagesSquare, label: "Ask a coach", href: "/community" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-16">
      <PageIntro
        eyebrow="Parent corner"
        title="What to say, and when to say it"
        context="You don’t need to be a market expert to lead this at home. Each week we hand you the conversation — what your kids learned, and how to talk about it."
      />

      {/* WEEKLY REPORT · READY — the signature deterministic insight, one card
          per child. The headline + body + strengths are computed from
          skill_mastery with zero LLM (lib/family/insight). */}
      {reports.length > 0 && (
        <EditorialSection
          title="Weekly report"
          lead="Derived from each child’s practice this week — no guesswork."
        >
          <div className="space-y-3">
            {reports.map((r, i) => {
              const strong = r.insight.strengths[0];
              const weak =
                r.insight.strengths[r.insight.strengths.length - 1];
              return (
                <m.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ObjectCard accent="accent" className="p-5">
                    <div className="flex items-start gap-3">
                      <Avatar
                        name={r.display_name}
                        avatarUrl={r.avatar_url}
                        role="child"
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <StatusChip tone="accent" pulse={r.insight.hasSignal}>
                            {r.insight.hasSignal ? "Report ready" : "Warming up"}
                          </StatusChip>
                        </div>
                        <h3 className="font-display text-[17px] font-bold leading-snug text-ink">
                          {r.insight.headline}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-soft">
                          {r.insight.body}
                        </p>

                        {/* Strengths bars — same skill_mastery source as the
                            kid Progress screen (spec artboard 08). */}
                        {r.insight.hasSignal &&
                          strong &&
                          weak &&
                          r.insight.strengths.length > 0 && (
                            <div className="mt-4 space-y-2">
                              {r.insight.strengths.slice(0, 3).map((s) => (
                                <div
                                  key={s.domain}
                                  className="flex items-center gap-3"
                                >
                                  <span className="w-28 shrink-0 text-xs text-soft">
                                    {s.label}
                                  </span>
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
                                    <m.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${s.score}%` }}
                                      transition={{
                                        duration: 0.7,
                                        ease: "easeOut",
                                      }}
                                      className="h-full rounded-full bg-[var(--accent-solid)]"
                                    />
                                  </div>
                                  <span className="w-9 shrink-0 text-right text-xs font-semibold text-ink tabular-nums">
                                    {s.score}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                        <div className="mt-4 flex items-center gap-4">
                          <Link
                            href="/progress"
                            className="text-sm font-semibold text-gold-700 hover:text-gold-800"
                          >
                            Read report →
                          </Link>
                          <a
                            href={`mailto:?subject=${encodeURIComponent(
                              `${r.display_name}'s weekly report`
                            )}&body=${encodeURIComponent(
                              `${r.insight.headline}. ${r.insight.body}`
                            )}`}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-soft hover:text-ink"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            Email me
                          </a>
                        </div>
                      </div>
                    </div>
                  </ObjectCard>
                </m.div>
              );
            })}
          </div>
        </EditorialSection>
      )}

      {/* CONVERSATION STARTERS — spec artboard 07. Keyed to the child's weakest
          domain (deterministic), falling back to the week's dinner questions. */}
      {leadStarters && leadStarters.length > 0 && (
        <EditorialSection
          title="Conversation starters"
          lead="Three questions to ask at dinner this week."
        >
          <div className="space-y-2.5">
            {leadStarters.slice(0, 3).map((q, i) => (
              <div
                key={i}
                className="flex gap-3 border-l-[3px] border-[var(--accent-solid)] pl-4"
              >
                <p className="text-[15px] leading-relaxed text-ink">{q}</p>
              </div>
            ))}
          </div>
        </EditorialSection>
      )}

      {/* This week's parent content — preserved data flow, restyled. */}
      {week && parentSections.length > 0 && (
        <EditorialSection
          title={`This week: ${week.class_title}`}
          lead={
            week.company_name
              ? `${week.company_name}${
                  week.company_ticker ? ` · ${week.company_ticker}` : ""
                }`
              : undefined
          }
        >
          <div className="space-y-5">
            {parentSections.map((s, i) => {
              const Icon = s.icon;
              return (
                <m.div
                  key={s.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex gap-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-400/15">
                    <Icon className="h-[18px] w-[18px] text-gold-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="mb-0.5 text-xs font-bold uppercase tracking-wider text-soft">
                      {s.title}
                    </p>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
                      {s.body}
                    </p>
                  </div>
                </m.div>
              );
            })}
          </div>
          {week.parent_prompt && (
            <div className="mt-5 rounded-xl border border-gold-200/60 bg-chip-amber/60 p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gold-800">
                This week’s prompt
              </p>
              <p className="text-sm leading-relaxed text-ink">
                {week.parent_prompt}
              </p>
            </div>
          )}
        </EditorialSection>
      )}

      {/* FOR YOU — spec artboard 07 link list. */}
      <EditorialSection title="For you">
        <div className="divide-y divide-sand">
          {FOR_YOU.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.label}
                href={l.href}
                className="group flex items-center gap-3 py-3.5"
              >
                <Icon className="h-[18px] w-[18px] text-gold-600" />
                <span className="flex-1 text-[15px] text-ink group-hover:text-gold-800">
                  {l.label}
                </span>
                <ChevronRight className="h-4 w-4 text-soft transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </EditorialSection>

      {/* Always-on guidance — evergreen, preserved. */}
      <EditorialSection title="Always-on guidance" divide>
        <div className="grid gap-3 sm:grid-cols-2">
          {EVERGREEN.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="paper-card p-5">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gold-400/15">
                  <Icon className="h-5 w-5 text-gold-700" />
                </div>
                <h3 className="mb-1 font-display font-semibold text-ink">
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed text-soft">{s.body}</p>
              </div>
            );
          })}
        </div>
      </EditorialSection>
    </div>
  );
}
