"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUserXp } from "@/lib/xp";
import {
  showsKaiFab,
  MAIN_PADDING_WITH_FAB,
  MAIN_PADDING_NO_FAB,
} from "@/lib/kai-fab";
import DashboardSidebar from "./DashboardSidebar";
import DashboardTopBar from "./DashboardTopBar";
import MobileTabBar from "./MobileTabBar";
import KaiSheetProvider from "@/components/kai/KaiSheetProvider";
import FreeLocked from "./FreeLocked";
import type { UpsellContext } from "./UpsellCard";
import AppTour from "@/components/tour/AppTour";
import ModeManager from "@/components/ModeManager";
import NotificationOnboard from "@/components/notifications/NotificationOnboard";
import FirstRun from "@/components/first-run/FirstRun";
import FirstWin from "@/components/first-run/FirstWin";
import { Toaster } from "@/components/ui/Toast";
import { Suspense } from "react";

import type { FamilyTier } from "@/lib/tier";

// FREE-tier families may reach these dashboard surfaces; every other route
// renders a locked upsell (centralized here rather than gating each page).
//
// THE PRINCIPLE: A PRIMARY SURFACE METERS, IT NEVER WALLS. The pricing matrix
// (src/lib/entitlements/features.ts) promises a free member 5 watchlist tickers,
// a few Kai questions a day, basic screener filters and the general discover
// feed — so those screens must OPEN, with the real board, the real data, and the
// last step withheld inline (UnlockLine / a designed limit moment). A full-page
// wall on a surface the pricing page sells as free is a broken promise, not a
// gate. Only genuinely member-only ROOMS (live sessions, missions, the family
// desk) are locked here; everything free-metered self-meters below.
//
// The rest is unchanged: "give the tools, gate the guidance" — free members get
// the courses sampler, the practice chart + games hub, the picks teaser, and
// read-only community. Deep child routes (a locked lesson, Trend or Trap)
// enforce their own server/page checks.
const FREE_ALLOWED_PREFIXES = [
  "/dashboard",
  "/community",
  "/settings",
  "/upgrade",
  "/help",
  "/courses", // sampler mode (locked lessons enforced server-side in the route)
  "/chart", // full practice chart
  "/games", // hub + Candle Battle (Trend or Trap locks itself at the page)
  "/u", // member profiles are read-only for everyone; a free user must be able
  //       to see their OWN profile. Upsell belongs on member-only ACTIONS
  //       (posting, commenting), not on viewing a read-only profile page.
  "/research", // WSZ funnel bait (Lane 9): free tier sees the hero + price chart
  //             + news; the page itself locks the scorecard/checks/fundamentals
  //             behind UpsellCard and hides all locks from kids.
  "/watchlist", // metered internally: 5 active tickers, the rest preserved and
  //              paused, and the limit moment lives in the add flow.
  "/discover", // metered internally: the free feed is real; the Club-only
  //             intelligence layers unlock inline on the surface.
  "/screener", // metered internally: basic filters are free per PRICING_MATRIX;
  //             AI search + saved screens meter on the page.
  "/kai", // metered internally: a few questions a day, counted on the surface.
];

// The remaining locked prefixes map to a shared UpsellCard context, matched by
// longest prefix.
const LOCKED_CONTEXTS: { prefix: string; context: UpsellContext }[] = [
  { prefix: "/fta", context: "live" },
  { prefix: "/live-sessions", context: "live" },
  { prefix: "/missions", context: "missions" },
  { prefix: "/flashcards", context: "flashcards" },
  { prefix: "/simulator", context: "simulator" },
  { prefix: "/progress", context: "progress" },
  { prefix: "/family", context: "generic" },
  // Each of these used to render the same anonymous "A member feature" panel —
  // a door with no label on it. They now name what is actually behind them.
  { prefix: "/parent-corner", context: "parent-corner" },
  { prefix: "/referrals", context: "referrals" },
  { prefix: "/leaderboard", context: "leaderboard" },
  { prefix: "/start-here", context: "start-here" },
];

interface DashboardShellProps {
  user: {
    email?: string;
    display_name?: string;
    role?: string;
    age_group?: string;
    track?: string;
    avatar_url?: string;
    tier?: FamilyTier;
    isSolo?: boolean;
    isChallenge?: boolean;
    isVip?: boolean;
  };
  /** ISO expiry of an active 5-Day Challenge pass (Lane C7), else null. */
  challengeExpiresAt?: string | null;
  /**
   * FTA Club clock (migration 127): the family's 12-month Challenge Club window
   * has ended. Still tier 'fta' (FTA hub open), but Club-level pages gate at
   * free and the shell shows a tasteful renewal banner.
   */
  clubLapsed?: boolean;
  /** ISO date the Club window closed (for the renewal banner copy). */
  clubUntil?: string | null;
  /**
   * Admin "View as" register preview is active (src/lib/view-as.ts). The `user`
   * prop above is then a PERSONA, not this account. Used only to suppress the
   * onboarding layers below — they write to the real profiles row (tour_version,
   * first-run timestamps) and must never be driven by a fake register.
   */
  viewAs?: string | null;
  children: React.ReactNode;
}

