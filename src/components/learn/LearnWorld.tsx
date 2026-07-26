"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Map as MapIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, LOAD_TIMEOUT_MS } from "@/lib/async";
import { getUserXp, awardXp, hasXpForRef, XP } from "@/lib/xp";
import { dailyFiveCount } from "@/lib/flashcards";
import { getCurrentFicWeek, type FicWeek } from "@/lib/fic";
import { deriveRegister, celebrateRegister, type Register } from "@/lib/register";
import {
  buildJourney,
  loadDailyState,
  loadInvestorBrain,
  type DailyState,
  type BrainSkill,
} from "@/lib/learn/journey";
import type { Journey } from "@/lib/learn/worlds";
import Celebrate, {
  useSoundOptIn,
  type CelebrateOptions,
} from "@/components/fic/Celebrate";
import StreakHeader from "@/components/learn/journey/StreakHeader";
import ContinueYourPath from "@/components/learn/journey/ContinueYourPath";
import TodaysGoal from "@/components/learn/journey/TodaysGoal";
import TodaysReview from "@/components/learn/journey/TodaysReview";
import WeeklyChallenge from "@/components/learn/journey/WeeklyChallenge";
import InvestorBrain from "@/components/learn/journey/InvestorBrain";
import JourneyMap from "@/components/learn/journey/JourneyMap";

/**
 * LearnWorld — the Learn Home (FIC-LEARNING-WORLD §3). Composes the streak
 * header, continue-your-path object, today's goal (1 Learn · 1 Practice · 1
 * Apply), today's review, the weekly world-event slot, the investor-brain bars,
 * and the vertical journey map — all from real, preserved state. Register-scaled
 * (adult editorial / teen game-like / kid bright), reduced-motion safe.
 *
 * Owns the habit loop's reward: when the daily goal hits 3/3, it awards a
 * once-per-day bonus (deduped by xp_events ref) and fires a register-scaled
 * celebration. XP is never derived from simulator returns.
 */
export default function LearnWorld() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [register, setRegister] = useState<Register>("adult");
  const [xp, setXp] = useState(0);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [daily, setDaily] = useState<DailyState | null>(null);
  const [brain, setBrain] = useState<BrainSkill[]>([]);
  const [week, setWeek] = useState<FicWeek | null>(null);
  const [dueReviews, setDueReviews] = useState(0);
  const [soundOn] = useSoundOptIn();
  const [celebrate, setCelebrate] = useState<CelebrateOptions | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (alive) setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, age_group, track, family_id")
          .eq("id", user.id)
          .single();

        const reg = deriveRegister(profile);
        const track = profile?.age_group || profile?.track || "adults";
        const familyId = profile?.family_id ?? null;

        const [xpTotal, reviewsDue, ficWeek, brainSkills] = await Promise.all([
          withTimeout(getUserXp(supabase, user.id), LOAD_TIMEOUT_MS, 0),
          withTimeout(dailyFiveCount(supabase, user.id, track), LOAD_TIMEOUT_MS, 0),
          withTimeout(getCurrentFicWeek(supabase), LOAD_TIMEOUT_MS, null),
          withTimeout(loadInvestorBrain(supabase, user.id), LOAD_TIMEOUT_MS, []),
        ]);

        const j = await withTimeout(
          buildJourney(supabase, { userId: user.id, track, dueReviews: reviewsDue }),
          LOAD_TIMEOUT_MS,
          {
            worlds: [],
            current: null,
            currentWorldIndex: 0,
            totalLessons: 0,
            doneLessons: 0,
            pct: 0,
            courseSlug: null,
          } as Journey
        );

        const ds = await withTimeout(
          loadDailyState(supabase, user.id, {
            familyId,
            nextLessonHref: j.current?.href ?? null,
          }),
          LOAD_TIMEOUT_MS,
          null
        );

        if (!alive) return;
        setRegister(reg);
        setXp(xpTotal);
        setBrain(brainSkills);
        setWeek(ficWeek);
        setDueReviews(reviewsDue);
        setJourney(j);
        setDaily(ds);
        setLoading(false);

        // 3/3 daily-goal bonus — awarded once per day (deduped by ref), then
        // celebrated register-scaled. Best-effort; never blocks the UI.
        if (ds?.allDone) {
          const already = await hasXpForRef(
            supabase,
            user.id,
            "bonus",
            ds.bonusRef
          );
          if (!already && alive) {
            await awardXp(supabase, user.id, "bonus", 20, ds.bonusRef);
            setXp((x) => x + 20);
            setCelebrate({
              variant: "mission",
              register: celebrateRegister(reg),
              title: reg === "kid" ? "Daily goal done!" : "Daily goal complete",
              subtitle: "1 Learn · 1 Practice · 1 Apply",
              xp: 20,
              sound: soundOn && reg !== "adult",
            });
          }
        }
      } catch {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl animate-pulse space-y-6 pb-16">
        <div className="h-16 w-full rounded-2xl bg-sand/50" />
        <div className="h-24 w-full rounded-2xl bg-sand/40" />
        <div className="h-20 w-full rounded-2xl bg-sand/40" />
        <div className="h-64 w-full rounded-2xl bg-sand/30" />
      </div>
    );
  }

  const hasJourney = (journey?.totalLessons ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <Celebrate opts={celebrate} onDone={() => setCelebrate(null)} />

      <StreakHeader register={register} xp={xp} streakDays={daily?.streakDays ?? 0} />

      {journey && hasJourney && (
        <ContinueYourPath journey={journey} register={register} />
      )}

      {daily && (
        <TodaysGoal
          items={daily.items}
          completedCount={daily.completedCount}
          register={register}
        />
      )}

      <TodaysReview dueCount={dueReviews} register={register} />

      <WeeklyChallenge week={week} register={register} />

      <InvestorBrain skills={brain} register={register} />

      {/* The journey map */}
      {hasJourney ? (
        <section id="map" className="scroll-mt-20">
          <div className="mb-5 flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-[var(--accent-strong)]" />
            <h2 className="font-display text-[20px] font-bold tracking-tight text-ink sm:text-[22px]">
              {register === "kid" ? "Your map" : "Your journey"}
            </h2>
          </div>
          {journey && <JourneyMap journey={journey} register={register} />}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-sand bg-paper p-8 text-center">
          <h2 className="font-display text-lg font-bold text-ink">
            {register === "kid"
              ? "Your adventures are on the way!"
              : "Your journey is being prepared"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-soft">
            Foundation lessons for your track will appear here as soon as they&apos;re
            published.
          </p>
        </section>
      )}

      {/* Course catalog demoted under Explore curriculum */}
      <div className="border-t border-sand pt-6">
        <Link
          href="/learn/catalog"
          className="group inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)]"
        >
          Explore the full curriculum
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
        </Link>
      </div>
    </div>
  );
}
