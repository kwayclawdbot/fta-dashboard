"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronRight, Lock, User } from "lucide-react";
import Avatar from "@/components/Avatar";
import type { FamilyTier } from "@/lib/tier";
import { CcMark } from "@/components/cc/ui";
import {
  getNavItems,
  getFooterItems,
  type NavItem,
} from "@/components/dashboard/DashboardSidebar";
import { tabsFor, type Tab } from "@/components/dashboard/MobileTabBar";
import { BeltRowV2, initialsOf } from "./kit";

/**
 * MobileTabBar — v2. The SAME five-slot mental model and the SAME per-persona
 * slot arrangement as v1 (imported tabsFor — free/parent/teen/kid slots are
 * untouched), re-skinned to the board's bottom bar: warm-black ground, active
 * tab = signal orange, the "You"/"Me" slot opens the full-nav sheet (mono
 * section labels, belt identity row, board-styled rows). The Kai FAB is owned
 * by KaiSheetProvider and is unaffected.
 */
interface MobileTabBarV2Props {
  user: {
    email?: string;
    display_name?: string;
    role?: string;
    age_group?: string;
    avatar_url?: string;
    tier?: FamilyTier;
    isSolo?: boolean;
  };
  xp?: number | null;
}

export default function MobileTabBarV2({ user, xp = null }: MobileTabBarV2Props) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const { tabs, youLabel } = tabsFor(
    user.role,
    user.age_group,
    user.tier,
    user.isSolo
  );
  const initials = initialsOf(user.display_name || user.email);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

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

  // Full-nav sheet mirrors the sidebar's nav minus whatever already has a tab.
  const usedHrefs = new Set<string>(tabs.map((t) => t.href));
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
    const color = active ? "var(--cc-orange, #ff7a1a)" : "var(--cc-dim, #5d5865)";
    return (
      <Link
        href={tab.href}
        data-tour={"tab:" + tab.href}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
      >
        <Icon
          className="h-[22px] w-[22px]"
          style={{ color }}
          strokeWidth={active ? 2.4 : 1.8}
        />
        <span className="text-[10px] font-medium leading-none" style={{ color }}>
          {tab.label}
        </span>
      </Link>
    );
  }

  function onSheetDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 90 || info.velocity.y > 600) setMoreOpen(false);
  }

  const moreColor = moreOpen ? "var(--cc-orange, #ff7a1a)" : "var(--cc-dim, #5d5865)";

  return (
    <>
      {/* Bottom tab bar (phones only) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 md:hidden"
        style={{
          background: "var(--cc-bg, #141216)",
          borderTop: "1px solid var(--cc-line, #2b2731)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        aria-label="Primary"
      >
        <div className="flex h-16 items-stretch justify-around px-1">
          {tabs.map((tab) => (
            <TabSlot key={tab.href} tab={tab} />
          ))}
          <button
            type="button"
            data-tour="tab:more"
            onClick={() => setMoreOpen(true)}
            aria-label={youLabel}
            aria-expanded={moreOpen}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5"
          >
            <User className="h-[22px] w-[22px]" style={{ color: moreColor }} />
            <span className="text-[10px] font-medium leading-none" style={{ color: moreColor }}>
              {youLabel}
            </span>
          </button>
        </div>
      </nav>

      {/* More bottom sheet */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            key="more-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-50 flex items-end bg-black/60 md:hidden"
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
              className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl"
              style={{
                background: "var(--cc-bg, #141216)",
                borderTop: "1px solid var(--cc-line, #2b2731)",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              {/* Grabber */}
              <div className="flex shrink-0 justify-center pb-1 pt-2.5">
                <span
                  className="h-1.5 w-10 rounded-full"
                  style={{ background: "var(--cc-line, #2b2731)" }}
                />
              </div>

              {/* Avatar / name → Settings */}
              <Link
                href="/settings"
                onClick={() => setMoreOpen(false)}
                className="mx-3 mb-1 flex shrink-0 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors"
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
                  <p
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--cc-ink, #f4f0ec)" }}
                  >
                    {user.display_name || "Trader"}
                  </p>
                  <p
                    className="truncate text-[11px]"
                    style={{ color: "var(--cc-dim, #5d5865)" }}
                  >
                    {user.email}
                  </p>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0"
                  style={{ color: "var(--cc-dim, #5d5865)" }}
                />
              </Link>

              {/* Belt progress row */}
              <div className="mx-3 mb-1 shrink-0">
                <BeltRowV2
                  xp={xp ?? null}
                  initials={initials}
                  onNavigate={() => setMoreOpen(false)}
                />
              </div>

              <div
                className="mx-3 shrink-0"
                style={{ borderTop: "1px solid var(--cc-line, #2b2731)" }}
              />

              {/* Full role/tier-aware nav */}
              <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
                {moreItems.map((item) => {
                  if (item.sectionHeader) {
                    return (
                      <div key={item.href} className="px-2 pb-1 pt-4">
                        <span className="cc-mono" style={{ color: "var(--cc-dim, #5d5865)" }}>
                          {item.label}
                        </span>
                      </div>
                    );
                  }
                  const active = isActive(item.href);
                  const Icon = item.icon;

                  if (item.fta) {
                    const activeFta = active && !item.locked;
                    return (
                      <div
                        key={item.href}
                        className="mt-2 pt-2"
                        style={{ borderTop: "1px solid color-mix(in srgb, var(--cc-yellow, #facc15) 30%, transparent)" }}
                      >
                        <Link
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors"
                          style={{
                            color: "var(--cc-yellow, #facc15)",
                            background: activeFta
                              ? "color-mix(in srgb, var(--cc-yellow, #facc15) 14%, transparent)"
                              : "transparent",
                          }}
                        >
                          <Icon className="h-[18px] w-[18px] shrink-0" />
                          <span className="cc-display flex-1 text-[15px]">{item.label}</span>
                          {item.locked ? (
                            <Lock className="h-3.5 w-3.5 shrink-0 opacity-80" />
                          ) : item.badge ? (
                            <span
                              className="rounded-full px-1.5 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9px] font-bold uppercase tracking-wider"
                              style={{
                                background: "var(--cc-yellow, #facc15)",
                                color: "var(--cc-orange-deep, #0d0b0e)",
                              }}
                            >
                              {item.badge}
                            </span>
                          ) : null}
                        </Link>
                        {!item.locked && item.subItems && (
                          <div className="ml-9 mb-1 mt-0.5 space-y-0.5">
                            {item.subItems.map((sub) => {
                              const subActive = isActive(sub.href);
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  onClick={() => setMoreOpen(false)}
                                  className="block rounded-lg px-2 py-2 text-[13px] transition-colors"
                                  style={{
                                    color: subActive
                                      ? "var(--cc-yellow, #facc15)"
                                      : "color-mix(in srgb, var(--cc-yellow, #facc15) 70%, transparent)",
                                    fontWeight: subActive ? 500 : 400,
                                  }}
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
                        className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors"
                        style={{
                          color: active
                            ? "var(--cc-orange-ink, #ff7a1a)"
                            : "var(--cc-soft, #8d8794)",
                          background: active
                            ? "color-mix(in srgb, var(--cc-orange, #ff7a1a) 12%, transparent)"
                            : "transparent",
                        }}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </Link>
                      {item.subItems && (
                        <div className="ml-9 mb-1 mt-0.5 space-y-0.5">
                          {item.subItems.map((sub) => {
                            const subActive = pathname === sub.href;
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={() => setMoreOpen(false)}
                                className="block rounded-lg px-2 py-2 text-[13px] transition-colors"
                                style={{
                                  color: subActive
                                    ? "var(--cc-orange-ink, #ff7a1a)"
                                    : "var(--cc-dim, #5d5865)",
                                }}
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

              {/* Brand footer — CcMark + display wordmark */}
              <div
                className="flex shrink-0 items-center gap-2 px-5 pb-3 pt-2"
                style={{ borderTop: "1px solid var(--cc-line, #2b2731)" }}
              >
                <CcMark size={18} />
                <span className="cc-display text-[13px]" style={{ color: "var(--cc-ink, #f4f0ec)" }}>
                  Cheat Code
                </span>
                <span
                  className="font-[family-name:var(--font-plex-mono)] text-[8px] font-semibold uppercase tracking-[0.32em]"
                  style={{ color: "var(--cc-orange-ink, #ff7a1a)" }}
                >
                  Club
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
