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
  Medal,
  Users,
  User,
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
  LifeBuoy,
  ShoppingBag,
  Lock,
  Radio,
  Film,
  Bot,
  Telescope,
  Newspaper,
  Bell,
  Compass,
  Gift,
  Award,
  Layers,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FamilyTier } from "@/lib/tier";
import { modeFromSolo, modeBrand } from "@/lib/mode";
import { ClubMark, ClubWordmark } from "@/components/brand/ClubMark";
import { designV2Enabled } from "@/lib/design-flag";
import SidebarV2 from "./v2/SidebarV2";

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
  /** Marks the gold "FTA — Trading Academy" section: a top divider, gold accent
   *  chrome, PRO identity, and (unlike ordinary groups) always-expanded
   *  subItems so it reads as a distinct hub section, not a collapsible row. */
  fta?: boolean;
  /** FIC-only teaser variant of the FTA section — a single locked row that
   *  links to /upgrade instead of expanding into the hub. */
  locked?: boolean;
  /** Persistent accent treatment (volt-orange icon) even when inactive — used to
   *  keep Community prominent in the club (individual) five-item scheme, the
   *  desktop counterpart of the elevated center tab on mobile. */
  accent?: boolean;
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
// Watchlist is now an umbrella group: the flagship Community Board + the
// private Family board. Parent links to the communal board (the flagship);
// being on either surface highlights + expands the group. (Team Picks retired —
// absorbed into the Community Board.)
const CLUB_WATCHLIST: NavItem = {
  label: "Watchlist",
  href: "/watchlist/community",
  icon: Eye,
  subItems: [
    { label: "Community Board", href: "/watchlist/community" },
    { label: "My Family", href: "/watchlist" },
  ],
};
const CLUB_SCREENER: NavItem = { label: "Screener", href: "/screener", icon: Telescope };
// Ownership Cards — the Collection shelf (Cheat Code Ownership Cards, Phase 0).
const CLUB_COLLECTION: NavItem = { label: "Collection", href: "/collection", icon: Layers };
const CLUB_MISSIONS: NavItem = { label: "Kid Missions", href: "/missions", icon: Target };
// Community is now a plain row — the club Feed. (Lane 12A: the Club Newsroom
// was promoted OUT to its own top-level "News" row below. On mobile Community
// is a tab-bar button, so nesting News under it buried it; owner directive is
// News = its own top-level row on every tier. With only Feed left, a group
// wrapper is redundant, so Community flattens to a single row.)
const CLUB_COMMUNITY: NavItem = {
  label: "Club",
  href: "/community",
  icon: MessageCircle,
};
// Canvas v2 adds two club destinations that are places, not actions: the
// Changed My Mind feed and Circles. They nest under Club rather than taking
// top-level rows — the five-item primary is the constraint, and this is the
// same umbrella pattern Watchlist already uses. "Share your call" is
// deliberately NOT here: composing is an action, reached from the feed and the
// in-surface rail, and a nav row that opens a composer reads as a place.
// Young kids keep the plain CLUB_COMMUNITY row: RLS lets a minor READ a Circle
// but never open, join or post in one, so surfacing it to them advertises a
// door that will not open.
const CLUB_COMMUNITY_HUB: NavItem = {
  ...CLUB_COMMUNITY,
  subItems: [
    { label: "Club Feed", href: "/community" },
    { label: "Changed my mind", href: "/community/changed-my-mind" },
    { label: "Circles", href: "/circles" },
  ],
};
// Belts render the XP ladder (White → Yellow → Blue → Purple → Black). It sits
// with standing/growth, next to Leaderboard and Progress — not in Learn.
const CLUB_BELTS: NavItem = { label: "Belts", href: "/belts", icon: Award };

