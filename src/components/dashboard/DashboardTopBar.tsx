"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, m } from "@/lib/motion";
import { Menu, ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import type { FamilyTier } from "@/lib/tier";
import TierBadge from "@/components/TierBadge";
import Avatar from "@/components/Avatar";
import BeltChip from "@/components/dashboard/BeltChip";

/**
 * Route → page title, derived so EVERY dashboard route has a real header (the
 * old 13-entry map fell back to "Home" on most pages). Ordered longest-prefix
 * first so nested routes (/family/overview, /simulator/lessons) win before
 * their parents. A match is exact or a path segment below the prefix. Kid
 * personas get the kid-worded labels used in their nav (Kids Corner / My
 * Lessons / My Cards / My Badges) so the header matches the sidebar.
 */
const ROUTE_TITLES: [string, string][] = [
  ["/fta/chat", "FTA Traders Chat"],
  ["/fta/courses", "FTA Course Library"],
  ["/fta/recordings", "FTA Recordings"],
  ["/fta", "FTA — Trading Academy"],
  ["/simulator/lessons", "Pattern Practice"],
  ["/simulator/simbot", "Simbot"],
  ["/simulator", "Trading Floor"],
  ["/family/overview", "Family Overview"],
  ["/family/members", "Family Members"],
  ["/family", "Family"],
  ["/onboarding/profile", "About Your Family"],
  ["/onboarding", "Welcome"],
  ["/dashboard", "Home"],
  ["/community", "Community"],
  ["/research", "Research"],
  ["/watchlist/community", "Community Watchlist"],
  ["/watchlist", "Family Watchlist"],
  ["/screener", "Stock Screener"],
  ["/missions", "Kid Missions"],
  ["/courses", "Courses"],
  ["/live-sessions", "Live Classes"],
  ["/flashcards", "Flashcards"],
  ["/start-here", "Start Here"],
  ["/chart", "Practice Chart"],
  ["/games", "Games"],
  ["/progress", "My Progress"],
  ["/parent-corner", "Parent Corner"],
  ["/referrals", "Refer Families"],
  ["/leaderboard", "Leaderboard"],
  ["/upgrade", "Upgrade"],
  ["/shop", "Shop"],
  ["/help", "Help"],
  ["/settings", "Settings"],
  ["/free-class", "Free Class"],
  ["/u", "Profile"],
];

// Kid-worded overrides — the same routes the kid nav relabels.
const KID_TITLE_OVERRIDES: Record<string, string> = {
  "/dashboard": "Kids Corner",
  "/simulator/simbot": "Simbot",
  "/courses": "My Lessons",
  "/flashcards": "My Cards",
  "/progress": "My Badges",
  "/missions": "Missions",
};

function resolveTitle(pathname: string, isKid: boolean): string {
  for (const [prefix, title] of ROUTE_TITLES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      if (isKid && KID_TITLE_OVERRIDES[prefix]) return KID_TITLE_OVERRIDES[prefix];
      return title;
    }
  }
  return isKid ? "Kids Corner" : "Home";
}

interface DashboardTopBarProps {
  user: {
    email?: string;
    display_name?: string;
    avatar_url?: string;
    role?: string;
    age_group?: string;
    tier?: FamilyTier;
  };
  /** Lifetime XP for the belt chip (null while loading). */
  xp?: number | null;
  onMenuClick: () => void;
}

export default function DashboardTopBar({ user, xp = null, onMenuClick }: DashboardTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isKid = user.role === "child" && user.age_group === "kids";
  const pageTitle = resolveTitle(pathname, isKid);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 bg-midnight-950/90 backdrop-blur-md border-b border-midnight-700/50">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        {/* Left: hamburger + title */}
        <div className="flex items-center gap-3">
          {/* Tablet-only hamburger (md–lg). Phones navigate via the bottom tab
              bar + More sheet; desktop (lg+) uses the sidebar. */}
          <button
            onClick={onMenuClick}
            className="hidden md:block lg:hidden text-midnight-300 hover:text-midnight-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-display text-base font-semibold text-midnight-100">
            {pageTitle}
          </h1>
        </div>

        {/* Right: belt chip, notifications, avatar */}
        <div className="flex items-center gap-3">
          {/* Belt chip — persistent self-visibility (sm+; phones use the More
              sheet header). Links to the Leaderboard. */}
          <span data-tour="belt" className="inline-flex">
            <BeltChip xp={xp} variant="compact" />
          </span>

          {/* Notification bell — live unread count + dropdown */}
          <span data-tour="bell" className="inline-flex"><NotificationsBell /></span>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Avatar
                name={user.display_name || user.email}
                avatarUrl={user.avatar_url}
                tier={user.tier}
                size="sm"
              />
              <ChevronDown className="w-3 h-3 text-midnight-400 hidden sm:block" />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <m.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 mt-2 w-52 rounded-lg bg-midnight-900 border border-midnight-700 shadow-lg shadow-ink/10 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-midnight-800">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-midnight-100 truncate">
                        {user.display_name || "Trader"}
                      </p>
                      {user.tier && <TierBadge tier={user.tier} size="xs" />}
                    </div>
                    <p className="text-xs text-midnight-500 truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-midnight-300 hover:text-midnight-100 hover:bg-midnight-800 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-midnight-300 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
