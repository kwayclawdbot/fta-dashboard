"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import DashboardSidebar from "./DashboardSidebar";
import DashboardTopBar from "./DashboardTopBar";
import MobileTabBar from "./MobileTabBar";
import FreeLocked from "./FreeLocked";
import AppTour from "@/components/tour/AppTour";
import { Suspense } from "react";

import type { FamilyTier } from "@/lib/tier";

// FREE-tier families may reach only these dashboard surfaces; every other route
// renders a locked upsell (centralized here rather than gating each page). Home
// (limited) and Community (read-only) handle their own free-state internally.
const FREE_ALLOWED_PREFIXES = [
  "/dashboard",
  "/community",
  "/settings",
  "/upgrade",
  "/help",
];

// Human labels for the lock screen, matched by longest prefix.
const LOCKED_LABELS: { prefix: string; label: string }[] = [
  { prefix: "/courses", label: "Courses" },
  { prefix: "/live-sessions", label: "Live classes" },
  { prefix: "/watchlist", label: "The family watchlist" },
  { prefix: "/missions", label: "Kid missions" },
  { prefix: "/flashcards", label: "Flashcards" },
  { prefix: "/games", label: "Practice games" },
  { prefix: "/chart", label: "The practice chart" },
  { prefix: "/simulator", label: "The trading simulator" },
  { prefix: "/picks", label: "Team Picks" },
  { prefix: "/progress", label: "Progress & badges" },
  { prefix: "/family", label: "Family & report cards" },
  { prefix: "/parent-corner", label: "Parent Corner" },
  { prefix: "/referrals", label: "Invite Families" },
  { prefix: "/leaderboard", label: "The leaderboard" },
  { prefix: "/start-here", label: "Start Here" },
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

  const isFree = (user.tier ?? "fic") === "free";
  const freeLocked =
    isFree &&
    !FREE_ALLOWED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
  const lockedLabel =
    LOCKED_LABELS.find((l) => pathname.startsWith(l.prefix))?.label ??
    "This feature";

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
          onMenuClick={() => setMobileOpen(true)}
        />

        {/* Bottom padding on phones so content never hides behind the tab bar
            (bar is 4rem + the iOS safe-area inset). Reverts at md+. */}
        <main className="px-4 lg:px-8 pt-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-6">
          {freeLocked ? <FreeLocked feature={lockedLabel} /> : children}
        </main>
      </div>

      {/* App-style bottom tab bar — phones only, dashboard routes only. */}
      <MobileTabBar user={user} />

      <Suspense fallback={null}>
        <AppTour user={user} />
      </Suspense>
    </div>
  );
}
