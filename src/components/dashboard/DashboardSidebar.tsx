"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { m, AnimatePresence } from "@/lib/motion";
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
  Sparkles,
  Target,
  Eye,
  Dumbbell,
  GraduationCap,
  ShieldCheck,
  Gem,
  LifeBuoy,
  ShoppingBag,
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
  /** Small pill after the label (e.g. gold "PRO" on the FTA Academy group). */
  badge?: string;
}

// ── Family Investing Club items ──────────────────────────────────────────────
// Scheme B (frequency-tiered) navigation, approved 2026-07-22. High-frequency
// club surfaces (Team Picks, Family Watchlist, Kid Missions) stay flat and one
// tap away; only the browse-not-daily Learn and Family groups nest. "This Week"
// is no longer a nav row — it lives as the Home page's "This Week in FIC" tab
// (the old /dashboard?tab=this-week nav item could never show active and just
// duplicated Home). Utility rows (Shop/Help/Settings/Admin) move OUT of the
// scrolling nav into a footer cluster (see getFooterItems). No routes move —
// groups reuse the existing subItems/childActive machinery.
const CLUB_WATCHLIST: NavItem = { label: "Family Watchlist", href: "/watchlist", icon: Eye };
const CLUB_MISSIONS: NavItem = { label: "Kid Missions", href: "/missions", icon: Target };
const CLUB_COMMUNITY: NavItem = { label: "Community", href: "/community", icon: MessageCircle };
const CLUB_PICKS: NavItem = { label: "Team Picks", href: "/picks", icon: Gem };

// Family group (parents only) — absorbs Parent Corner, Invite Families and My
// Progress alongside the family surfaces so parent tools live in one place.
const FAMILY_ITEM: NavItem = {
  label: "Family",
  href: "/family",
  icon: Users,
  parentOnly: true,
  subItems: [
    { label: "Overview & Report Cards", href: "/family/overview" },
    { label: "Leaderboard", href: "/family/leaderboard" },
    { label: "Members", href: "/family/members" },
    { label: "Parent Corner", href: "/parent-corner" },
    { label: "Invite Families", href: "/referrals" },
    { label: "My Progress", href: "/progress" },
  ],
};

/**
 * Learn group. For FIC families the label is "Learn"; for FTA families it
 * becomes a gold-badged "Academy" group (this replaces the old standalone
 * "FTA — Trading Academy" section header — the tier framing now rides on the
 * group label + badge). Young kids get the kid-worded variant (My Lessons /
 * My Cards). Start Here folds in here as a permanent refresher (it also lives
 * as a dismissible Home card during onboarding). Routes are NOT moved.
 */
function learnGroup(isFta: boolean, isKid: boolean): NavItem {
  if (isKid) {
    return {
      label: "Learn",
      href: "/courses",
      icon: GraduationCap,
      subItems: [
        { label: "My Lessons", href: "/courses" },
        { label: "Live Classes", href: "/live-sessions" },
        { label: "My Cards", href: "/flashcards" },
      ],
    };
  }
  return {
    label: isFta ? "Academy" : "Learn",
    href: "/courses",
    icon: GraduationCap,
    badge: isFta ? "PRO" : undefined,
    subItems: [
      { label: "Start Here", href: "/start-here" },
      { label: "Courses", href: "/courses" },
      { label: "Live Classes", href: "/live-sessions" },
      { label: "Flashcards", href: "/flashcards" },
    ],
  };
}

/**
 * Practice grouping: a single "Practice" tab whose subtabs are the
 * practice/study surfaces. Routes are NOT moved — this is navigation only, so
 * existing deep links to /chart, /simulator, /games keep working. The group
 * parent links to the Practice Chart (the primary practice surface); being on
 * ANY child route highlights + expands the group (see childActive in the
 * render). Young kids skip the Simulator subtab (kept age-appropriate).
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
 * Utility "footer" cluster — Shop / Help / Settings (+ Admin for admins). These
 * are rare-use rows, so they render in a visually distinct footer BELOW the
 * collapse toggle rather than eating into the ≤9 top-level scroll budget. Free
 * families skip Shop (no store upsell path yet); Admin points at /admin (the
 * neutral admin Dashboard landing), not the CRM.
 */
export function getFooterItems(role?: string, tier: FamilyTier = "fic"): NavItem[] {
  const items: NavItem[] = [];
  if (tier !== "free") {
    items.push({ label: "Shop", href: "/shop", icon: ShoppingBag });
  }
  items.push({ label: "Help", href: "/help", icon: LifeBuoy });
  items.push({ label: "Settings", href: "/settings", icon: Settings });
  if (role === "admin") {
    items.push({ label: "Admin", href: "/admin", icon: ShieldCheck });
  }
  return items;
}