// ── Cheat Code Club — five-item scheme (individual/club mode, R2) ─────────────
// The individual (solo adult) member runs the redesigned five-item nav:
//   Home · Discover · Community (prominent) · Watchlist · Profile/More.
// Discover is the NEW discovery hub (news + trending + research + stock finder);
// Community carries a persistent accent so it reads prominent (the desktop
// counterpart of the elevated center tab on mobile).
const CLUB_DISCOVER: NavItem = { label: "Discover", href: "/discover", icon: Compass };
const CLUB_COMMUNITY_PROMINENT: NavItem = { ...CLUB_COMMUNITY_HUB, accent: true };
// Individual watchlist umbrella: the flagship Community Board + the member's own
// private watchlist ("My Watchlist" — the solo counterpart of "My Family").
const CLUB_WATCHLIST_SOLO: NavItem = {
  label: "Watchlist",
  href: "/watchlist/community",
  icon: Eye,
  subItems: [
    { label: "Community Board", href: "/watchlist/community" },
    { label: "My Watchlist", href: "/watchlist" },
  ],
};
const CLUB_REFER: NavItem = { label: "Refer a friend", href: "/referrals", icon: Gift };
const CLUB_PROGRESS: NavItem = { label: "My Progress", href: "/progress", icon: Trophy };
// Quiet section labels that group the club (individual) sidebar's SECONDARY
// cluster into meaning-based buckets instead of one flat "More" list — the
// desktop counterpart of the Profile/More sheet's grouped rows. These render as
// non-clickable uppercase labels (neutral chrome; no accent tokens). Distinct
// hrefs keep their React keys unique. Order below: LEARN (education) · MARKETS
// (market intelligence tools) · ACCOUNT (your standing + growth), then the FTA
// hub keeps its own gold treatment at the tail.
const CLUB_LEARN_HEADER: NavItem = {
  label: "Learn",
  href: "#club-learn",
  icon: MessageCircle,
  sectionHeader: true,
};
const CLUB_MARKETS_HEADER: NavItem = {
  label: "Markets",
  href: "#club-markets",
  icon: MessageCircle,
  sectionHeader: true,
};
const CLUB_ACCOUNT_HEADER: NavItem = {
  label: "Account",
  href: "#club-account",
  icon: MessageCircle,
  sectionHeader: true,
};
// Same secondary-cluster header for the FAMILY (teen/parent) nav — parity with
// the club's primary+More grouping so the family sidebar no longer renders one
// long flat list. Distinct href keeps its React key unique.
const FAMILY_MORE_HEADER: NavItem = {
  label: "More",
  href: "#family-more",
  icon: MessageCircle,
  sectionHeader: true,
};
// News — the Club Newsroom (Lane 10 AI-narrated market recaps, funnel-bait so
// it stays reachable on every tier incl. free + kids). Its own top-level row on
// desktop sidebar AND the mobile More sheet (inherited from getNavItems);
// tab-bar slots are unchanged (News is not a tab). Newspaper icon.
const CLUB_NEWS: NavItem = { label: "News", href: "/news", icon: Newspaper };
// The unified belts leaderboard — a proper nav row for every member role
// (kids included; kid-vs-kid competition is owner-wanted). Was a near-orphan
// linked only from /progress. Medal icon keeps it distinct from the Trophy used
// by My Progress / My Badges.
const LEADERBOARD: NavItem = { label: "Leaderboard", href: "/leaderboard", icon: Medal };
// "Ask Kai" — CheatCode's AI research analyst. All member roles (kids get an
// age-aware Kai); NEVER free tier (chat is members-only, gated server-side).
const KAI_ASK: NavItem = { label: "Ask Kai", href: "/kai", icon: Bot };
// Trade Alerts hub (Lane C6) — an ADULTS-ONLY surface. The /alerts page hard
// redirects kids/teens and shows a LockedState to free tier, so this row is
// pushed ONLY inside the canParent (parent/admin = adult) branch below. Never
// added to the shared `main` array (reused by teens) or the free/kid returns.
const CLUB_ALERTS: NavItem = { label: "Alerts", href: "/alerts", icon: Bell };

