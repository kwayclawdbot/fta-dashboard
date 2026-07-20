"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Video,
  MessageCircle,
  Trophy,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  LineChart,
  Gamepad2,
  Layers,
  Compass,
  Sparkles,
  Target,
  Eye,
  Heart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FamilyTier } from "@/lib/tier";

interface SubNavItem {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  subItems?: SubNavItem[];
  parentOnly?: boolean;
  /** Renders as a non-clickable section label instead of a link. */
  sectionHeader?: boolean;
}

// ── Family Investing Club items (owner plan §9) ──────────────────────────────
// "This Week" is a subtab on the home page, so it deep-links there.
const CLUB_START_HERE: NavItem = { label: "Start Here", href: "/start-here", icon: Compass };
const CLUB_THIS_WEEK: NavItem = { label: "This Week", href: "/dashboard?tab=this-week", icon: Sparkles };
const CLUB_WATCHLIST: NavItem = { label: "Family Watchlist", href: "/watchlist", icon: Eye };
const CLUB_MISSIONS: NavItem = { label: "Kid Missions", href: "/missions", icon: Target };
const CLUB_CHART: NavItem = { label: "Practice Chart", href: "/chart", icon: LineChart };
const CLUB_PARENT_CORNER: NavItem = { label: "Parent Corner", href: "/parent-corner", icon: Heart };

const FAMILY_ITEM: NavItem = {
  label: "Family",
  href: "/family",
  icon: Users,
  parentOnly: true,
  subItems: [
    { label: "Overview & Report Cards", href: "/family/overview" },
    { label: "Leaderboard", href: "/family/leaderboard" },
    { label: "Members", href: "/family/members" },
  ],
};

// The existing FTA program navigation (unchanged), by role.
function ftaBaseNav(role: string | undefined, isKid: boolean, isChild: boolean): NavItem[] {
  if (isKid) {
    return [
      { label: "Kids Corner", href: "/dashboard", icon: LayoutDashboard },
      { label: "My Lessons", href: "/courses", icon: BookOpen },
      { label: "Games", href: "/games", icon: Gamepad2 },
      { label: "My Cards", href: "/flashcards", icon: Layers },
      { label: "My Badges", href: "/progress", icon: Trophy },
      { label: "Settings", href: "/settings", icon: Settings },
    ];
  }
  if (isChild) {
    return [
      { label: "Home", href: "/dashboard", icon: LayoutDashboard },
      { label: "Courses", href: "/courses", icon: BookOpen },
      { label: "Live Classes", href: "/live-sessions", icon: Video },
      {
        label: "Practice",
        href: "/simulator",
        icon: LineChart,
        subItems: [
          { label: "Trading Floor", href: "/simulator" },
          { label: "Pattern Practice", href: "/simulator/lessons" },
          { label: "Leaderboard", href: "/simulator/leaderboard" },
        ],
      },
      { label: "Games", href: "/games", icon: Gamepad2 },
      { label: "Flashcards", href: "/flashcards", icon: Layers },
      { label: "Community", href: "/community", icon: MessageCircle },
      { label: "My Progress", href: "/progress", icon: Trophy },
      { label: "Settings", href: "/settings", icon: Settings },
    ];
  }
  return [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    { label: "Courses", href: "/courses", icon: BookOpen },
    { label: "Live Classes", href: "/live-sessions", icon: Video },
    FAMILY_ITEM,
    { label: "Community", href: "/community", icon: MessageCircle },
    {
      label: "Simulator",
      href: "/simulator",
      icon: LineChart,
      subItems: [
        { label: "Trading Floor", href: "/simulator" },
        { label: "Pattern Practice", href: "/simulator/lessons" },
        { label: "Leaderboard", href: "/simulator/leaderboard" },
      ],
    },
    { label: "Games", href: "/games", icon: Gamepad2 },
    { label: "Flashcards", href: "/flashcards", icon: Layers },
    { label: "Progress", href: "/progress", icon: Trophy },
    { label: "Settings", href: "/settings", icon: Settings },
  ];
}

/**
 * Tier + role aware navigation.
 * - FIC families get the club nav (plan §9).
 * - FTA families (full access) get the FTA program nav PLUS a "Family
 *   Investing Club" section, since FTA unlocks everything FIC has.
 */
