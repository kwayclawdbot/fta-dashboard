"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Check,
  Sparkles,
  Trophy,
  ChevronRight,
  PartyPopper,
  Lightbulb,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { awardXp, hasXpForRef } from "@/lib/xp";

interface Mission {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kid_prompt: string | null;
  xp_reward: number;
  sort: number;
}

interface Completion {
  mission_id: string;
  evidence: string | null;
  completed_at: string;
}

const BRAND_DETECTIVE_GOAL = 5;

// Playful accent per mission (title-card energy, not homework).
const ACCENTS = [
  "from-gold-300 to-gold-500",
  "from-sky-300 to-sky-500",
  "from-green-300 to-green-500",
  "from-purple-300 to-purple-500",
  "from-rose-300 to-rose-500",
];

export default function MissionsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [isKid, setIsKid] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [completions, setCompletions] = useState<Record<string, Completion>>({});
  const [championedCount, setChampionedCount] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, age_group, family_id")
      .eq("id", user.id)
      .single();
    setFamilyId(profile?.family_id ?? null);
    setIsKid(profile?.age_group === "kids" || profile?.role === "child");

    const { data: missionRows } = await supabase
      .from("fic_missions")
      .select("id, slug, title, description, kid_prompt, xp_reward, sort")
      .order("sort");
    const list = (missionRows as Mission[]) || [];
    setMissions(list);

    const { data: compRows } = await supabase
      .from("mission_completions")
      .select("mission_id, evidence, completed_at")
      .eq("user_id", user.id);
    const compMap: Record<string, Completion> = {};
    for (const c of (compRows as Completion[]) || []) compMap[c.mission_id] = c;

    // Brand Detective auto-detect: companies THIS user has championed.
    const { count: championed } = await supabase
      .from("family_watchlist")
      .select("id", { count: "exact", head: true })
      .eq("champion_id", user.id);
    setChampionedCount(championed || 0);

    // Auto-complete Brand Detective when the 5-add goal is met.
    const brand = list.find((m) => m.slug === "brand-detective");
    if (
      brand &&
      (championed || 0) >= BRAND_DETECTIVE_GOAL &&
      !compMap[brand.id]
    ) {
      const { error } = await supabase.from("mission_completions").insert({
        mission_id: brand.id,
        user_id: user.id,
        family_id: profile?.family_id ?? null,
        evidence: `Added ${championed} companies to the family watchlist.`,
      });
      if (!error) {
        const already = await hasXpForRef(
          supabase,
          user.id,
          "bonus",
          `mission:${brand.id}`
        );
        if (!already) {
          await awardXp(
            supabase,
            user.id,
            "bonus",
            brand.xp_reward,
            `mission:${brand.id}`
          );
        }
        compMap[brand.id] = {
          mission_id: brand.id,
          evidence: `Added ${championed} companies to the family watchlist.`,
          completed_at: new Date().toISOString(),
        };
      }
    }

    setCompletions(compMap);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function completeMission(m: Mission) {
    if (busy || completions[m.id]) return;
    setBusy(true);
    const ev = evidence.trim();
    const { error } = await supabase.from("mission_completions").insert({
      mission_id: m.id,
      user_id: userId,
      family_id: familyId,
      evidence: ev || null,
    });
    if (!error) {
      const already = await hasXpForRef(
        supabase,
        userId,
        "bonus",
        `mission:${m.id}`
      );
      if (!already) {
        await awardXp(supabase, userId, "bonus", m.xp_reward, `mission:${m.id}`);
      }
      setCompletions((prev) => ({
        ...prev,
        [m.id]: {
          mission_id: m.id,
          evidence: ev || null,
          completed_at: new Date().toISOString(),
        },
      }));
      setJustCompleted(m.id);
      setOpenId(null);
      setEvidence("");
      setTimeout(() => setJustCompleted(null), 2600);
    }
    setBusy(false);
  }

  const doneCount = Object.keys(completions).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip-amber text-gold-700">
              <Compass className="h-5 w-5" />
            </div>
            <h1 className="font-display text-2xl font-bold text-ink">
              Kid Missions
            </h1>
          </div>
          <p className="text-sm text-soft">
            {isKid
              ? "Little quests that turn you into an investor. Pick one and go!"
              : "Playful quests for your kids — do them together to spark real conversations."}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-sand bg-white px-4 py-2.5 shadow-soft">
          <Trophy className="h-4 w-4 text-gold-500" />
          <span className="font-display text-lg font-bold text-ink">
            {doneCount}
          </span>
          <span className="text-sm text-soft">/ {missions.length} done</span>
        </div>
      </motion.div>

      {/* Mission cards */}
      <div className="space-y-5">
        {missions.map((m, i) => {
          const done = !!completions[m.id];
          const isBrand = m.slug === "brand-detective";
          const brandPct = Math.min(
            100,
            Math.round((championedCount / BRAND_DETECTIVE_GOAL) * 100)
          );
          const accent = ACCENTS[i % ACCENTS.length];
          const open = openId === m.id;

          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className={`relative overflow-hidden rounded-2xl border shadow-soft transition-colors ${
                done
                  ? "border-green-500/30 bg-green-500/[0.04]"
                  : "border-sand bg-white"
              }`}
            >
              {/* Accent banner (title-card energy) */}
              <div
                className={`flex items-center justify-between bg-gradient-to-r ${accent} px-5 py-2.5`}
              >
                <span className="font-display text-xs font-bold uppercase tracking-wide text-white/95">
                  Mission {i + 1}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-0.5 font-display text-xs font-bold text-white backdrop-blur">
                  <Sparkles className="h-3 w-3" />
                  {m.xp_reward} XP
                </span>
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-bold text-ink">
                    {m.title}
                  </h2>
                  {done && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-600">
                      <Check className="h-3.5 w-3.5" />
                      Completed
                    </span>
                  )}
                </div>

                {/* The kid-voiced ask — the hero line */}
                <p className="mt-2 text-[15px] leading-relaxed text-midnight-200">
                  {m.kid_prompt || m.description}
                </p>

                {/* Grown-up helper (shown to parents) */}
                {!isKid && m.description && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-soft">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
                    {m.description}
                  </p>
                )}

                {/* Brand Detective: auto progress from watchlist adds */}
                {isBrand && !done && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-soft">
                        {championedCount} / {BRAND_DETECTIVE_GOAL} companies added
                      </span>
                      <Link
                        href="/watchlist"
                        className="font-medium text-gold-700 hover:text-gold-800"
                      >
                        Add companies →
                      </Link>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-sand">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${brandPct}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className="h-full rounded-full bg-gold-500"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-soft">
                      Auto-completes when you add {BRAND_DETECTIVE_GOAL}{" "}
                      companies to the Family Watchlist.
                    </p>
                  </div>
                )}

                {/* Completed evidence */}
                {done && completions[m.id].evidence && (
                  <div className="mt-3 rounded-lg border border-green-500/20 bg-white p-3">
                    <p className="text-xs font-semibold text-green-600">
                      What you found
                    </p>
                    <p className="mt-0.5 text-sm text-midnight-200">
                      {completions[m.id].evidence}
                    </p>
                  </div>
                )}

                {/* Action row (non-brand, not done) */}
                {!done && !isBrand && (
                  <div className="mt-4">
                    <AnimatePresence initial={false}>
                      {open ? (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <label className="text-xs font-medium text-soft">
                            What did you find?{" "}
                            <span className="text-midnight-500">(optional)</span>
                          </label>
                          <textarea
                            value={evidence}
                            onChange={(e) => setEvidence(e.target.value)}
                            rows={2}
                            placeholder="Tell us in your own words..."
                            className="mt-1 w-full resize-none rounded-lg border border-sand bg-white p-3 text-sm text-ink placeholder:text-midnight-500 focus:border-gold-400 focus:outline-none"
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => completeMission(m)}
                              disabled={busy}
                              className="cta-button inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm disabled:opacity-60"
                            >
                              <Check className="h-4 w-4" />
                              Mark complete (+{m.xp_reward} XP)
                            </button>
                            <button
                              onClick={() => {
                                setOpenId(null);
                                setEvidence("");
                              }}
                              className="rounded-lg px-3 py-2 text-sm font-medium text-soft hover:text-ink"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <button
                          onClick={() => {
                            setOpenId(m.id);
                            setEvidence("");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gold-300 bg-chip-amber px-4 py-2 text-sm font-semibold text-gold-700 transition-colors hover:bg-gold-100"
                        >
                          Start this mission
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Celebration flash */}
              <AnimatePresence>
                {justCompleted === m.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm"
                  >
                    <div className="flex flex-col items-center gap-2 text-center">
                      <PartyPopper className="h-10 w-10 text-gold-500" />
                      <p className="font-display text-lg font-bold text-ink">
                        +{m.xp_reward} XP!
                      </p>
                      <p className="text-sm text-soft">Mission complete</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {missions.length === 0 && (
        <p className="py-10 text-center text-sm text-soft">
          No missions yet — check back soon.
        </p>
      )}
    </div>
  );
}
