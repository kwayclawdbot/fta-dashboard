"use client";

import { useState } from "react";
import DashboardSidebar from "./DashboardSidebar";
import DashboardTopBar from "./DashboardTopBar";
import MobileTabBar from "./MobileTabBar";

import type { FamilyTier } from "@/lib/tier";

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
          {children}
        </main>
      </div>

      {/* App-style bottom tab bar — phones only, dashboard routes only. */}
      <MobileTabBar user={user} />
    </div>
  );
}