function getNavItems(role?: string, ageGroup?: string, tier: FamilyTier = "fic"): NavItem[] {
  const isChild = role === "child";
  const isKid = isChild && ageGroup === "kids";
  const canParent = role === "parent" || role === "admin";

  if (tier === "fta") {
    const base = ftaBaseNav(role, isKid, isChild);
    // Insert the club section just before Settings so Settings stays last.
    const settings = base.pop()!; // Settings is always the final base item
    const club: NavItem[] = [
      { label: "Family Investing Club", href: "#fic", icon: Sparkles, sectionHeader: true },
      CLUB_START_HERE,
      CLUB_THIS_WEEK,
      CLUB_WATCHLIST,
      CLUB_MISSIONS,
      CLUB_CHART,
      ...(canParent ? [CLUB_PARENT_CORNER] : []),
    ];
    return [...base, ...club, settings];
  }

  // FIC nav (plan §9).
  if (isKid) {
    return [
      { label: "Kids Corner", href: "/dashboard", icon: LayoutDashboard },
      CLUB_START_HERE,
      CLUB_THIS_WEEK,
      { label: "My Lessons", href: "/courses", icon: BookOpen },
      { label: "Live Classes", href: "/live-sessions", icon: Video },
      CLUB_MISSIONS,
      CLUB_WATCHLIST,
      CLUB_CHART,
      { label: "Games", href: "/games", icon: Gamepad2 },
      { label: "My Cards", href: "/flashcards", icon: Layers },
      { label: "My Badges", href: "/progress", icon: Trophy },
      { label: "Settings", href: "/settings", icon: Settings },
    ];
  }

  const ficCommon: NavItem[] = [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    CLUB_START_HERE,
    CLUB_THIS_WEEK,
    { label: "Courses", href: "/courses", icon: BookOpen },
    { label: "Live Classes", href: "/live-sessions", icon: Video },
    CLUB_WATCHLIST,
    CLUB_MISSIONS,
    CLUB_CHART,
    { label: "Flashcards", href: "/flashcards", icon: Layers },
    { label: "Games", href: "/games", icon: Gamepad2 },
    { label: "Community", href: "/community", icon: MessageCircle },
    { label: "My Progress", href: "/progress", icon: Trophy },
  ];

  if (isChild) {
    // Teens — no parent-only sections.
    return [...ficCommon, { label: "Settings", href: "/settings", icon: Settings }];
  }

  // Parents (and coach/admin).
  return [
    ...ficCommon,
    CLUB_PARENT_CORNER,
    FAMILY_ITEM,
    { label: "Settings", href: "/settings", icon: Settings },
  ];
}

interface DashboardSidebarProps {
  user: {
    email?: string;
    display_name?: string;
    role?: string;
    age_group?: string;
    tier?: FamilyTier;
  };
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function DashboardSidebar({
  user,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = getNavItems(user.role, user.age_group, user.tier);
  const isFic = (user.tier ?? "fic") === "fic";
  const supabase = createClient();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = (user.display_name || user.email || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-midnight-700/50">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="font-display text-lg font-bold text-gold-600">
            {collapsed ? "F" : isFic ? "FIC" : "FTA"}
          </span>
          {!collapsed && (
            <span className="text-[11px] text-midnight-400 font-body hidden lg:block">
              {isFic ? "Family Investing Club" : "Family Trading Academy"}
            </span>
          )}
        </Link>
        {/* Mobile close */}
        <button
          onClick={onMobileClose}
          className="lg:hidden text-midnight-400 hover:text-midnight-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          if (item.sectionHeader) {
            if (collapsed) {
              return (
                <div
                  key={item.href}
                  className="my-2 mx-3 border-t border-midnight-700/50"
                />
              );
            }
            return (
              <div key={item.href} className="px-3 pt-4 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-midnight-500">
                  {item.label}
                </span>
              </div>
            );
          }
          const isActive = pathname === item.href;
          const isParentActive = pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          const showSubItems =
            !collapsed &&
            item.subItems &&
            (isActive || isParentActive) &&
            (!item.parentOnly || user.role === "parent");

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={onMobileClose}
                className={`
                  relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
                  ${isActive || isParentActive
                    ? "text-gold-700 bg-gold-400/15"
                    : "text-midnight-300 hover:text-midnight-100 hover:bg-midnight-800/50"
                  }
                `}
              >
                {(isActive || isParentActive) && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gold-500" />
                )}
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && (
                  <span className="truncate font-medium">{item.label}</span>
                )}
              </Link>
              {showSubItems && (
                <div className="ml-9 mt-0.5 space-y-0.5">
                  {item.subItems!.map((sub) => {
                    const subActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={onMobileClose}
                        className={`
                          block px-3 py-1.5 rounded-md text-xs transition-colors
                          ${subActive
                            ? "text-gold-700"
                            : "text-midnight-400 hover:text-midnight-200"
                          }
                        `}
                      >
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden lg:block px-3 py-2 border-t border-midnight-800/50">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center py-2 rounded-md text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800/50 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* User / Logout */}
      <div className="px-3 py-4 border-t border-midnight-800/50">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-7 h-7 rounded-full bg-gold-400/20 flex items-center justify-center text-gold-700 text-[11px] font-bold font-display shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-midnight-100 truncate">
                {user.display_name || "Trader"}
              </p>
              <p className="text-[11px] text-midnight-500 truncate">
                {user.email}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={`
            flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-midnight-400 hover:text-red-500 hover:bg-red-500/5 transition-colors
            ${collapsed ? "justify-center" : ""}
          `}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>{loggingOut ? "Logging out..." : "Logout"}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col fixed top-0 left-0 h-screen bg-midnight-900 border-r border-midnight-700/50 z-30 transition-all duration-300
          ${collapsed ? "w-[72px]" : "w-60"}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "tween", duration: 0.2 }}
              className="fixed top-0 left-0 h-screen w-60 bg-midnight-900 border-r border-midnight-700/50 z-50 lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
