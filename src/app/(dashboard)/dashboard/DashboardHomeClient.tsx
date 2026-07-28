"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
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
  Layers,
  Gamepad2,
  GraduationCap,
  Video,
  Radio,
  Film,
  Bell,
  X,
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
import BeltHeroStrip from "@/components/dashboard/BeltHeroStrip";
import ClubPulseMasthead from "@/components/dashboard/ClubPulseMasthead";
import ClubActivityStrip from "@/components/community/ClubActivityStrip";
import ClubHomeV2 from "@/components/clubhome/ClubHomeV2";
import FreeHome from "@/components/dashboard/FreeHome";
import FamilyProfileHome from "@/components/dashboard/FamilyProfileHome";
import AddFamily from "@/components/dashboard/AddFamily";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import TeenHomeRails from "@/components/family/TeenHomeRails";
import KidTodayHero from "@/components/family/KidTodayHero";
import { getFamilyTier } from "@/lib/tier";
import { isSoloProfile, deriveRegister, type Register } from "@/lib/register";
import { Meter, TabRail } from "@/components/f0/parts";

/** Next scheduled academy class, for the FTA premium home rail. */
type NextClass = { title: string; when: string } | null;

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

/* THE GREETING'S CLOCK. `greeting()` read `new Date().getHours()` and was
   invoked straight from JSX in two places — an impure read during render, and a
   hydration mismatch on any viewer whose part-of-day differs from the server's.
   HomeMasthead already took this fix; this is the same one, bucketed to the hour
   so the snapshot is stable between calls. `null` on the server and on the first
   client render, so both agree; the greeting fills in immediately after. */
const SUBSCRIBE = () => () => {};
const CLIENT_HOUR = () => new Date().getHours();
const SERVER_HOUR = () => null;

