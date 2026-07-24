"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  Home,
  Eye,
  Target,
  Gamepad2,
  MessageCircle,
  Menu,
  ChevronRight,
  BookOpen,
  Lock,
  Compass,
  User,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import type { FamilyTier } from "@/lib/tier";
import { modeFromSolo, modeBrand } from "@/lib/mode";
import { ClubWordmark } from "@/components/brand/ClubMark";
import { getNavItems, getFooterItems, type NavItem } from "./DashboardSidebar";
import BeltChip from "./BeltChip";

interface Tab {
  label: string;
  href: string;
  icon: React.ElementType;
}

/**
 * Role-aware flanks around the elevated Community center button (Scheme B,
 * 2026-07-22). The center is always Community (the app's main action — kids are
 * in the club too). Owner-guided priorities:
 *   parents → Watchlist + Missions  (shared research + kid engagement)
 *   teens   → Watchlist + Missions  (research + gamified engagement)
 *   kids    → Missions + Games      (earn-rewards loop + play)
 */
function flanksFor(
  role?: string,
  ageGroup?: string,
  tier?: FamilyTier,
  isSolo?: boolean
): [Tab, Tab] {
  // Free tier: surface the two "give the tools" value pages — the free courses
  // sampler and the gated Community Watchlist door — flanking Community. Free
  // Class + Join FIC live one tap away in the More sheet.
  if (tier === "free")
    return [
      { label: "Courses", href: "/courses", icon: BookOpen },
      { label: "Watchlist", href: "/watchlist/community", icon: Eye },
    ];
  const isChild = role === "child";
  const isKid = isChild && ageGroup === "kids";
  // Watchlist tab lands on the flagship Community Board; My Family / My Watchlist
  // is one tap deeper via the Watchlist group in the More/Profile sheet.
  const Watchlist: Tab = { label: "Watchlist", href: "/watchlist/community", icon: Eye };
  const Missions: Tab = { label: "Missions", href: "/missions", icon: Target };
  const Games: Tab = { label: "Games", href: "/games", icon: Gamepad2 };
  const Discover: Tab = { label: "Discover", href: "/discover", icon: Compass };
  // Cheat Code Club — five-item scheme (individual/club mode): the flanks are
  // Discover + Watchlist around the elevated Community center. Solo ⇒ adult.
  if (isSolo && !isKid) return [Discover, Watchlist];
  if (isKid) return [Missions, Games];
  // Family teens + parents keep their current pair (Scheme B) — families expect
  // their layout. Discover is still reachable from the More sheet + sidebar.
  return [Watchlist, Missions];
}

interface MobileTabBarProps {
  user: {
    email?: string;
    display_name?: string;
    role?: string;
    age_group?: string;
    avatar_url?: string;
    tier?: FamilyTier;
    isSolo?: boolean;
  };
  /** Lifetime XP for the More-sheet belt chip (null while loading). */
  xp?: number | null;
}

