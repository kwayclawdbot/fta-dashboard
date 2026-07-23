"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  Compass,
  Flame,
  PlayCircle,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
  Layers,
  Gamepad2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { withTimeout, LOAD_TIMEOUT_MS } from "@/lib/async";
import { getUserXp, levelForXp } from "@/lib/xp";
import { dailyFiveCount } from "@/lib/flashcards";
import {
  getCurrentFicWeek,
  getOrientationState,
  ORIENTATION_TOTAL,
  type FicWeek,
} from "@/lib/fic";
import ThisWeekPanel from "@/components/dashboard/ThisWeekPanel";
import Avatar from "@/components/Avatar";
import ClubActivityStrip from "@/components/community/ClubActivityStrip";
import FreeHome from "@/components/dashboard/FreeHome";
import FamilyProfileHome from "@/components/dashboard/FamilyProfileHome";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import { getFamilyTier } from "@/lib/tier";

/* ---------- types ---------- */

interface HomeToday {
  lesson_id: string;
  title: string;
  description: string | null;
  module_id: string;
  module_title: string;
  course_slug: string;
  course_title: string;
  week: number;
}

interface HomeExecLesson {
  id: string;
  title: string;
  description: string | null;
  has_quiz: boolean;
  completed: boolean;
}

interface HomeState {
  program: "fic" | "fta" | null;
  cohort?: string;
  week?: number;
  role?: string;
  track?: string;
  today: HomeToday | null;
  caught_up?: boolean;
  foundations_total?: number;
  foundations_done?: number;
  this_week: {
    module_id: string;
    title: string;
    description: string | null;
    lessons: HomeExecLesson[];
  } | null;
}

interface FamilyMember {
  id: string;
  display_name: string;
  role: string;
  age_group: string | null;
  avatar_url: string | null;
  completed: number;
  xp: number;
}

/* ---------- deck language ---------- */

const WEEK_CODENAMES: Record<number, string> = {
  1: "Who really moves the price",
  2: "Where the big money hides",
  3: "The bait & the grab",
  4: "The gaps price comes back to fill",
  5: "The opening bell play",
  6: "Run the whole playbook",
};

const HOUSE_RULES = [
  "Protect the money first",
  "Plans over feelings",
  "Practice before we play",
  "Small losses are wins",
  "We learn out loud",
];

