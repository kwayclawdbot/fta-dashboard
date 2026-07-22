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
  Dumbbell,
  GraduationCap,
  Gift,
  ShieldCheck,
  Gem,
  LifeBuoy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FamilyTier } from "@/lib/tier";

export interface SubNavItem {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  subItems?: SubNavItem[];
  parentOnly?: boolean;
  /** Renders as a non-clickable section label instead of a link. */
  sectionHeader?: boolean;
}

// ── Family Investing Club items (owner plan §9) ──────────────────────────────
// The club experience is the PRIMARY dashboard for EVERY family (FIC + FTA).
// FTA is an add-on academy that renders as its own labeled subsection below.
// "This Week" is a subtab on the home page, so it deep-links there.
const CLUB_START_HERE: NavItem = { label: "Start Here", href: "/start-here", icon: Compass };
const CLUB_THIS_WEEK: NavItem = { label: "This Week", href: "/dashboard?tab=this-week", icon: Sparkles };
const CLUB_WATCHLIST: NavItem = { label: "Family Watchlist", href: "/watchlist", icon: Eye };
const CLUB_MISSIONS: NavItem = { label: "Kid Missions", href: "/missions", icon: Target };
const CLUB_PARENT_CORNER: NavItem = { label: "Parent Corner", href: "/parent-corner", icon: Heart };
const CLUB_REFERRALS: NavItem = { label: "Invite Families", href: "/referrals", icon: Gift, parentOnly: true };
const CLUB_FLASHCARDS: NavItem = { label: "Flashcards", href: "/flashcards", icon: Layers };
const CLUB_COMMUNITY: NavItem = { label: "Community", href: "/community", icon: MessageCircle };
const CLUB_PICKS: NavItem = { label: "Team Picks", href: "/picks", icon: Gem };

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

/**
 * Practice grouping (owner decision): a single "Practice" tab whose subtabs are
 * the practice/study surfaces. Routes are NOT moved — this is navigation only,
 * so existing deep links to /chart, /simulator, /games keep working. The group
 * parent links to the Practice Chart (the primary practice surface, plan §8);
 * being on ANY child route highlights + expands the group (see childActive in
 * the render). Young kids skip the Simulator subtab (kept age-appropriate,
 * matching prior kid nav which showed only chart + games).
 */
function practiceGroup(includeSimulator: boolean): NavItem {
  return {
    label: "Practice",
    href: "/chart",
    icon: Dumbbell,
    subItems: [
      { label: "Practice Chart", href: "/chart" },
      ...(includeSimulator ? [{ label: "Simulator", href: "/simulator" }] : []),
      { label: "Games", href: "/games" },
    ],
  };
}

/**
 * Tier + role aware navigation (owner inversion 2026-07-20).
 * - EVERY family gets the Family Investing Club nav as the primary structure —
 *   the club IS the dashboard.
 * - FTA families additionally get a clearly-labeled "FTA — Trading Academy"
 *   subsection with their advanced courses + academy live classes. FIC families
 *   see a tasteful upgrade teaser instead (parents only; /upgrade is
 *   parent-gated) and never the FTA subsection.
 * - Role filters (kid / teen / parent) still apply.
 */
export function getNavItems(role?: string, ageGroup?: string, tier: FamilyTier = "fic"): NavItem[] {
  const isChild = role === "child";
  const isKid = isChild && ageGroup === "kids";
  const canParent = role === "parent" || role === "admin";
  const isFta = tier === "fta";
  const settings: NavItem = { label: "Settings", href: "/settings", icon: Settings };
  // Help desk — available to EVERY role (kids included; the bot copy is kid-safe).
  const help: NavItem = { label: "Help", href: "/help", icon: LifeBuoy };
  // Admins get a way back into the admin console from the member side.
  const adminItems: NavItem[] =
    role === "admin" ? [{ label: "Admin", href: "/admin/crm", icon: ShieldCheck }] : [];

  // ── Young kids: simple flat club nav (tier-agnostic; the FIC/FTA split is a
  // parent-facing concept — kids just consume whatever their family unlocks). ──
  if (isKid) {
    return [
      { label: "Kids Corner", href: "/dashboard", icon: LayoutDashboard },
      CLUB_START_HERE,
      CLUB_THIS_WEEK,
      { label: "My Lessons", href: "/courses", icon: BookOpen },
      { label: "Live Classes", href: "/live-sessions", icon: Video },
      CLUB_MISSIONS,
      CLUB_WATCHLIST,
      practiceGroup(false), // chart + games only for young kids
      { label: "My Cards", href: "/flashcards", icon: Layers },
      { label: "My Badges", href: "/progress", icon: Trophy },
      help,
      settings,
    ];
  }

  // Learning surfaces (courses + live classes). For FIC these sit in the primary
  // club nav (their foundations + weekly class). For FTA they move into the
  // dedicated academy subsection so they read as the premium add-on.
  const learning: NavItem[] = [
    { label: "Courses", href: "/courses", icon: BookOpen },
    { label: "Live Classes", href: "/live-sessions", icon: Video },
  ];

  // ── Primary FIC club nav (teens + parents, both tiers). ──
  const clubPrimary: NavItem[] = [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    CLUB_COMMUNITY,
    CLUB_PICKS,
    CLUB_START_HERE,
    CLUB_THIS_WEEK,
    ...(isFta ? [] : learning),
    CLUB_WATCHLIST,
    CLUB_MISSIONS,
    practiceGroup(true),
    CLUB_FLASHCARDS,
    { label: "My Progress", href: "/progress", icon: Trophy },
    ...(canParent ? [FAMILY_ITEM, CLUB_PARENT_CORNER, CLUB_REFERRALS] : []),
  ];

  if (isFta) {
    // FTA is the add-on: a clearly-labeled academy subsection. Courses + live
    // classes live here for FTA families (their advanced curriculum + academy
    // sessions render on these tier-aware pages).
    const ftaSection: NavItem[] = [
      { label: "FTA — Trading Academy", href: "#fta", icon: GraduationCap, sectionHeader: true },
      { label: "Courses", href: "/courses", icon: BookOpen },
      { label: "Live Classes", href: "/live-sessions", icon: Video },
    ];
    return [...clubPrimary, ...ftaSection, ...adminItems, help, settings];
  }

  // FIC parents: tasteful upgrade teaser mirroring the courses/upgrade pitch
  // (Sparkles → /upgrade). Children never see billing, so gate to parents.
  const upgradeTease: NavItem[] = canParent
    ? [
        { label: "Trading Academy", href: "#upgrade", icon: GraduationCap, sectionHeader: true },
        { label: "Upgrade to FTA", href: "/upgrade", icon: Sparkles },
      ]
    : [];

  return [...clubPrimary, ...upgradeTease, ...adminItems, help, settings];
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
          // Groups whose subItems are sibling top-level routes (e.g. Practice →
          // /chart, /simulator, /games) also count as active when the current
          // route matches any child, so the group highlights + expands there.
          const childActive =
            item.subItems?.some(
              (s) => pathname === s.href || pathname.startsWith(s.href + "/")
            ) ?? false;
          const active = isActive || isParentActive || childActive;
          const Icon = item.icon;
          const showSubItems =
            !collapsed &&
            item.subItems &&
            active &&
            (!item.parentOnly || user.role === "parent");

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                data-tour={"nav:" + item.href}
                onClick={onMobileClose}
                className={`
                  relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
                  ${active
                    ? "text-gold-700 bg-gold-400/15"
                    : "text-midnight-300 hover:text-midnight-100 hover:bg-midnight-800/50"
                  }
                `}
              >
                {active && (
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
