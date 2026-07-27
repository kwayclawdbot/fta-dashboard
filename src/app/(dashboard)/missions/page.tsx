"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { m as mm, AnimatePresence } from "@/lib/motion";
import {
  Compass,
  Check,
  Sparkles,
  Trophy,
  ChevronRight,
  Lightbulb,
  Volume2,
  VolumeX,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { awardXp, hasXpForRef } from "@/lib/xp";
import { beltCelebrateFields } from "@/lib/belts";
import MissionEmblem from "@/components/fic/MissionEmblem";
import Celebrate, {
  useSoundOptIn,
  type CelebrateOptions,
  type Register,
} from "@/components/fic/Celebrate";
import { EmptyMissions } from "@/components/fic/EmptyState";
import { deriveRegister, celebrateRegister } from "@/lib/register";

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
const EMBLEM_SRC: Record<string, string> = {
  "brand-detective": "/missions/brand-detective.webp",
  "snack-stock": "/missions/snack-stock.webp",
  "money-machine": "/missions/money-machine.webp",
  "stock-vs-product": "/missions/stock-vs-product.webp",
  "family-ceo": "/missions/family-ceo.webp",
};

export default function MissionsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [isKid, setIsKid] = useState(false);
  const [register, setRegister] = useState<Register>("kid");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [completions, setCompletions] = useState<Record<string, Completion>>({});
  const [championedCount, setChampionedCount] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [xp, setXp] = useState(0);
  const [queue, setQueue] = useState<CelebrateOptions[]>([]);
  const [soundOn, toggleSound] = useSoundOptIn();

  const enqueue = useCallback((o: CelebrateOptions) => setQueue((q) => [...q, o]), []);

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    // One aggregate round trip: profile + missions + this user's completions +
    // championed count + lifetime XP (was 5 sequential queries).
    const { data: stateRaw } = await supabase.rpc("get_missions_state");
    const state = (stateRaw || {}) as {
      role?: string;
      age_group?: string;
      family_id?: string | null;
      xp?: number;
      championed?: number;
      missions?: Mission[];
      completions?: Completion[];
    };

    setFamilyId(state.family_id ?? null);
    // Single source of truth: age_group wins, role only disambiguates legacy
    // rows. A teen (age_group='teens') is never treated as a kid here, so the
    // baby-talk copy + sound toggle never leak to teens (audit #5).
    const reg = deriveRegister({ role: state.role, age_group: state.age_group });
    setIsKid(reg === "kid");
    setRegister(celebrateRegister(reg));

    const list = state.missions || [];
    setMissions(list);

    const compMap: Record<string, Completion> = {};
    for (const c of state.completions || []) compMap[c.mission_id] = c;
    setCompletions(compMap);

    const championed = state.championed || 0;
    setChampionedCount(championed);
    setXp(state.xp || 0);
    setLoading(false); // paint now — the initial data is one round trip in

    // Deferred (post-paint): auto-complete Brand Detective when the 5-add goal
    // is met. Rare write; must never block first content.
    const brand = list.find((m) => m.slug === "brand-detective");
    if (brand && championed >= BRAND_DETECTIVE_GOAL && !compMap[brand.id]) {
      const { error } = await supabase.from("mission_completions").insert({
        mission_id: brand.id,
        user_id: user.id,
        family_id: state.family_id ?? null,
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
        setCompletions((prev) => ({
          ...prev,
          [brand.id]: {
            mission_id: brand.id,
            evidence: `Added ${championed} companies to the family watchlist.`,
            completed_at: new Date().toISOString(),
          },
        }));
      }
    }
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
      const prevXp = xp;
      let newXp = xp;
      const already = await hasXpForRef(supabase, userId, "bonus", `mission:${m.id}`);
      if (!already) {
        await awardXp(supabase, userId, "bonus", m.xp_reward, `mission:${m.id}`);
        newXp = xp + m.xp_reward;
        setXp(newXp);
      }
      setCompletions((prev) => ({
        ...prev,
        [m.id]: {
          mission_id: m.id,
          evidence: ev || null,
          completed_at: new Date().toISOString(),
        },
      }));
      setOpenId(null);
      setEvidence("");

      // Register-correct celebration: emblem stamp + confetti + XP (kid sound opt-in).
      enqueue({
        variant: "mission",
        register,
        title: isKid ? "Nailed it!" : "Mission complete",
        subtitle: m.title,
        xp: already ? undefined : m.xp_reward,
        emblemSrc: EMBLEM_SRC[m.slug],
        sound: register === "kid" && soundOn,
      });

      // Belt ceremony if a level (= belt degree) was crossed.
      const belt = beltCelebrateFields(prevXp, newXp, isKid);
      if (belt) {
        enqueue({
          variant: "levelup",
          register,
          ...belt,
          sound: register === "kid" && soundOn,
        });
      }
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
      <Celebrate opts={queue[0] ?? null} onDone={() => setQueue((q) => q.slice(1))} />

      {/* Header */}
      <mm.div
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
              {register === "kid"
                ? "My Missions"
                : register === "teen"
                  ? "Missions"
                  : "Family Missions"}
            </h1>
          </div>
          <p className="text-sm text-soft">
            {register === "kid"
              ? "Little quests that turn you into an investor. Collect all the emblems!"
              : register === "teen"
                ? "Complete quests to earn XP and climb the ranks."
                : "Playful quests for your kids — do them together to spark real conversations."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isKid && (
            <button
              onClick={toggleSound}
              aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
              title={soundOn ? "Sound on" : "Sound off"}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-sand bg-card text-soft shadow-soft hover:text-ink"
            >
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-sand bg-card px-4 py-2.5 shadow-soft">
            <Trophy className="h-4 w-4 text-gold-500" />
            <span className="font-display text-lg font-bold text-ink">{doneCount}</span>
            <span className="text-sm text-soft">/ {missions.length} done</span>
          </div>
        </div>
      </mm.div>

      {/* Mission cards */}
      <div className="space-y-5">
        {missions.map((m, i) => {
          const done = !!completions[m.id];
          const isBrand = m.slug === "brand-detective";
          const brandPct = Math.min(
            100,
            Math.round((championedCount / BRAND_DETECTIVE_GOAL) * 100)
          );
          const open = openId === m.id;

          return (
            <mm.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className={`relative overflow-hidden rounded-2xl border p-5 shadow-soft transition-colors ${
                done ? "border-gold-400/40 bg-gold-50/40" : "border-sand bg-card"
              }`}
            >
              <div className="flex gap-4">
                {/* Bespoke mission emblem (collected state on complete) */}
                <MissionEmblem slug={m.slug} title={m.title} collected={done} size={76} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[11px] font-bold uppercase tracking-wide text-gold-700">
                      Mission {i + 1}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-chip-amber px-2 py-0.5 font-display text-[11px] font-bold text-gold-700">
                      <Sparkles className="h-3 w-3" />
                      {m.xp_reward} XP
                    </span>
                    {done && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-600">
                        <Check className="h-3 w-3" />
                        Collected
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 font-display text-xl font-bold text-ink">{m.title}</h2>

                  {/* The kid-voiced ask — the hero line */}
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink">
                    {m.kid_prompt || m.description}
                  </p>

                  {/* Grown-up helper (shown to parents only, never to teens) */}
                  {register === "parent" && m.description && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-soft">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
                      {m.description}
                    </p>
                  )}
                </div>
              </div>

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
                    <mm.div
                      initial={{ width: 0 }}
                      animate={{ width: `${brandPct}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className="h-full rounded-full bg-gold-500"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-soft">
                    Auto-completes when you add {BRAND_DETECTIVE_GOAL} companies to the
                    Family Watchlist.
                  </p>
                </div>
              )}

              {/* Completed evidence */}
              {done && completions[m.id].evidence && (
                <div className="mt-3 rounded-lg border border-green-500/20 bg-card p-3">
                  <p className="text-xs font-semibold text-green-600">What you found</p>
                  <p className="mt-0.5 text-sm text-ink">
                    {completions[m.id].evidence}
                  </p>
                </div>
              )}

              {/* Action row (non-brand, not done) */}
              {!done && !isBrand && (
                <div className="mt-4">
                  <AnimatePresence initial={false}>
                    {open ? (
                      <mm.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <label className="text-xs font-medium text-soft">
                          What did you find?{" "}
                          <span className="text-soft">(optional)</span>
                        </label>
                        <textarea
                          value={evidence}
                          onChange={(e) => setEvidence(e.target.value)}
                          rows={2}
                          placeholder="Tell us in your own words..."
                          className="mt-1 w-full resize-none rounded-lg border border-sand bg-card p-3 text-sm text-ink placeholder:text-soft focus:border-gold-400 focus:outline-none"
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
                      </mm.div>
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
            </mm.div>
          );
        })}
      </div>

      {missions.length === 0 && <EmptyMissions />}
    </div>
  );
}