// Family group (parents only) — absorbs Parent Corner, Invite Families and My
// Progress alongside the family surfaces so parent tools live in one place.
const FAMILY_ITEM: NavItem = {
  label: "Family",
  href: "/family",
  icon: Users,
  parentOnly: true,
  subItems: [
    { label: "Overview & Report Cards", href: "/family/overview" },
    { label: "Members", href: "/family/members" },
    // Points at the canvas board F8 directly. `/parent-corner` still resolves
    // (it redirects here), but the nav should not route through a redirect.
    { label: "Parent Corner", href: "/family/corner" },
    { label: "Refer Families", href: "/referrals" },
    { label: "My Progress", href: "/progress" },
  ],
};

// Solo (individual, non-parent) owners: a family of one. Replaces the "Family"
// group so no kid/parent surfaces are pushed at them — but keeps the essentials
// the group carried (My Progress + referrals) reachable from one "Account" row.
// Report Cards / Members / Parent Corner are family-only and simply drop out.
const SOLO_ACCOUNT_ITEM: NavItem = {
  label: "My Account",
  href: "/progress",
  icon: User,
  parentOnly: true,
  subItems: [
    { label: "My Progress", href: "/progress" },
    // Family Mode is included in every membership — the solo door surfaces the
    // "Add your family" activation from their Account group (opens on Settings).
    { label: "Add your family", href: "/settings#family" },
    { label: "Refer a friend", href: "/referrals" },
  ],
};

/**
 * Learn group — the SHARED (FIC + FTA) learning surfaces: Start Here, Courses,
 * Live Classes, Flashcards. It stays in the default warm register for every
 * tier now that the gold PRO identity lives solely on the dedicated FTA section
 * below (a hard FIC/FTA split, Lane 3). Young kids get the kid-worded variant.
 * Routes are NOT moved.
 */
function learnGroup(isKid: boolean): NavItem {
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
    label: "Learn",
    href: "/courses",
    icon: GraduationCap,
    subItems: [
      { label: "Start Here", href: "/start-here" },
      { label: "Courses", href: "/courses" },
      { label: "Live Classes", href: "/live-sessions" },
      { label: "Flashcards", href: "/flashcards" },
    ],
  };
}

/**
 * FTA — Trading Academy: the gold, PRO-identity section that is the visual
 * counterpart to the warm FIC club rows above. For FTA families it is an
 * always-expanded hub (Traders Chat · Course Library · Recordings); FIC-only
 * PARENTS see FTA_LOCKED instead — one compact locked teaser that opens the
 * /upgrade pitch. Kids and teens never see the locked teaser (no upsell posture).
 */
