"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, m } from "@/lib/motion";
import { Menu, ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import CommandSearch from "@/components/search/CommandSearch";
import type { FamilyTier } from "@/lib/tier";
import { modeFromSolo } from "@/lib/mode";
import TierBadge from "@/components/TierBadge";
import Avatar from "@/components/Avatar";
import BeltChip from "@/components/dashboard/BeltChip";
import { designV2Enabled } from "@/lib/design-flag";
import TopBarV2 from "./v2/TopBarV2";

/**
 * Route → page title, derived so EVERY dashboard route has a real header (the
 * old 13-entry map fell back to "Home" on most pages). Ordered longest-prefix
 * first so nested routes (/family/overview, /simulator/lessons) win before
 * their parents. A match is exact or a path segment below the prefix. Kid
 * personas get the kid-worded labels used in their nav (Kids Corner / My
 * Lessons / My Cards / My Badges) so the header matches the sidebar.
 *
 * A ROUTE MISSING FROM THIS MAP DOES NOT FALL BACK GRACEFULLY — it falls back
 * to "Home", which is a lie about where you are and, on a phone, the only
 * label on screen. /circles, /belts and /vip-room were all shipping as "Home".
 * Anything added under (dashboard) belongs here.
 */
const ROUTE_TITLES: [string, string][] = [
  ["/fta/chat", "FTA Traders Chat"],
  ["/fta/courses", "FTA Course Library"],
  ["/fta/recordings", "FTA Recordings"],
  ["/fta", "FTA — Trading Academy"],
  ["/simulator/lessons", "Pattern Practice"],
  ["/simulator/simbot", "Simbot"],
  ["/simulator", "Trading Floor"],
  ["/family/corner", "Parent Corner"],
  ["/family/overview", "Family Overview"],
  ["/family/members", "Family Members"],
  ["/family", "Family"],
  ["/onboarding/profile", "About Your Family"],
  ["/onboarding", "Welcome"],
  ["/dashboard", "Home"],
  ["/discover", "Discover"],
  ["/community", "The Club"],
  ["/research", "Research"],
  ["/watchlist/community", "Community Watchlist"],
  // The member's own board. Register-aware — see WATCHLIST_TITLE below.
  ["/watchlist", "Family Watchlist"],
  ["/screener", "Stock Screener"],
  ["/circles", "Circles"],
  ["/belts", "Belts"],
  ["/vip-room", "VIP Room"],
  ["/alerts", "Alerts"],
  ["/kai", "Ask Kai"],
  ["/news", "Newsroom"],
  ["/pricing", "Pricing"],
  ["/missions", "Missions"],
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

/**
 * REGISTER-AWARE TITLES. A solo Club member has no household, so "Family
 * Watchlist" is a header about somebody else's product. The sidebar already
 * splits these two labels ("My Family" for a household, "My Watchlist" for a
 * solo member) and the header was the last place still saying Family to
 * everyone. Keyed by route prefix so more can join without another branch.
 */
const SOLO_TITLE_OVERRIDES: Record<string, string> = {
  "/watchlist": "My Watchlist",
};

function resolveTitle(pathname: string, isKid: boolean, isSolo: boolean): string {
  for (const [prefix, title] of ROUTE_TITLES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      if (isKid && KID_TITLE_OVERRIDES[prefix]) return KID_TITLE_OVERRIDES[prefix];
      if (isSolo && SOLO_TITLE_OVERRIDES[prefix]) return SOLO_TITLE_OVERRIDES[prefix];
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
    isSolo?: boolean;
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
  const pageTitle = resolveTitle(pathname, isKid, !!user.isSolo);
  const mode = modeFromSolo(user.isSolo);

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

  // v2 conversion (design-project-v2). After all hooks; reuses the resolved
  // page title + mode above. Off ⇒ v1 header renders byte-identically below.
  if (designV2Enabled()) {
    const initials = (user.display_name || user.email || "U")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    return (
      <TopBarV2
        user={user}
        xp={xp}
        pageTitle={pageTitle}
        initials={initials}
        onMenuClick={onMenuClick}
      />
    );
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
          {/* Compact page title — mobile + tablet only. On desktop (lg+) the shell
              stops duplicating the title the surface already announces via its own
              PageIntro; global search takes its place. */}
          <h1 className="font-display text-base font-semibold text-midnight-100 lg:hidden">
            {pageTitle}
          </h1>
        </div>

        {/* Right: universal search, belt chip, notifications, avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Universal ⌘K command surface — search + Ask Kai + Stock Finder. */}
          <CommandSearch />
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
                      {user.tier && <TierBadge tier={user.tier} size="xs" mode={mode} />}
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