export default function DashboardShell({
  user,
  challengeExpiresAt,
  clubLapsed,
  clubUntil,
  viewAs,
  children,
}: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Lifetime XP for the belt chip — fetched once here and shared with the TopBar
  // (desktop/tablet) and MobileTabBar More-sheet header so both belt chips read
  // the same value from a single query. null = still loading (chip skeletons).
  const [xp, setXp] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const supabase = createClient();
    (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        if (active) setXp(0);
        return;
      }
      const total = await getUserXp(supabase, authUser.id);
      if (active) setXp(total);
    })();
    return () => {
      active = false;
    };
  }, []);

  const isFree = (user.tier ?? "fic") === "free";
  const freeLocked =
    isFree &&
    !FREE_ALLOWED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
  const lockedContext =
    LOCKED_CONTEXTS.find((l) => pathname.startsWith(l.prefix))?.context ??
    "generic";

  // 5-Day Challenge pass (Lane C7) — a friendly days-left banner for pass
  // holders. Full Club now; when it ends they drop to free (progress stays).
  const challengeDaysLeft = challengeExpiresAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(challengeExpiresAt).getTime() - Date.now()) / 86_400_000
        )
      )
    : null;

  // MODE (Cheat Code Club redesign R1) — the brand/palette skin. FTA hub routes
  // are the metallic-gold desk regardless of household; otherwise a solo member
  // gets the Club skin (sand + volt orange), a household keeps Family (warm gold,
  // unchanged). Stamped on the wrapper for the SSR subtree; ModeManager mirrors
  // it onto <html> for body chrome + the tab favicon.
  const mode: "club" | "family" | "fta" = pathname.startsWith("/fta")
    ? "fta"
    : user.isSolo
      ? "club"
      : "family";

  return (
    <div data-mode={mode} className="min-h-screen bg-midnight-950">
      <ModeManager mode={mode} />
      <KaiSheetProvider
        tier={user.tier}
        role={user.role}
        ageGroup={user.age_group}
        isSolo={user.isSolo}
      >
      <DashboardSidebar
        user={user}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-60"
        }`}
      >
        <DashboardTopBar
          user={user}
          xp={xp}
          onMenuClick={() => setMobileOpen(true)}
        />

        {/* Bottom room. The tab bar (4rem + the iOS safe-area inset) was the
            only thing this ever cleared, so on every route that also floats the
            Kai FAB the last row of a list ended up parked underneath it. The
            two measurements now come from ONE place — see src/lib/kai-fab. */}
        <main
          className={`px-4 lg:px-8 pt-6 ${
            showsKaiFab(pathname, user.tier)
              ? MAIN_PADDING_WITH_FAB
              : MAIN_PADDING_NO_FAB
          }`}
        >
          {challengeDaysLeft !== null && !freeLocked && (
            <Link
              href="/upgrade"
              className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-gold-400/40 bg-gold-400/[0.08] px-4 py-3 transition hover:border-gold-400/70"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-400/20 px-2 py-0.5 text-[11px] font-display font-bold uppercase tracking-wide text-gold-700">
                <Flame className="h-3 w-3" />
                Challenge
              </span>
              <span className="text-sm font-semibold text-midnight-100">
                {challengeDaysLeft <= 0
                  ? "Your full Club access ends today"
                  : `${challengeDaysLeft} day${challengeDaysLeft === 1 ? "" : "s"} of full Club access left`}
              </span>
              <span className="text-[13px] text-midnight-400">
                — keep it for $99/mo, or drop to free (your progress stays) →
              </span>
            </Link>
          )}
          {clubLapsed &&
            !pathname.startsWith("/upgrade") &&
            !pathname.startsWith("/fta") && (
              <Link
                href="/upgrade"
                className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-gold-400/40 bg-gold-400/[0.08] px-4 py-3 transition hover:border-gold-400/70"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-400/20 px-2 py-0.5 text-[11px] font-display font-bold uppercase tracking-wide text-gold-700">
                  <GraduationCap className="h-3 w-3" />
                  FTA
                </span>
                <span className="text-sm font-semibold text-midnight-100">
                  Your Academy access stays for life
                </span>
                <span className="text-[13px] text-midnight-400">
                  — keep the Club (community, Kai, watchlist &amp; alerts) for
                  $99/mo →
                </span>
              </Link>
            )}
          {freeLocked ? <FreeLocked context={lockedContext} /> : children}
        </main>
      </div>

      {/* App-style bottom tab bar — phones only, dashboard routes only. */}
      <MobileTabBar user={user} xp={xp} />

      {/* The contextual Kai sheet + its floating FAB are owned by
          KaiSheetProvider (wrapping this subtree) — Kai is a system capability,
          reachable from the FAB, "Ask Kai" actions, and universal search. */}
      </KaiSheetProvider>

      {/* The three layers below all PERSIST — AppTour and FirstRun update the
          real profiles row (tour_version, first-run timestamps) and
          NotificationOnboard touches push subscriptions. Under an admin
          register preview `user` is a persona, so running them would write the
          preview back onto the admin's real account. A preview never writes. */}
      {!viewAs && (
        <>
          <Suspense fallback={null}>
            <AppTour user={user} />
          </Suspense>

          {/* THE FIRST WIN — one prompt that ends in a real position taken,
              for adults without a Challenge pass. AppTour's auto-run stands
              down for exactly those members (it still replays from
              /dashboard?tour=1), and both stamp the same `tour_completed_at`
              and fire the same `fic:tour-finished`, so FirstRun's sequence is
              unchanged whichever one ran. */}
          <Suspense fallback={null}>
            <FirstWin user={user} />
          </Suspense>

          {/* Unified per-profile first-run layer: sequences walkthrough → add-to
              -home-screen → push pre-prompt on a user's first session, every
              signup path. Converges here so the invite path (and every other)
              gets first-run. */}
          <Suspense fallback={null}>
            <FirstRun user={user} />
          </Suspense>

          {/* Silent push self-heal + platform-aware re-prompts (FirstRun owns
              the initial prompt and silences this during first-run to avoid
              doubling). */}
          <NotificationOnboard />
        </>
      )}

      {/* Global toast host (enrollment confirmations, etc.). */}
      <Toaster />
    </div>
  );
}