const FTA_SECTION: NavItem = {
  label: "FTA — Trading Academy",
  href: "/fta/chat",
  icon: GraduationCap,
  fta: true,
  badge: "PRO",
  subItems: [
    { label: "Traders Chat", href: "/fta/chat" },
    { label: "Course Library", href: "/fta/courses" },
    { label: "Recordings", href: "/fta/recordings" },
  ],
};
const FTA_LOCKED: NavItem = {
  label: "FTA — Trading Academy",
  href: "/upgrade",
  icon: GraduationCap,
  fta: true,
  locked: true,
};

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
export function getNavItems(
  role?: string,
  ageGroup?: string,
  tier: FamilyTier = "fic",
  isSolo = false
): NavItem[] {
  const isChild = role === "child";
  const isKid = isChild && ageGroup === "kids";
  const canParent = role === "parent" || role === "admin";
  const isFta = tier === "fta";

  // ── Free tier (social-funnel signups): "give the tools, gate the guidance."
  //    Home (limited + journey checklist), read-only Community, the free courses
  //    sampler, Practice (chart + games), the Community Watchlist door (gated to
  //    the members-only UpsellCard — this replaces the old Team Picks teaser),
  //    the Free Class hub, and a "Join FIC" upsell. Help/Settings in the footer. ──
  if (tier === "free") {
    // Mental model Home · Learn · Club · Watchlist · You — free swaps the adult
    // slot-2 (Discover) for the free Courses sampler (their Learn door), leading
    // with the four primary doors, then the rest under a quiet secondary group.
    return [
      { label: "Home", href: "/dashboard", icon: LayoutDashboard },
      { label: "Learn", href: "/courses", icon: BookOpen },
      CLUB_COMMUNITY,
      { label: "Watchlist", href: "/watchlist/community", icon: Eye },
      FAMILY_MORE_HEADER,
      CLUB_NEWS,
      practiceGroup(false), // chart + games (Candle Battle); simulator stays locked
      { label: "Free Class", href: "/free-class", icon: Video },
      { label: "Join the Club", href: "/upgrade", icon: Sparkles },
    ];
  }

  // ── Cheat Code Club — five-item scheme (individual/club mode, R2). Applies to
  //    a solo ADULT member (isSolo ⇒ one adult, no kids). Family / kid / teen
  //    navs are unchanged below. Primary five: Home · Discover · Community ·
  //    Watchlist · Profile(More). Everything else lives under a "More" section
  //    (desktop) / the Profile-More sheet (mobile). Kai left the primary nav —
  //    it's the floating FAB now — so it is intentionally absent here. FTA solo
  //    members keep the gold FTA hub section at the tail. ──
  if (isSolo) {
    // (Free tier already returned above; a solo member here is fic or fta.)
    return [
      // ── PRIMARY five (Profile is the top-bar avatar on desktop, not a row) ──
      { label: "Home", href: "/dashboard", icon: LayoutDashboard },
      CLUB_DISCOVER,
      CLUB_COMMUNITY_PROMINENT,
      CLUB_WATCHLIST_SOLO,
      // ── SECONDARY — grouped under quiet labels instead of one flat "More". ──
      // LEARN: the education surfaces (course hub + practice/simulator/games).
      CLUB_LEARN_HEADER,
      learnGroup(false),
      practiceGroup(true),
      // MARKETS: the market-intelligence tools. Screener (Stock Finder) — the R2
      // five-item regroup dropped it from the primary nav; it lives here (also
      // the Discover hub's "Screener" tab) so the active state + app tour resolve.
      CLUB_MARKETS_HEADER,
      CLUB_COLLECTION,
      CLUB_SCREENER,
      CLUB_NEWS,
      CLUB_ALERTS,
      // ACCOUNT: your standing + growth. Individual members can add a family
      // later (Family Mode ships with every membership) — surfaced via
      // Settings#family, so no Family group is pushed here.
      CLUB_ACCOUNT_HEADER,
      LEADERBOARD,
      CLUB_BELTS,
      CLUB_PROGRESS,
      CLUB_REFER,
      // FTA hub keeps its own gold, hard-split treatment at the tail.
      isFta ? FTA_SECTION : FTA_LOCKED,
    ];
  }

  // ── Young kids (7 top-level): surface the play/earn loop flat, nest lessons.
  //    Community now appears on the kid DESKTOP nav too (it was mobile-only). ──
  if (isKid) {
    // Kid mental model Home · Learn · Club · Missions · Me — Learn is a retention
    // pillar, so it stays one tap from primary (never buried under "Me"). The
    // primary four lead; the rest (News, Kai, Watchlist, Practice, Badges,
    // Leaderboard) stay reachable below as their curated loop.
    return [
      { label: "Kids Corner", href: "/dashboard", icon: LayoutDashboard },
      learnGroup(true), // My Lessons · Live Classes · My Cards
      CLUB_COMMUNITY,
      CLUB_MISSIONS,
      FAMILY_MORE_HEADER,
      CLUB_NEWS,
      KAI_ASK,
      CLUB_WATCHLIST,
      practiceGroup(false), // chart + games only for young kids
      { label: "My Badges", href: "/progress", icon: Trophy },
      LEADERBOARD,
    ];
    // Young kids never see the FTA hub or any upsell — their loop stays
    // curated (the day-trading traders chat / recordings are teen+adult).
  }

  // ── Teens + parents (both tiers). Primary+More grouping, matching the club
  //    (individual) sidebar so the family nav no longer reads as ~13 flat rows.
  //    PRIMARY: the household's daily doors — Home · Community · Watchlist ·
  //    Family (parents). Everything else (Discover, News, Kai, Screener, Kid
  //    Missions, Learn, Practice, Alerts, Progress, Leaderboard) drops under a
  //    "More" header. Warm-gold register + kid-relevant ordering unchanged; no
  //    routes move. The gold FTA hub stays at the tail with its own treatment. ──
  // One mental model: Home, Discover, Club, {slot4}, You. A family register
  // changes exactly ONE slot vs the adult baseline — parents get Family in slot
  // 4; teens keep Learn one tap from primary (a retention pillar can't sit under
  // "You" for minors) and run Home, Learn, Club, Watchlist. Everything else drops
  // under a quiet "More" group. No routes are removed — items only move between
  // primary and More, so every destination stays reachable (link-graph preserved).
  if (canParent) {
    // Parent: Home, Discover, Club, Family. Watchlist moves under More.
    const primary: NavItem[] = [
      { label: "Home", href: "/dashboard", icon: LayoutDashboard },
      CLUB_DISCOVER,
      CLUB_COMMUNITY_HUB,
      isSolo ? SOLO_ACCOUNT_ITEM : FAMILY_ITEM,
    ];
    const more: NavItem[] = [
      CLUB_WATCHLIST,
      CLUB_NEWS,
      KAI_ASK,
      CLUB_SCREENER,
      CLUB_MISSIONS,
      learnGroup(false),
      practiceGroup(true),
      CLUB_ALERTS,
      LEADERBOARD,
      CLUB_BELTS,
    ];
    // The FTA section closes the nav as a hard-split gold hub for FTA families;
    // FIC-only parents get the compact locked teaser in its place (to /upgrade).
    return [...primary, FAMILY_MORE_HEADER, ...more, isFta ? FTA_SECTION : FTA_LOCKED];
  }

  // Teens: Home, Learn, Club, Watchlist. Discover, News, Kai, Screener, Missions,
  // Practice, Progress, Leaderboard live under More. FTA teens still get the hub;
  // FIC teens see nothing at the tail (upsell stays parent-gated).
  const teenPrimary: NavItem[] = [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    learnGroup(false),
    CLUB_COMMUNITY_HUB,
    CLUB_WATCHLIST,
  ];
  const teenMore: NavItem[] = [
    CLUB_DISCOVER,
    CLUB_NEWS,
    KAI_ASK,
    CLUB_SCREENER,
    CLUB_MISSIONS,
    practiceGroup(true),
    { label: "My Progress", href: "/progress", icon: Trophy },
    LEADERBOARD,
    CLUB_BELTS,
  ];
  return isFta
    ? [...teenPrimary, FAMILY_MORE_HEADER, ...teenMore, FTA_SECTION]
    : [...teenPrimary, FAMILY_MORE_HEADER, ...teenMore];
}

