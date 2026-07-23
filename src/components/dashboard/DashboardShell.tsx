"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getUserXp } from "@/lib/xp";
import DashboardSidebar from "./DashboardSidebar";
import DashboardTopBar from "./DashboardTopBar";
import MobileTabBar from "./MobileTabBar";
import FreeLocked from "./FreeLocked";
import type { UpsellContext } from "./UpsellCard";
import AppTour from "@/components/tour/AppTour";
import NotificationOnboard from "@/components/notifications/NotificationOnboard";
import { Toaster } from "@/components/ui/Toast";
import { Suspense } from "react";

import type { FamilyTier } from "@/lib/tier";

// FREE-tier families may reach these dashboard surfaces; every other route
// renders a locked upsell (centralized here rather than gating each page). The
// principle is "give the tools, gate the guidance": free members get the courses
// sampler, the practice chart + games hub, the picks teaser, and read-only
// community — the pages themselves handle their own free-state internally. Deep
// child routes (a locked lesson, Trend or Trap) enforce their own server/page
// checks. Everything else is locked here.
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
];

// The remaining locked prefixes map to a shared UpsellCard context, matched by
// longest prefix.
const LOCKED_CONTEXTS: { prefix: string; context: UpsellContext }[] = [
  { prefix: "/fta", context: "live" },
  { prefix: "/live-sessions", context: "live" },
  { prefix: "/watchlist", context: "watchlist" },
  { prefix: "/screener", context: "screener" },
  { prefix: "/missions", context: "missions" },
  { prefix: "/flashcards", context: "flashcards" },
  { prefix: "/simulator", context: "simulator" },
  { prefix: "/progress", context: "progress" },
  { prefix: "/family", context: "generic" },
  { prefix: "/parent-corner", context: "generic" },
  { prefix: "/referrals", context: "generic" },
  { prefix: "/leaderboard", context: "generic" },
  { prefix: "/start-here", context: "generic" },
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
  };
  children: React.ReactNode;
}

export default function DashboardShell({ user, children }: DashboardShellProps) {
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

  return (
    <div className="min-h-screen bg-midnight-950">
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

        {/* Bottom padding on phones so content never hides behind the tab bar
            (bar is 4rem + the iOS safe-area inset). Reverts at md+. */}
        <main className="px-4 lg:px-8 pt-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-6">
          {freeLocked ? <FreeLocked context={lockedContext} /> : children}
        </main>
      </div>

      {/* App-style bottom tab bar — phones only, dashboard routes only. */}
      <MobileTabBar user={user} xp={xp} />

      <Suspense fallback={null}>
        <AppTour user={user} />
      </Suspense>

      {/* Silent push self-heal + platform-aware zero-friction enrollment. */}
      <NotificationOnboard />

      {/* Global toast host (enrollment confirmations, etc.). */}
      <Toaster />
    </div>
  );
}