export default function MobileTabBar({ user, xp = null }: MobileTabBarProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const [flank1, flank2] = flanksFor(user.role, user.age_group, user.tier, user.isSolo);
  const HOME: Tab = { label: "Home", href: "/dashboard", icon: Home };
  const mode = modeFromSolo(user.isSolo);
  const individual = mode === "individual";
  const brand = modeBrand(mode);
  // The 5th slot: "Profile" (user glyph) in the club five-item scheme, "More"
  // (menu glyph) everywhere else. Both open the same full-nav sheet.
  const MoreIcon = individual ? User : Menu;
  const moreLabel = individual ? "Profile" : "More";

  // Close the sheet whenever the route changes (e.g. after tapping an item).
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Lock background scroll while the sheet is open.
  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const communityActive = isActive("/community");

  // ── The More sheet reuses the sidebar's role/tier-aware nav definitions plus
  //    the footer utility cluster, minus whatever already has a dedicated tab,
  //    so the two never fall out of sync. Sub-items that duplicate a tab href
  //    (e.g. kids' Games, which is a flank tab AND a Practice sub-item) are
  //    stripped too, so nothing appears twice. ──
  const usedHrefs = new Set<string>([
    HOME.href,
    "/community",
    flank1.href,
    flank2.href,
  ]);
  const dedupeSubs = (item: NavItem): NavItem =>
    item.subItems
      ? { ...item, subItems: item.subItems.filter((s) => !usedHrefs.has(s.href)) }
      : item;
  const allNav = getNavItems(user.role, user.age_group, user.tier, user.isSolo);
  const footerNav = getFooterItems(user.role, user.tier);
  const moreItems: NavItem[] = [...allNav, ...footerNav]
    .filter((item) => item.sectionHeader || !usedHrefs.has(item.href))
    .map(dedupeSubs);

  function TabSlot({ tab }: { tab: Tab }) {
    const active = isActive(tab.href);
    const Icon = tab.icon;
    return (
      <Link
        href={tab.href}
        data-tour={"tab:" + tab.href}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
      >
        <Icon
          className={`w-[22px] h-[22px] ${
            active ? "text-gold-600" : "text-midnight-400"
          }`}
        />
        <span
          className={`text-[10px] font-medium leading-none ${
            active ? "text-gold-700" : "text-midnight-400"
          }`}
        >
          {tab.label}
        </span>
      </Link>
    );
  }

  function onSheetDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 90 || info.velocity.y > 600) setMoreOpen(false);
  }

  return (
    <>
      {/* ── Bottom tab bar (phones only, below md) ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-midnight-900 border-t border-midnight-800 shadow-[0_-2px_16px_rgba(16,24,40,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className="flex items-stretch justify-around h-16 px-1">
          <TabSlot tab={HOME} />
          <TabSlot tab={flank1} />

          {/* Center — elevated Community, the app's main action */}
          <Link
            href="/community"
            data-tour="tab:/community"
            aria-label="Community"
            className="relative flex flex-1 flex-col items-center justify-end pb-1.5"
          >
            <span
              className={`absolute -top-5 w-14 h-14 rounded-full flex items-center justify-center ring-4 ring-midnight-900 transition-shadow ${
                communityActive
                  ? "bg-gold-500 shadow-[0_6px_20px_rgba(245,158,11,0.5)]"
                  : "bg-gold-400 shadow-[0_4px_14px_rgba(245,158,11,0.35)]"
              }`}
            >
              <MessageCircle className="w-6 h-6 text-white" strokeWidth={2.2} />
            </span>
            <span
              className={`mt-9 text-[10px] font-semibold leading-none ${
                communityActive ? "text-gold-700" : "text-gold-600"
              }`}
            >
              Community
            </span>
          </Link>

          <TabSlot tab={flank2} />

          {/* Profile / More — opens the full-nav bottom sheet */}
          <button
            type="button"
            data-tour="tab:more"
            onClick={() => setMoreOpen(true)}
            aria-label={moreLabel}
            aria-expanded={moreOpen}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
          >
            <MoreIcon
              className={`w-[22px] h-[22px] ${
                moreOpen ? "text-gold-600" : "text-midnight-400"
              }`}
            />
            <span
              className={`text-[10px] font-medium leading-none ${
                moreOpen ? "text-gold-700" : "text-midnight-400"
              }`}
            >
              {moreLabel}
            </span>
          </button>
        </div>
      </nav>

      {/* ── More bottom sheet ── */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            key="more-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMoreOpen(false)}
            className="md:hidden fixed inset-0 z-50 bg-black/50 flex items-end"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.22 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={onSheetDragEnd}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-h-[85vh] bg-midnight-900 rounded-t-2xl flex flex-col overflow-hidden shadow-[0_-8px_40px_rgba(16,24,40,0.18)]"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              {/* Grabber */}
              <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                <span className="w-10 h-1.5 rounded-full bg-midnight-700" />
              </div>

              {/* Avatar / name → Settings */}
              <Link
                href="/settings"
                onClick={() => setMoreOpen(false)}
                className="mx-3 mb-1 flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-midnight-950 transition-colors shrink-0"
              >
                <Avatar
                  name={user.display_name || user.email}
                  avatarUrl={user.avatar_url}
                  role={user.role}
                  tier={user.tier}
                  xp={xp}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-midnight-50 truncate">
                    {user.display_name || "Trader"}
                  </p>
                  <p className="text-[11px] text-midnight-500 truncate">
                    {user.email}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-midnight-500 shrink-0" />
              </Link>

              {/* Belt progress — persistent self-visibility on phones, where the
                  TopBar chip is hidden. Taps through to the Leaderboard. */}
              <div className="mx-3 mb-1 shrink-0">
                <BeltChip xp={xp} variant="full" onNavigate={() => setMoreOpen(false)} />
              </div>

              <div className="section-divider mx-3 shrink-0" />

              {/* Full role/tier-aware nav */}
              <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
                {moreItems.map((item) => {
                  if (item.sectionHeader) {
                    return (
                      <div key={item.href} className="px-2 pt-4 pb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-midnight-500">
                          {item.label}
                        </span>
                      </div>
                    );
                  }
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  // The gold FTA section keeps its hard-split identity in the
                  // More sheet too: a divider, gold text, PRO badge or lock.
                  if (item.fta) {
                    return (
                      <div key={item.href} className="mt-2 pt-2 border-t border-ftagold-400/25">
                        <Link
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors ${
                            active && !item.locked
                              ? "text-ftagold-700 bg-ftagold-400/15"
                              : "text-ftagold-700/90 hover:bg-ftagold-400/10"
                          }`}
                        >
                          <Icon className="w-[18px] h-[18px] shrink-0" />
                          <span className="text-sm font-semibold font-display flex-1">{item.label}</span>
                          {item.locked ? (
                            <Lock className="w-3.5 h-3.5 shrink-0 text-ftagold-600/80" />
                          ) : item.badge ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-b from-ftagold-400 to-ftagold-600 text-white">
                              {item.badge}
                            </span>
                          ) : null}
                        </Link>
                        {!item.locked && item.subItems && (
                          <div className="ml-9 mt-0.5 mb-1 space-y-0.5">
                            {item.subItems.map((sub) => {
                              const subActive = isActive(sub.href);
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  onClick={() => setMoreOpen(false)}
                                  className={`block px-2 py-2 rounded-lg text-[13px] transition-colors ${
                                    subActive ? "text-ftagold-700 font-medium" : "text-ftagold-700/70 hover:text-ftagold-700"
                                  }`}
                                >
                                  {sub.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors ${
                          active
                            ? "text-gold-700 bg-gold-400/15"
                            : "text-midnight-200 hover:bg-midnight-950"
                        }`}
                      >
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </Link>
                      {item.subItems && (
                        <div className="ml-9 mt-0.5 mb-1 space-y-0.5">
                          {item.subItems.map((sub) => {
                            const subActive = pathname === sub.href;
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={() => setMoreOpen(false)}
                                className={`block px-2 py-2 rounded-lg text-[13px] transition-colors ${
                                  subActive
                                    ? "text-gold-700"
                                    : "text-midnight-400 hover:text-midnight-200"
                                }`}
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

              {/* Umbrella wordmark — mode-aware brand footer. Individual/club mode
                  gets the infinity ClubWordmark lockup (R1 brand); family keeps
                  the FIC text wordmark + "part of Cheat Code Club" attribution. */}
              <div className="shrink-0 px-5 pt-2 pb-3 border-t border-midnight-800/60">
                {individual ? (
                  <ClubWordmark size={22} />
                ) : (
                  <>
                    <p className="text-[11px] font-display font-bold text-gold-600">
                      {brand.wordmark}
                    </p>
                    {brand.tagline && (
                      <p className="text-[9px] text-midnight-500 font-body">
                        {brand.tagline}
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