/**
 * Scheme B — frequency-tiered navigation (approved 2026-07-22).
 * Returns only the PRIMARY nav rows (≤9 top-level). Utility rows live in
 * getFooterItems(). EVERY family runs on the Family Investing Club structure;
 * FTA reframes the Learn group as a premium "Academy" badge instead of a
 * separate section. Role filters (kid / teen / parent) still apply.
 */
export function getNavItems(role?: string, ageGroup?: string, tier: FamilyTier = "fic"): NavItem[] {
  const isChild = role === "child";
  const isKid = isChild && ageGroup === "kids";
  const canParent = role === "parent" || role === "admin";
  const isFta = tier === "fta";

  // ── Free tier (social-funnel signups): "give the tools, gate the guidance."
  //    Home (limited + journey checklist), read-only Community, the free courses
  //    sampler, Practice (chart + games), the Team Picks teaser, the Free Class
  //    hub, and a "Join FIC" upsell. Help/Settings live in the footer. ──
  if (tier === "free") {
    return [
      { label: "Home", href: "/dashboard", icon: LayoutDashboard },
      CLUB_COMMUNITY,
      { label: "Free Courses", href: "/courses", icon: BookOpen },
      practiceGroup(false), // chart + games (Candle Battle); simulator stays locked
      CLUB_PICKS,
      { label: "Free Class", href: "/free-class", icon: Video },
      { label: "Join FIC", href: "/upgrade", icon: Sparkles },
    ];
  }

  // ── Young kids (7 top-level): surface the play/earn loop flat, nest lessons.
  //    Community now appears on the kid DESKTOP nav too (it was mobile-only). ──
  if (isKid) {
    return [
      { label: "Kids Corner", href: "/dashboard", icon: LayoutDashboard },
      CLUB_COMMUNITY,
      CLUB_MISSIONS,
      CLUB_WATCHLIST,
      learnGroup(isFta, true), // My Lessons · Live Classes · My Cards
      practiceGroup(false), // chart + games only for young kids
      { label: "My Badges", href: "/progress", icon: Trophy },
    ];
  }

  // ── Teens + parents (both tiers). High-frequency club surfaces stay flat;
  //    Learn + Family nest. ──
  const main: NavItem[] = [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    CLUB_COMMUNITY,
    CLUB_PICKS,
    CLUB_WATCHLIST,
    CLUB_MISSIONS,
    learnGroup(isFta, false),
    practiceGroup(true),
  ];

  if (canParent) {
    main.push(FAMILY_ITEM);
    // FIC parents get a single "Upgrade to FTA" row (no section header).
    // Children never see billing, so it's parent-gated. FTA parents drop it.
    if (!isFta) {
      main.push({ label: "Upgrade to FTA", href: "/upgrade", icon: Sparkles });
    }
  } else {
    // Teens: My Progress flat (no Family group, no Upgrade).
    main.push({ label: "My Progress", href: "/progress", icon: Trophy });
  }

  return main;
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
  const footerItems = getFooterItems(user.role, user.tier);
  // Free + FIC families both live under the Family Investing Club brand; only
  // FTA flips the logo to the academy.
  const isFic = (user.tier ?? "fic") !== "fta";
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
                {!collapsed && item.badge && (
                  <span className="ml-auto shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gold-400/20 text-gold-700">
                    {item.badge}
                  </span>
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

      {/* Footer utility cluster — Shop / Help / Settings (+ Admin). Rare-use
          rows, visually muted and set apart from the primary nav above. */}
      <div className="px-3 pt-2 pb-1 border-t border-midnight-800/50 bg-midnight-950/40 space-y-0.5">
        {footerItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              title={item.label}
              className={`
                flex items-center gap-3 px-3 py-1.5 rounded-md text-[13px] transition-colors
                ${collapsed ? "justify-center" : ""}
                ${active
                  ? "text-gold-700 bg-gold-400/10"
                  : "text-midnight-400 hover:text-midnight-200 hover:bg-midnight-800/40"
                }
              `}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
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
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            />
            <m.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "tween", duration: 0.2 }}
              className="fixed top-0 left-0 h-screen w-60 bg-midnight-900 border-r border-midnight-700/50 z-50 lg:hidden"
            >
              {sidebarContent}
            </m.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