function heroArt(track?: string, caughtUp?: boolean) {
  if (caughtUp) return "/art/saturday-story.jpg";
  if (track === "kids") return "/art/tug-of-war.jpg";
  if (track === "teens") return "/art/levelup-story.jpg";
  return "/art/fd-walkthrough.jpg";
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* ---------- page ---------- */

export default function DashboardHome() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [home, setHome] = useState<HomeState | null>(null);
  const [firstName, setFirstName] = useState("");
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [xp, setXp] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"home" | "week">("home");
  const [ficWeek, setFicWeek] = useState<FicWeek | null>(null);
  const [orientationDone, setOrientationDone] = useState(0);
  const [hasFamily, setHasFamily] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [isFree, setIsFree] = useState(false);

  useEffect(() => {
    setTab(searchParams.get("tab") === "this-week" ? "week" : "home");
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      // getSession() reads the cached session locally (no network round trip);
      // RLS still enforces every query server-side. The dashboard layout has
      // already validated the user server-side before this renders.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      // Round trip 1: everything that only needs the user id, in parallel.
      // (get_home_state, profile, current FIC week, and lifetime XP were four
      // sequential awaits before — none depend on each other.) Each is capped
      // by a timeout so one slow/hung call degrades instead of pinning the page
      // on an unbounded skeleton (audit: dashboard grey blocks for 6–11s).
      const [{ data: state }, { data: profile }, week, xpTotal] =
        await Promise.all([
          withTimeout<{ data: HomeState | null }>(
            supabase.rpc("get_home_state", { p_user_id: user.id }),
            LOAD_TIMEOUT_MS,
            { data: null }
          ),
          withTimeout<{
            data: { display_name: string; family_id: string | null; role: string } | null;
          }>(
            supabase
              .from("profiles")
              .select("display_name, family_id, role")
              .eq("id", user.id)
              .single(),
            LOAD_TIMEOUT_MS,
            { data: null }
          ),
          withTimeout(getCurrentFicWeek(supabase), LOAD_TIMEOUT_MS, null),
          withTimeout(getUserXp(supabase, user.id), LOAD_TIMEOUT_MS, 0),
        ]);

      const hs = state as HomeState;
      setHome(hs);
      setFirstName(profile?.display_name?.split(" ")[0] || "");
      setFicWeek(week);
      setXp(xpTotal);

      const famId = profile?.family_id ?? null;
      const track = hs?.track || "adults";
      setHasFamily(!!famId);
      setFamilyId(famId);

      // FREE tier gets a dedicated, limited home (the free-class hub + upsell).
      // Short-circuit before loading any member content. Timeout-guarded so a
      // slow tier lookup can't hang the first paint; on timeout we assume a
      // member home (the majority case) rather than freezing.
      const tier = await withTimeout(
        getFamilyTier(supabase, famId),
        LOAD_TIMEOUT_MS,
        "member" as Awaited<ReturnType<typeof getFamilyTier>>
      );
      if (tier === "free") {
        setFirstName(profile?.display_name?.split(" ")[0] || "");
        setIsFree(true);
        setLoading(false);
        return;
      }

      // First paint NOW — greeting + hero + This Week render from round-trip 1.
      // Everything below (daily-5 count, orientation progress, parent strip) is
      // secondary chrome that hydrates progressively into already-visible cards,
      // so it must not gate the page. Each call is timeout-capped.
      setLoading(false);

      dailyFiveCount(supabase, user.id, track).then(setDueCount).catch(() => {});

      if (famId) {
        void (async () => {
            // One fetch of the family roster serves both the orientation state
            // and the parent family strip (was two separate profile queries).
            const { data: allMembers } = await supabase
              .from("profiles")
              .select("id, display_name, role, age_group, avatar_url")
              .eq("family_id", famId);
            const roster = allMembers || [];
            const memberIds = roster.length
              ? roster.map((m) => m.id)
              : [user.id];

            const others = roster.filter((m) => m.id !== user.id);
            const isParent = profile?.role === "parent";

            const [orient, strip] = await Promise.all([
              getOrientationState(supabase, famId, memberIds),
              isParent && others.length
                ? Promise.all([
                    supabase
                      .from("lesson_progress")
                      .select("user_id")
                      .eq("status", "completed")
                      .in(
                        "user_id",
                        others.map((m) => m.id)
                      ),
                    supabase
                      .from("xp_events")
                      .select("user_id, amount")
                      .in(
                        "user_id",
                        others.map((m) => m.id)
                      ),
                  ])
                : Promise.resolve(null),
            ]);

            setOrientationDone(orient.completed.size);

            if (strip) {
              const [{ data: prog }, { data: xpRows }] = strip;
              const counts: Record<string, number> = {};
              (prog || []).forEach((r) => {
                counts[r.user_id] = (counts[r.user_id] || 0) + 1;
              });
              const xpByMember: Record<string, number> = {};
              (xpRows || []).forEach(
                (r: { user_id: string; amount: number }) => {
                  xpByMember[r.user_id] =
                    (xpByMember[r.user_id] || 0) + (r.amount || 0);
                }
              );
              setFamily(
                others.map((m) => ({
                  ...m,
                  completed: counts[m.id] || 0,
                  xp: xpByMember[m.id] || 0,
                }))
              );
            }
        })().catch(() => {});
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <DashboardSkeleton variant="default" />;
  }

  if (isFree) {
    return <FreeHome firstName={firstName} />;
  }

  const isKid = home?.role === "child" && home?.track === "kids";
  const isTeen = home?.role === "child" && home?.track === "teens";
  const isParent = !isKid && !isTeen;
  const level = levelForXp(xp);
  const orientationComplete = orientationDone >= ORIENTATION_TOTAL;
  const showStartHere = hasFamily && !orientationComplete;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Greeting */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1
            className={`font-display font-bold text-ink ${
              isKid ? "text-3xl" : "text-2xl"
            }`}
          >
            {isKid
              ? `Hey ${firstName || "Explorer"}!`
              : `${greeting()}, ${firstName || "there"}`}
          </h1>
          {home?.program === "fta" && home.week ? (
            <p className="text-soft mt-1">
              Week {home.week} of 6 —{" "}
              <span className="text-gold-700 font-medium">
                {WEEK_CODENAMES[home.week]}
              </span>
            </p>
          ) : (
            <p className="text-soft mt-1">
              {isKid
                ? "Ready for today's adventure?"
                : "Steady steps build the skill."}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isKid ? (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chip-amber text-gold-800 font-display font-bold">
              <Zap className="w-5 h-5" />
              Level {level.level} · {level.name}
              <span className="text-gold-700/80 font-body font-semibold">
                {xp} XP
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-midnight-900 border border-sand text-ink text-sm font-semibold">
              <Zap className="w-4 h-4 text-gold-500" />
              <span className="font-display">{level.name}</span>
              <span className="text-soft font-normal">{xp} XP</span>
            </span>
          )}
          {home?.cohort && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-chip-amber text-gold-800 text-xs font-semibold">
              <Flame className="w-3.5 h-3.5" />
              {home.cohort}
            </span>
          )}
        </div>
      </div>

      {/* Start Here — persistent until the family finishes orientation */}
      {showStartHere && (
        <Link href="/start-here" className="block" data-tour="start-here">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="paper-card p-5 flex items-center gap-4 hover:border-gold-400/50 transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
              <Compass className="w-6 h-6 text-gold-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-ink">
                Finish setting up your family
              </p>
              <p className="text-sm text-soft">
                {orientationDone} of {ORIENTATION_TOTAL} Start Here steps done —
                pick up where you left off.
              </p>
              <div className="w-full max-w-xs h-2 rounded-full bg-sand overflow-hidden mt-2">
                <div
                  className="h-full rounded-full bg-gold-500 transition-all"
                  style={{
                    width: `${Math.round((orientationDone / ORIENTATION_TOTAL) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gold-700 shrink-0" />
          </motion.div>
        </Link>
      )}

      {/* Family profile — backfill prompt or personalized "recommended next".
          Self-contained: renders null when there's nothing to show. Parents only. */}
      {isParent && hasFamily && familyId && (
        <FamilyProfileHome familyId={familyId} />
      )}

      {/* Home tabs: everyday home vs This Week in FIC */}
      <div className="flex items-center gap-1 border-b border-sand">
        {[
          { id: "home" as const, label: isKid ? "Home" : "Home" },
          { id: "week" as const, label: "This Week in FIC" },
        ].map((t) => (
          <button
            key={t.id}
            data-tour={t.id === "week" ? "thisweek-tab" : undefined}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? "text-gold-700 border-gold-500"
                : "text-soft border-transparent hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "week" && (
        <ThisWeekPanel
          week={ficWeek}
          isKid={isKid}
          isTeen={isTeen}
          isParent={isParent}
        />
      )}

      {tab === "home" && (
        <>

      {/* No program yet */}
      {!home?.program && (
        <div className="paper-card p-8 text-center">
          <Sparkles className="w-8 h-8 text-gold-500 mx-auto mb-3" />
          <h2 className="font-display text-xl font-semibold text-ink mb-2">
            Your family isn&apos;t enrolled yet
          </h2>
          <p className="text-soft max-w-md mx-auto mb-5">
            The Family Investing Club is where your family learns one money
            concept, studies one company, and builds the habit together every
            week. Want the deep end too? The FTA academy adds a 6-week live,
            beginner-to-trade-ready program on top.
          </p>
          <Link
            href="/upgrade"
            className="cta-button inline-flex items-center gap-2 px-6 py-3 rounded-xl"
          >
            See programs <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {home?.program && (
        <>
          {/* HERO — Today's one thing */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="paper-card overflow-hidden"
          >
            <div className="grid md:grid-cols-5">
              <div className="relative md:col-span-2 min-h-[200px] md:min-h-full">
                <Image
                  src={heroArt(home.track, home.caught_up)}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  className="object-cover"
                  priority
                />
              </div>
              <div className="md:col-span-3 p-6 lg:p-8 flex flex-col justify-center">
                {home.today ? (
                  <>
                    <span className="inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full bg-chip-sky text-sky-800 text-xs font-semibold mb-3">
                      <Target className="w-3.5 h-3.5" />
                      {isKid ? "Today's adventure" : "Today's one thing"}
                    </span>
                    <h2
                      className={`font-display font-bold text-ink leading-snug ${
                        isKid ? "text-2xl" : "text-xl lg:text-2xl"
                      }`}
                    >
                      {home.today.title}
                    </h2>
                    {home.today.description && (
                      <p className="text-soft mt-2 leading-relaxed">
                        {home.today.description}
                      </p>
                    )}
                    <p className="text-sm text-midnight-500 mt-3">
                      {home.today.module_title} · {home.today.course_title}
                    </p>
                    <div className="flex items-center gap-4 mt-5 flex-wrap">
                      <Link
                        href={`/courses/${home.today.course_slug}/${home.today.module_id}/${home.today.lesson_id}`}
                        className="cta-button inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm"
                      >
                        <PlayCircle className="w-4 h-4" />
                        {isKid ? "Start the adventure" : "Start lesson"}
                      </Link>
                      {typeof home.foundations_total === "number" &&
                        home.foundations_total > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-28 h-2 rounded-full bg-sand overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gold-500 transition-all"
                                style={{
                                  width: `${Math.round(
                                    ((home.foundations_done || 0) /
                                      home.foundations_total) *
                                      100
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-soft">
                              {home.foundations_done}/{home.foundations_total}{" "}
                              done
                            </span>
                          </div>
                        )}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full bg-chip-green text-green-600 text-xs font-semibold mb-3">
                      <Trophy className="w-3.5 h-3.5" />
                      All caught up
                    </span>
                    <h2 className="font-display text-2xl font-bold text-ink">
                      {isKid ? "You did it!" : "Foundations complete for now"}
                    </h2>
                    <p className="text-soft mt-2">
                      {isKid
                        ? "Every lesson is done. Practice your skills or show a grown-up what you learned."
                        : "Everything unlocked so far is finished. Sharpen up in the simulator, or review this week's drill before Saturday."}
                    </p>
                    <div className="flex gap-3 mt-5">
                      <Link
                        href="/simulator/lessons"
                        className="cta-button inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
                      >
                        <Target className="w-4 h-4" /> Practice patterns
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* THIS WEEK — live class + drill (academy execution rail) */}
          {home.this_week && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="paper-card p-6 lg:p-7"
            >
              <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                <h3 className="font-display text-lg font-semibold text-ink">
                  {home.this_week.title}
                </h3>
                <Link
                  href="/live-sessions"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-700 hover:text-gold-800"
                >
                  <CalendarDays className="w-4 h-4" />
                  Live classes
                </Link>
              </div>
              {home.this_week.description && (
                <p className="text-soft text-sm mb-4">
                  {home.this_week.description}
                </p>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                {home.this_week.lessons.map((l) => (
                  <div
                    key={l.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border ${
                      l.completed
                        ? "border-green-500/30 bg-chip-green/40"
                        : "border-sand bg-paper"
                    }`}
                  >
                    {l.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-midnight-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-ink text-sm">{l.title}</p>
                      {l.description && (
                        <p className="text-xs text-soft mt-1 leading-relaxed line-clamp-2">
                          {l.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Clubhouse activity — self-contained; renders null when empty */}
          <ClubActivityStrip />

          {/* Role strips */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Parent: family this week */}
            {isParent && family.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 }}
                className="paper-card p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-base font-semibold text-ink flex items-center gap-2">
                    <Users className="w-4 h-4 text-gold-600" />
                    Your family this week
                  </h3>
                  <Link
                    href="/family/overview"
                    className="text-sm font-medium text-gold-700 hover:text-gold-800"
                  >
                    Overview
                  </Link>
                </div>
                <div className="space-y-3">
                  {family.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <Avatar
                        name={m.display_name}
                        avatarUrl={m.avatar_url}
                        role={m.role}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">
                          {m.display_name}
                        </p>
                        <p className="text-xs text-soft capitalize">
                          {m.age_group || m.role} · {levelForXp(m.xp).name}
                        </p>
                      </div>
                      <span className="text-xs text-soft">
                        {m.completed} lesson{m.completed === 1 ? "" : "s"} done
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Kid: House Rules */}
            {isKid && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 }}
                className="paper-card p-6"
              >
                <h3 className="font-display text-base font-semibold text-ink flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-gold-600" />
                  Our House Rules
                </h3>
                <ol className="space-y-2.5">
                  {HOUSE_RULES.map((rule, i) => (
                    <li key={rule} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-chip-amber text-gold-800 text-xs font-bold flex items-center justify-center font-display shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-midnight-200">{rule}</span>
                    </li>
                  ))}
                </ol>
              </motion.div>
            )}

            {/* Everyone: quick links */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="paper-card p-6"
            >
              <h3 className="font-display text-base font-semibold text-ink mb-4">
                {isKid ? "More fun" : "Keep going"}
              </h3>
              <div className="space-y-2">
                <QuickLink
                  href="/flashcards"
                  icon={Layers}
                  label={isKid ? "Your 5 cards are waiting" : "Daily 5 flashcards"}
                  sub={
                    dueCount > 0
                      ? `${dueCount} card${dueCount === 1 ? "" : "s"} ready today`
                      : isKid
                        ? "Come back tomorrow for more"
                        : "All caught up for today"
                  }
                />
                <QuickLink
                  href="/games"
                  icon={Gamepad2}
                  label={isKid ? "Play a game" : "Practice games"}
                  sub="Trend or Trap and Candle Battle"
                />
                <QuickLink
                  href="/courses"
                  icon={BookOpen}
                  label={isKid ? "My lessons" : "All courses"}
                  sub={
                    isKid
                      ? "Stories and quests"
                      : "Foundations and the live program"
                  }
                />
                <QuickLink
                  href={isKid ? "/simulator/lessons" : "/simulator"}
                  icon={Target}
                  label={isKid ? "Pattern practice" : "Trading floor"}
                  sub={
                    isKid
                      ? "Spot the pattern, make the call"
                      : "Practice with pretend money"
                  }
                />
                <QuickLink
                  href="/progress"
                  icon={Trophy}
                  label={isKid ? "My badges" : "Progress & badges"}
                  sub={isKid ? "See what you've earned" : "Streaks, badges, stats"}
                />
              </div>
            </motion.div>
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  sub,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-paper border border-transparent hover:border-sand transition-colors group"
    >
      <div className="w-9 h-9 rounded-lg bg-gold-400/15 flex items-center justify-center shrink-0">
        <Icon className="w-[18px] h-[18px] text-gold-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-soft">{sub}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-midnight-600 group-hover:text-gold-700 transition-colors" />
    </Link>
  );
}