function greetingFor(h: number | null): string {
  if (h == null) return "Welcome";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* ---------- page ---------- */

export default function DashboardHomeClient() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  /** Viewer clock, hour-bucketed. See greetingFor above — never a bare
   *  `new Date()` in the render body. */
  const greetingHour = useSyncExternalStore(SUBSCRIBE, CLIENT_HOUR, SERVER_HOUR);
  const [home, setHome] = useState<HomeState | null>(null);
  const [firstName, setFirstName] = useState("");
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [xp, setXp] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // Deterministic fallback (visual audit repro): if round-1 resolution fails or
  // times out — no session, a thrown query, or the profile never resolving so no
  // persona branch can be chosen — we render a safe empty state instead of sitting
  // on the skeleton forever. A member must NEVER hang on an infinite skeleton.
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<"home" | "week">("home");
  const [ficWeek, setFicWeek] = useState<FicWeek | null>(null);
  const [orientationDone, setOrientationDone] = useState(0);
  const [hasFamily, setHasFamily] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  // The viewer's own id — the teen family rails need it to find THEIR bar in the
  // household standings and to know whether they have voted tonight.
  const [userId, setUserId] = useState("");
  const [isFree, setIsFree] = useState(false);
  // FTA premium home rail (audit #3): tier==='fta' families get a distinct
  // Academy module above the fold — next live academy class + 6-week program
  // pointer — so the $2,997 purchase is visible where they land. Kept to one
  // rail so it never takes over the club-first layout.
  const [isFta, setIsFta] = useState(false);
  // The family's PAID tier, kept separately from `home.program`. get_home_state
  // derives `program` from the `enrollments` table, but a Club family's
  // entitlement lives in `family_tiers` — a fic-tier household with no
  // enrollments row resolved to program:null and was told it wasn't enrolled.
  const [paidTier, setPaidTier] = useState<"free" | "fic" | "fta" | null>(null);
  const [ftaNextClass, setFtaNextClass] = useState<NextClass>(null);
  // Latest Kai briefing alert (Lane C6) — an adults-only home card. Null unless
  // an alert exists AND the viewer is a non-free adult (parent/admin).
  const [latestAlert, setLatestAlert] = useState<{
    ticker: string;
    direction: string;
    setup_label: string | null;
  } | null>(null);
  // Onboarding-prompt orchestration: whether the parent has dismissed the one
  // setup card (Start Here checklist). Persisted per family so it stays
  // dismissed, and it gates whether the profile-questions card may appear.
  const [setupDismissed, setSetupDismissed] = useState(false);
  // Lane 8A: the onboarding questionnaire must be prominent on FIRST login for
  // every entry path. When the family profile isn't completed yet (and the
  // parent hasn't dismissed the prompt twice), the "Tell us about your family"
  // card takes precedence OVER the setup checklist — the warm welcome comes
  // first. Once the profile is done it steps aside for the setup checklist.
  const [profileNeedsAttention, setProfileNeedsAttention] = useState(false);
  // Solo (individual, non-parent) member — a family of one. De-parents the Home
  // copy (setup card, empty state, This Week) without any data-model change.
  const [isSolo, setIsSolo] = useState(false);
  // Register (kid/teen/adult) for the club-first Home v2, and the active
  // 5-Day Challenge pass window for its high-priority challenge slot.
  const [register, setRegister] = useState<Register>("adult");
  const [soloChallengeExpiresAt, setSoloChallengeExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    setTab(searchParams.get("tab") === "this-week" ? "week" : "home");
  }, [searchParams]);

  // Last-resort watchdog: even if some await outside the per-call timeouts hangs,
  // never leave the member on the skeleton past this hard ceiling. Cleared the
  // instant `loading` flips false on any resolution path.
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      setLoadError(true);
      setLoading(false);
    }, LOAD_TIMEOUT_MS * 3);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (!familyId) return;
    try {
      setSetupDismissed(
        localStorage.getItem(`fta:setup-card-dismissed:${familyId}`) === "1"
      );
    } catch {
      /* private mode — leave it showing */
    }
  }, [familyId]);

  function dismissSetupCard() {
    setSetupDismissed(true);
    try {
      if (familyId)
        localStorage.setItem(`fta:setup-card-dismissed:${familyId}`, "1");
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    async function load() {
     try {
      // getSession() reads the cached session locally (no network round trip);
      // RLS still enforces every query server-side. The dashboard layout has
      // already validated the user server-side before this renders.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        // No client session (cache miss / expired) despite the server-side layout
        // guard — fall into the empty state rather than an infinite skeleton.
        setLoadError(true);
        return;
      }

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
            data: {
              display_name: string;
              family_id: string | null;
              role: string;
              age_group: string | null;
              track: string | null;
            } | null;
          }>(
            supabase
              .from("profiles")
              .select("display_name, family_id, role, age_group, track")
              .eq("id", user.id)
              .single(),
            LOAD_TIMEOUT_MS,
            { data: null }
          ),
          withTimeout(getCurrentFicWeek(supabase), LOAD_TIMEOUT_MS, null),
          withTimeout(getUserXp(supabase, user.id), LOAD_TIMEOUT_MS, 0),
        ]);

      if (!profile) {
        // Round-1 core (the profile row) didn't resolve — timed out or failed —
        // so we can't determine the member's persona (kid/teen/parent/solo) or
        // tier. Render the deterministic empty state instead of mislabeling them
        // (e.g. "not enrolled") or hanging the skeleton. See loadError render.
        setLoadError(true);
        setLoading(false);
        return;
      }

      const hs = state as HomeState;
      setHome(hs);
      setUserId(user.id);
      setFirstName(profile?.display_name?.split(" ")[0] || "");
      setFicWeek(week);
      setXp(xpTotal);

      const famId = profile?.family_id ?? null;
      const track = hs?.track || "adults";
      setHasFamily(!!famId);
      setFamilyId(famId);
      setRegister(deriveRegister(profile));

      // Does the family still need to fill the profile questionnaire? Parents
      // only; drives whether the warm welcome card jumps ahead of the setup
      // checklist on first login. Mirrors FamilyProfileHome's dismiss counter
      // (dismissed twice = retired).
      if (famId && (profile?.role === "parent" || profile?.role === "admin")) {
        const { data: fpRow } = await supabase
          .from("family_profiles")
          .select("household, completed_at")
          .eq("family_id", famId)
          .maybeSingle();
        setIsSolo(isSoloProfile(fpRow));
        // Active 5-Day Challenge pass window (for ClubHome v2's challenge slot).
        // Best-effort own-family lookup; null (no active pass) is the common case.
        void (async () => {
          const { data: pass } = await supabase
            .from("enrollments")
            .select("expires_at")
            .eq("family_id", famId)
            .eq("program", "challenge_pass")
            .eq("status", "active")
            .not("expires_at", "is", null)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle();
          setSoloChallengeExpiresAt((pass?.expires_at as string | null) ?? null);
        })().catch(() => {});
        let dcount = 0;
        try {
          dcount = parseInt(
            localStorage.getItem(`fta:family-profile-prompt-dismissed:${famId}`) || "0",
            10
          ) || 0;
        } catch {
          /* private mode — treat as not dismissed */
        }
        setProfileNeedsAttention(!fpRow?.completed_at && dcount < 2);
      }

      // FREE tier gets a dedicated, limited home (the free-class hub + upsell).
      // Short-circuit before loading any member content. Timeout-guarded so a
      // slow tier lookup can't hang the first paint; on timeout we assume a
      // member home (the majority case) rather than freezing.
      const tier = await withTimeout(
        getFamilyTier(supabase, famId),
        LOAD_TIMEOUT_MS,
        "member" as Awaited<ReturnType<typeof getFamilyTier>>
      );
      setPaidTier(tier as "free" | "fic" | "fta");
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

      // Adults-only (parent/admin) Kai briefing card — newest trade alert.
      // Non-free is guaranteed here (free short-circuits above). Kids/teens
      // (role 'child') never fetch it. Best-effort; hides if the feed is empty.
      if (profile?.role === "parent" || profile?.role === "admin") {
        void (async () => {
          const { data: alertRow } = await supabase
            .from("trade_alerts")
            .select("ticker, direction, setup_label")
            .order("issued_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (alertRow) setLatestAlert(alertRow);
        })().catch(() => {});
      }

      // FTA families: hydrate the premium Academy rail after paint. One cheap
      // query for the next scheduled class, only for the tier that shows it —
      // mirrors the /upgrade FTA panel so the two stay consistent.
      if (tier === "fta") {
        setIsFta(true);
        void (async () => {
          const { data: s } = await supabase
            .from("live_sessions")
            .select("title, scheduled_at")
            .eq("status", "scheduled")
            .order("scheduled_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (s?.scheduled_at) {
            setFtaNextClass({
              title: s.title,
              when: new Date(s.scheduled_at).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }),
            });
          }
        })().catch(() => {});
      }

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
     } catch (err) {
       // Any unhandled failure in round-1 resolution falls into the deterministic
       // empty state rather than hanging the skeleton.
       console.error("[dashboard] home load failed:", err);
       setLoadError(true);
     } finally {
       // Guarantee the skeleton always resolves, on every path.
       setLoading(false);
     }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <DashboardSkeleton variant="default" />;
  }

  // Deterministic fallback: round-1 resolution failed/timed out (no session, a
  // thrown query, an unresolved profile, or the hard watchdog). Show a calm empty
  // state with a retry — never an infinite skeleton, never a misleading persona.
  if (loadError) {
    return <DashboardLoadError firstName={firstName} />;
  }

  if (isFree) {
    return <FreeHome firstName={firstName} />;
  }

  // CLUB (individual / solo) mode — the community-first Home (R3). Family-mode
  // households fall through to the academy-first layout below, unchanged. FTA
  // solo owners keep the club-first Home too; their gold Academy rail lives on
  // the FTA hub, and the club-first surface is the owner-approved default.
  if (isSolo) {
    const learning =
      home?.program && home.today
        ? {
            title: home.today.title,
            href: `/courses/${home.today.course_slug}/${home.today.module_id}/${home.today.lesson_id}`,
            context: `${home.today.module_title} · ${home.today.course_title}`,
          }
        : null;
    return (
      <ClubHomeV2
        firstName={firstName}
        register={register}
        learning={learning}
        challengeExpiresAt={soloChallengeExpiresAt}
        xp={xp}
      />
    );
  }

  const isKid = home?.role === "child" && home?.track === "kids";
  const greeting = greetingFor(greetingHour);
  const isTeen = home?.role === "child" && home?.track === "teens";
  const isParent = !isKid && !isTeen;
  // EVERY child, not just the kids/teens tracks — a child row whose `track` is
  // 'adults' is still a minor, and the pricing gate below keys off this.
  const isChild = home?.role === "child";
  // Paid = the family_tiers entitlement, not an enrollments row. Requires a real
  // household: getFamilyTier answers 'fic' for a null family_id, and a member
  // with no family has not bought anything — the offer still belongs to them.
  const isPaidTier = !!familyId && (paidTier === "fic" || paidTier === "fta");
  const orientationComplete = orientationDone >= ORIENTATION_TOTAL;

  // ── Onboarding-prompt orchestration (one prioritized sequence) ──────────────
  // 1. The guided tour (AppTour, mounted in DashboardShell) owns true first
  //    login and runs once (gated on profiles.tour_completed_at).
  // 2. Exactly ONE setup card here — the Start Here checklist progress — and
  //    only for PARENTS (kids/teens never see family-setup prompts). It
  //    auto-dismisses at 6/6 and can be dismissed manually.
  // 3. The "Tell us about your family" profile card appears ONLY after setup is
  //    resolved (completed or dismissed), so the two never stack.
  const setupResolved = orientationComplete || setupDismissed;
  // Questionnaire-first on first login (Lane 8A): an incomplete family profile
  // outranks the setup checklist, so the warm "Tell us about your family" card
  // is the prominent first-login prompt for every entry path.
  const showProfileFirst = isParent && hasFamily && !!familyId && profileNeedsAttention;
  const showSetupCard = isParent && hasFamily && !setupResolved && !showProfileFirst;
  const showProfileCard =
    isParent && hasFamily && !!familyId && (showProfileFirst || setupResolved);

  // ── TEEN: the household's live objects ─────────────────────────────────────
  // Tonight's watchlist vote and the family paper challenge, read from the same
  // rows the parent surfaces read (family_watchlist_votes + the
  // family_paper_standings definer RPC — both open to any member of the family,
  // minors included). Built once and rendered in exactly ONE of the two slots
  // below, so an enrolled teen gets it under their hero and an un-enrolled teen
  // still gets it. Self-gating: renders nothing until it resolves, and nothing
  // at all when the household has no vote and no paper accounts.
  const teenRails =
    isTeen && familyId && userId ? (
      <TeenHomeRails familyId={familyId} viewerId={userId} />
    ) : null;

  // ── KID: the hero always carries a real action ─────────────────────────────
  // Kids never see the enrollment upsell (standing rule) and never see the
  // "You did it!" win screen at zero progress. KidTodayHero resolves today's
  // mission → today's lesson → the first-adventure door, so every kid path —
  // including program:null and today:null at 0 XP — lands on something to do.
  const kidHero = (
    <KidTodayHero
      xp={xp}
      track={home?.track}
      art={heroArt(home?.track ?? "kids", false)}
    />
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-14">
      {/* ── Masthead ────────────────────────────────────────────────────────
          The canvas opens every board with an eyebrow, one display headline
          and a lede — three registers, not three sizes of the same thing. */}
      <header>
        {home?.cohort && (
          <span className="mb-1.5 inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-700">
            <Flame className="h-3 w-3" aria-hidden />
            {home.cohort}
          </span>
        )}

        <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">
          {isKid
            ? `Hey ${firstName || "Explorer"}!`
            : `${greeting}, ${firstName || "there"}`}{" "}
          <span aria-hidden>👋</span>
        </h1>

        <p className="mt-1.5 max-w-lg text-[13px] leading-snug text-soft">
          {home?.program === "fta" && home.week ? (
            <>
              Week {home.week} of 6 —{" "}
              <span className="font-semibold text-gold-700">
                {WEEK_CODENAMES[home.week]}
              </span>
            </>
          ) : isKid ? (
            "Ready for today's adventure?"
          ) : (
            "Steady steps build the skill."
          )}
        </p>
      </header>

      {/* Belt/XP — always-visible progress toward the next belt. */}
      <BeltHeroStrip xp={xp} isKid={isKid} />

      {/* Kai briefing (Lane C6) — adults only (parents), renders only when the
          trade-alerts feed has a row. Free tier never reaches this page.
          Canvas: the brand-tinted digest field, with Kai wearing kai blue —
          the same object Home's "Today in 30 seconds" uses, so a briefing
          looks like a briefing everywhere in the app. */}
      {isParent && latestAlert && (
        <Link
          href="/alerts"
          className="f0-brief-field f0-grain f0-focus block px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <span className="f0-kai-mark h-9 w-9 shrink-0" aria-hidden>
              <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-soft">
                Kai briefing
              </p>
              <p className="mt-1 truncate font-display text-[15px] font-extrabold text-ink">
                {latestAlert.ticker} {latestAlert.direction}
                {latestAlert.setup_label ? ` — ${latestAlert.setup_label}` : ""}
              </p>
              <p className="mt-0.5 text-[12px] text-soft">See today&apos;s alerts →</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-gold-700" aria-hidden />
          </div>
        </Link>
      )}

      {/* Setup prompt #1 — the Start Here checklist, demoted from a nav row to
          a dismissible Home object. Parents only; auto-hides at 6/6. */}
      {showSetupCard && (
        <section className="f0-rule-top relative pt-4" data-tour="start-here">
          <Link href="/start-here" className="f0-focus group block pr-9">
            <div className="flex items-center gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent-solid)_12%,transparent)] text-gold-700">
                <Compass className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[15px] font-extrabold text-ink">
                  {isSolo ? "Finish setting up your account" : "Finish setting up your family"}
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-soft">
                  {orientationDone} of {ORIENTATION_TOTAL} Start Here steps done —
                  pick up where you left off.
                </p>
                <Meter
                  pct={Math.round((orientationDone / ORIENTATION_TOTAL) * 100)}
                  className="mt-2 max-w-xs"
                />
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-gold-700 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
            </div>
          </Link>
          <button
            onClick={dismissSetupCard}
            aria-label="Dismiss setup checklist"
            className="f0-focus absolute right-0 top-3 grid h-7 w-7 place-items-center rounded-full text-soft transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </section>
      )}

      {/* Prompt #2 — family-profile / "recommended next". Only surfaces AFTER
          the setup prompt is resolved, so exactly one shows at a time.
          Self-contained (renders null when there's nothing to show). */}
      {showProfileCard && familyId && (
        <FamilyProfileHome familyId={familyId} />
      )}

      {/* Family Mode activation — quiet Home object for solo owners. Family Mode
          is included in their membership; this converts solo→family so the FIC
          surfaces light up. Self-gates via the passed isSolo/familyId. */}
      {isSolo && familyId && (
        <AddFamily variant="card" isSolo={isSolo} familyId={familyId} />
      )}

      {/* ── FTA PREMIUM RAIL (audit #3) — a distinct Academy section for $2,997
             families, above the fold. One rail, not a takeover.
             Canvas: the three bordered tiles were an equal-column CONTENT grid
             (banned). They are a hairline ledger now, which also lets the next
             live class sit at the top of the same list instead of in its own
             separate strip. ─────────────────────────────────────────────────── */}
      {isFta && (
        <section aria-labelledby="fta-rail">
          <div className="flex items-end justify-between gap-3">
            <h2 id="fta-rail" className="min-w-0 flex-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
              <span>
                Family Trading Academy
              </span>
            </h2>
            <Link
              href="/live-sessions"
              className="f0-focus f0-press hidden shrink-0 items-center gap-1.5 rounded-md font-display text-[13px] font-bold text-gold-700 hover:text-gold-600 sm:inline-flex"
            >
              <Video className="h-4 w-4" aria-hidden />
              Live classes
            </Link>
          </div>

          <p className="mt-3 font-display text-display-3 font-extrabold leading-snug text-ink">
            Your premium trading hub
          </p>

          <div className="club-b-stack mt-3">
            {/* Next live class — the live JOIN stays on Live Classes; the hub
                doors below open the FTA section. */}
            {ftaNextClass && (
              <Link href="/live-sessions" className="club-b-card f0-ledger-row f0-focus group">
                <Video className="h-4 w-4 shrink-0 text-gold-700" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-700">
                    Next live class
                  </span>
                  <span className="mt-0.5 block truncate font-display text-[15px] font-extrabold text-ink">
                    {ftaNextClass.title}
                  </span>
                </span>
                <span className="hidden shrink-0 font-mono text-[12px] text-soft sm:inline">
                  {ftaNextClass.when}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-gold-700 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
              </Link>
            )}

            <FtaDoor
              href="/fta/chat"
              icon={Radio}
              label="Traders Chat"
              sub="Your always-on FTA room — setups, questions, and live-class talk."
              action="Open chat"
            />
            <FtaDoor
              href="/fta/courses"
              icon={GraduationCap}
              label="Course Library"
              sub="Pick up where your family left off — foundations to trade ready."
              action="Continue the program"
            />
            <FtaDoor
              href="/fta/recordings"
              icon={Film}
              label="Recordings"
              sub="Every FTA class, always waiting — newest first, grouped by series."
              action="Watch recordings"
            />
          </div>
        </section>
      )}

      {/* Home tabs: everyday home vs This Week in FIC */}
      <TabRail
        ariaLabel="Home sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "home" as const, label: isKid ? "Home" : "Home" },
          {
            id: "week" as const,
            label: isSolo ? "This Week in the Club" : "This Week in FIC",
          },
        ]}
      />

      {tab === "week" && (
        <ThisWeekPanel
          week={ficWeek}
          isKid={isKid}
          isTeen={isTeen}
          isParent={isParent}
          isSolo={isSolo}
        />
      )}

      {tab === "home" && (
        <>
          {/* Live "Today in the Club" pulse masthead (D1). */}
          <ClubPulseMasthead isKid={isKid} />

          {/* NO PROGRAM YET — three different truths, never one.
              `home.program` comes from get_home_state, which reads the
              `enrollments` table. Entitlement does NOT live there: a Club
              family is paid via `family_tiers.tier = 'fic'` and may carry no
              enrollments row at all, so `program: null` was being read as "not
              a customer" and every member of a PAYING household was shown the
              price list. A CHILD was shown it too — a minor sent to /upgrade.
              So: children never see a pitch (their next step is a lesson), a
              paid household never sees a pitch, and the offer survives only for
              the adult who genuinely has nothing yet. */}
          {/* A KID gets the real thing rather than a generic "start a lesson"
              door: today's mission, else today's lesson, else the first
              adventure. Same intent as the child branch below — kids never see a
              pitch — resolved to an actual piece of content. Teens and paid
              adults keep the block below untouched. */}
          {!home?.program && isKid && kidHero}

          {/* An un-enrolled TEEN still has a household: the vote and the paper
              challenge don't wait on an enrollments row. */}
          {!home?.program && teenRails}

          {!home?.program && !isKid && (isChild || isPaidTier) && (
            <div className="f0-rule-left py-1 pl-4">
              <p className="font-display text-display-3 font-extrabold text-ink">
                Pick up where you left off
              </p>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-soft">
                {isChild
                  ? "One lesson, then you're done for the day. Short ones — about ten minutes."
                  : "Your next lesson is waiting in the library — one concept at a time, in order."}
              </p>
              <Link
                href="/courses"
                className="cta-button f0-focus mt-4 inline-flex items-center gap-2 rounded-xl px-6 py-3"
              >
                Start a lesson <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {!home?.program && !isChild && !isPaidTier && (
            <div className="f0-rule-left py-1 pl-4">
              <p className="font-display text-display-3 font-extrabold text-ink">
                {isSolo ? "You're not enrolled yet" : "Your family isn't enrolled yet"}
              </p>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-soft">
                {isSolo
                  ? "The Cheat Code Club is where you learn one money concept, study one company, and build the habit every week. Want the deep end too? The FTA academy adds a 6-week live, beginner-to-trade-ready program on top."
                  : "The Cheat Code Club is where your family learns one money concept, studies one company, and builds the habit together every week. Want the deep end too? The FTA academy adds a 6-week live, beginner-to-trade-ready program on top."}
              </p>
              <Link
                href="/upgrade"
                className="cta-button f0-focus mt-4 inline-flex items-center gap-2 rounded-xl px-6 py-3"
              >
                See programs <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {home?.program && (
            <>
              {/* ── HERO — Today's one thing. The surface's ONE hero field:
                     the art becomes the ground, the scrim keeps the type
                     legible over it, and the whole object is the dominant
                     value contrast on the page rather than a bordered card
                     with a picture glued to its left half.

                     A KID with no `today` never gets the win screen here: at
                     zero progress "You did it!" is a lie, and even a caught-up
                     kid deserves the next real thing. KidTodayHero owns that
                     path — same hero field, resolved to a mission or a lesson,
                     with the honest all-caught-up state only once they have
                     actually done work. ─────────────────────────────────── */}
              {isKid && !home.today ? (
                kidHero
              ) : (
              <section className="f0-hero-field relative">
                <Image
                  src={heroArt(home.track, home.caught_up)}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover"
                  priority
                />
                <div className="f0-hero-scrim" />
                <div className="relative px-6 py-8 lg:px-9 lg:py-11">
                  {home.today ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                        <Target className="h-3.5 w-3.5" aria-hidden />
                        {isKid ? "Today's adventure" : "Today's one thing"}
                      </span>
                      <h2 className="mt-4 max-w-xl font-display text-display-2 font-extrabold leading-tight text-white">
                        {home.today.title}
                      </h2>
                      {home.today.description && (
                        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">
                          {home.today.description}
                        </p>
                      )}
                      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">
                        {home.today.module_title} · {home.today.course_title}
                      </p>
                      <div className="mt-6 flex flex-wrap items-center gap-4">
                        <Link
                          href={`/courses/${home.today.course_slug}/${home.today.module_id}/${home.today.lesson_id}`}
                          className="cta-button f0-focus inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm"
                        >
                          <PlayCircle className="h-4 w-4" />
                          {isKid ? "Start the adventure" : "Start lesson"}
                        </Link>
                        {typeof home.foundations_total === "number" &&
                          home.foundations_total > 0 && (
                            <div className="flex items-center gap-2.5">
                              <Meter
                                onDark
                                pct={Math.round(
                                  ((home.foundations_done || 0) / home.foundations_total) * 100
                                )}
                                className="w-28"
                              />
                              <span className="font-mono text-[11px] tabular-nums text-white/75">
                                {home.foundations_done}/{home.foundations_total}{" "}
                                done
                              </span>
                            </div>
                          )}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                        <Trophy className="h-3.5 w-3.5" aria-hidden />
                        All caught up
                      </span>
                      <h2 className="mt-4 font-display text-display-2 font-extrabold leading-tight text-white">
                        {isKid ? "You did it!" : "Foundations complete for now"}
                      </h2>
                      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">
                        {isKid
                          ? "Every lesson is done. Practice your skills or show a grown-up what you learned."
                          : "Everything unlocked so far is finished. Sharpen up in the simulator, or review this week's drill before Saturday."}
                      </p>
                      <div className="mt-6 flex gap-3">
                        <Link
                          href="/simulator/lessons"
                          className="cta-button f0-focus inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
                        >
                          <Target className="h-4 w-4" /> Practice patterns
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </section>
              )}

              {/* TEEN: the household's live objects, directly under their own
                  one thing. Renders nothing until it resolves. */}
              {teenRails}

              {/* ── THIS WEEK — live class + drill (academy execution rail) ── */}
              {home.this_week && (
                <section aria-labelledby="this-week">
                  <div className="flex items-end justify-between gap-3">
                    <h2 id="this-week" className="min-w-0 flex-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                      <span>
                        Your live class + drills
                      </span>
                    </h2>
                    <Link
                      href="/live-sessions"
                      className="f0-focus f0-press inline-flex shrink-0 items-center gap-1.5 rounded-md font-display text-[13px] font-bold text-gold-700 hover:text-gold-600"
                    >
                      <CalendarDays className="h-4 w-4" aria-hidden />
                      Live classes
                    </Link>
                  </div>

                  <p className="mt-3 font-display text-display-3 font-extrabold leading-snug text-ink">
                    {home.this_week.title}
                  </p>
                  {home.this_week.description && (
                    <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-soft">
                      {home.this_week.description}
                    </p>
                  )}

                  <div className="club-b-stack mt-3">
                    {home.this_week.lessons.map((l) => (
                      <div key={l.id} className="club-b-card f0-ledger-row">
                        {l.completed ? (
                          /* COLOUR LAW: green is PRICE. A finished lesson is
                             not a gain, so the completed tick rides the ACTION
                             ramp (gold-700 — themed orange, no dark: variant)
                             like every other completion mark in the system. */
                          <CheckCircle2
                            className="h-5 w-5 shrink-0 self-start text-gold-700"
                            aria-hidden
                          />
                        ) : (
                          <Circle
                            className="h-5 w-5 shrink-0 self-start text-soft"
                            aria-hidden
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`font-display text-[14.5px] font-bold ${
                              l.completed ? "text-soft" : "text-ink"
                            }`}
                          >
                            {l.title}
                          </p>
                          {l.description && (
                            <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-soft">
                              {l.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Role strips. The old `grid md:grid-cols-2` of two cards was
                     an equal-column CONTENT grid; they are stacked ruled
                     sections now, so a family of five and a family of one
                     both read correctly. ──────────────────────────────────── */}

              {/* Parent: family this week */}
              {isParent && family.length > 0 && (
                <section aria-labelledby="family-week">
                  <div className="flex items-end justify-between gap-3">
                    <h2 id="family-week" className="min-w-0 flex-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                      <span>
                        Your family this week
                      </span>
                    </h2>
                    <Link
                      href="/family/overview"
                      className="f0-focus f0-press inline-flex shrink-0 items-center gap-1 rounded-md font-display text-[13px] font-bold text-gold-700 hover:text-gold-600"
                    >
                      Full overview <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                  <div className="club-b-stack mt-2">
                    {family.map((member) => (
                      <div key={member.id} className="club-b-card f0-ledger-row">
                        <Avatar
                          name={member.display_name}
                          avatarUrl={member.avatar_url}
                          role={member.role}
                          xp={member.xp}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-[14.5px] font-bold text-ink">
                            {member.display_name}
                          </p>
                          <p className="mt-0.5 text-[12px] capitalize text-soft">
                            {member.age_group || member.role} · {levelForXp(member.xp).name}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[12px] tabular-nums text-soft">
                          {member.completed} lesson{member.completed === 1 ? "" : "s"} done
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Kid: House Rules */}
              {isKid && (
                <section aria-labelledby="house-rules">
                  <h2 id="house-rules" className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                    <span>
                      Our House Rules
                    </span>
                  </h2>
                  <ol className="club-b-stack mt-2">
                    {HOUSE_RULES.map((rule, i) => (
                      <li key={rule} className="club-b-card f0-ledger-row">
                        <span className="f0-rank shrink-0" aria-hidden>
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 font-display text-[14.5px] font-bold text-ink">
                          {rule}
                        </span>
                        <Shield className="h-4 w-4 shrink-0 text-soft" aria-hidden />
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Everyone: quick links */}
              <section aria-labelledby="keep-going">
                <h2 id="keep-going" className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                  <span>
                    {isKid ? "More fun" : "Keep going"}
                  </span>
                </h2>
                <div className="club-b-stack mt-2">
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
              </section>

              {/* Clubhouse activity — demoted below the family strips, capped to a
                  short glance; self-contained, renders null when empty */}
              <ClubActivityStrip limit={2} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Deterministic empty state when round-1 home resolution fails or times out. A
 * member never sits on the skeleton — they get a calm card, a reload, and doors
 * to the surfaces that don't depend on the home payload.
 */
function DashboardLoadError({ firstName }: { firstName: string }) {
  return (
    <div className="mx-auto max-w-xl pt-10">
      <div className="f0-rule-left py-1 pl-4">
        <p className="font-display text-eyebrow font-bold uppercase text-gold-700">
          <Sparkles className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
          Home
        </p>
        <h2 className="mt-2 font-display text-display-2 font-extrabold leading-tight text-ink">
          {firstName ? `We couldn't load your home, ${firstName}` : "We couldn't load your home"}
        </h2>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-soft">
          Something took too long on our side. Your progress is safe — give it another try, or
          jump straight into the Club.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="cta-button f0-focus inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm"
          >
            Reload <ArrowRight className="h-4 w-4" />
          </button>
          <Link
            href="/community"
            className="f0-focus f0-press inline-flex items-center gap-2 rounded-md font-display text-sm font-bold text-gold-700 hover:text-gold-600"
          >
            <Users className="h-4 w-4" /> Go to the community
          </Link>
        </div>
      </div>
    </div>
  );
}

/* A ledger row, not a bordered tile: the quick links are a LIST of doors, and a
   list is what the register asks for once there are more than three of them. */
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
    <Link href={href} className="club-b-card f0-ledger-row f0-focus group">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--accent-solid)_12%,transparent)] text-gold-700">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[14.5px] font-bold text-ink">{label}</span>
        <span className="mt-0.5 block text-[12.5px] text-soft">{sub}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-soft transition-all group-hover:translate-x-0.5 group-hover:text-gold-700 motion-reduce:transform-none" />
    </Link>
  );
}

/* One door into the FTA hub. Same row grammar as QuickLink, with the action
   verb kept because the Academy rail is a premium surface and each door does a
   different thing ("open chat" vs "watch recordings"). */
function FtaDoor({
  href,
  icon: Icon,
  label,
  sub,
  action,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  sub: string;
  action: string;
}) {
  return (
    <Link href={href} className="club-b-card f0-ledger-row f0-focus group">
      <Icon className="h-4 w-4 shrink-0 self-start text-gold-700" />
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-700">
          {label}
        </span>
        <span className="mt-1 block text-[13px] leading-relaxed text-soft">{sub}</span>
        <span className="mt-1.5 inline-flex items-center gap-1.5 font-display text-[12.5px] font-bold text-ink">
          {action}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
        </span>
      </span>
    </Link>
  );
}