interface DashboardSidebarProps {
  user: {
    email?: string;
    display_name?: string;
    role?: string;
    age_group?: string;
    tier?: FamilyTier;
    isSolo?: boolean;
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
  const navItems = getNavItems(user.role, user.age_group, user.tier, user.isSolo);
  const footerItems = getFooterItems(user.role, user.tier);
  // Umbrella wordmark is MODE-driven, not tier-driven: an individual member
  // (solo household) lives in "Cheat Code Club"; a family lives in "Family
  // Investing Club — part of Cheat Code Club". FTA is an add-on tier on top of
  // either door (its identity lives in the gold nav section + chip), so it no
  // longer flips the whole logo.
  const mode = modeFromSolo(user.isSolo);
  const brand = modeBrand(mode);
  const collapsedMark = mode === "individual" ? "CC" : "FIC";
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
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          {mode === "individual" ? (
            // Cheat Code Club — the R1 infinity brand. Collapsed rail gets the
            // solid mono mark; expanded gets the full mark + wordmark lockup.
            collapsed ? (
              <ClubMark solid size={26} solidColor="var(--accent-solid)" className="shrink-0" />
            ) : (
              <ClubWordmark size={26} />
            )
          ) : (
            <>
              <span className="font-display text-lg font-bold text-gold-600 shrink-0">
                {collapsed ? collapsedMark : brand.wordmarkShort}
              </span>
              {!collapsed && (
                <span className="hidden lg:flex flex-col leading-tight min-w-0">
                  <span className="text-[11px] text-midnight-300 font-body truncate">
                    {brand.wordmark}
                  </span>
                  {brand.tagline && (
                    <span className="text-[9px] text-midnight-500 font-body truncate">
                      {brand.tagline}
                    </span>
                  )}
                </span>
              )}
            </>
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
          // ── Gold "FTA — Trading Academy" section — the hard-split hub. A top
          //    divider + gold chrome + PRO identity set it apart from the warm
          //    FIC rows above. FTA families get an always-expanded hub; FIC-only
          //    parents get the single locked teaser (→ /upgrade). ──
          if (item.fta) {
            const Icon = item.icon;
            const onFta = pathname.startsWith("/fta");
            const FTA_SUB_ICON: Record<string, React.ElementType> = {
              "/fta/chat": Radio,
              "/fta/courses": GraduationCap,
              "/fta/recordings": Film,
            };
            return (
              <div key={item.href} className="mt-3 pt-3 border-t border-ftagold-400/25">
                <Link
                  href={item.href}
                  data-tour={"nav:" + item.href}
                  onClick={onMobileClose}
                  title={item.locked ? "Unlock FTA" : "FTA — Trading Academy"}
                  className={`
                    relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
                    ${collapsed ? "justify-center" : ""}
                    ${onFta && !item.locked
                      ? "text-ftagold-700 bg-ftagold-400/15"
                      : "text-ftagold-700/90 hover:text-ftagold-700 hover:bg-ftagold-400/10"
                    }
                  `}
                >
                  {onFta && !item.locked && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-ftagold-500" />
                  )}
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  {!collapsed && (
                    <span className="truncate font-semibold font-display">{item.label}</span>
                  )}
                  {!collapsed && item.locked && (
                    <Lock className="ml-auto w-3.5 h-3.5 shrink-0 text-ftagold-600/80" />
                  )}
                  {!collapsed && !item.locked && item.badge && (
                    <span className="ml-auto shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-b from-ftagold-400 to-ftagold-600 text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
                {item.locked && !collapsed && (
                  <p className="px-3 pt-0.5 text-[10px] text-ftagold-700/60 leading-snug">
                    Unlock the traders chat, course library & recordings.
                  </p>
                )}
                {!item.locked && !collapsed && item.subItems && (
                  <div className="ml-9 mt-0.5 space-y-0.5">
                    {item.subItems.map((sub) => {
                      const subActive =
                        pathname === sub.href || pathname.startsWith(sub.href + "/");
                      const SubIcon = FTA_SUB_ICON[sub.href];
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={onMobileClose}
                          className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors
                            ${subActive
                              ? "text-ftagold-700 font-medium"
                              : "text-ftagold-700/70 hover:text-ftagold-700"
                            }
                          `}
                        >
                          {SubIcon && <SubIcon className="w-3.5 h-3.5 shrink-0" />}
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
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
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    item.accent && !active ? "text-gold-600" : ""
                  }`}
                />
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

  // v2 conversion (design-project-v2). Placed AFTER every hook above so hook
  // order is identical on both paths; the flag is a build-time constant so this
  // branch is stable across renders. Off ⇒ v1 renders byte-identically below.
  if (designV2Enabled()) {
    return (
      <SidebarV2
        user={user}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        mobileOpen={mobileOpen}
        onMobileClose={onMobileClose}
      />
    );
  }

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
