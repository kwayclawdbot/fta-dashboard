"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { m, AnimatePresence } from "@/lib/motion";
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Lock,
  Radio,
  Film,
  GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FamilyTier } from "@/lib/tier";
import { CcMark } from "@/components/cc/ui";
import {
  getNavItems,
  getFooterItems,
  type NavItem,
} from "@/components/dashboard/DashboardSidebar";
import { initialsOf } from "./kit";

/**
 * DashboardSidebar — v2 (Cheat Code App conversion). Same IA and the same
 * role/tier/solo nav DATA as v1 (imported from DashboardSidebar so the two can
 * never drift), re-skinned to the board language: warm-black ground, mono
 * kicker section labels, active nav = signal orange (left bar + orange text),
 * the FTA hub kept as a distinct gold-accent lane (orange and gold never share
 * a row). Behaviour — collapse, mobile overlay, sub-item expand, active/child
 * matching — is preserved exactly.
 */
interface SidebarV2Props {
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

const FTA_SUB_ICON: Record<string, React.ElementType> = {
  "/fta/chat": Radio,
  "/fta/courses": GraduationCap,
  "/fta/recordings": Film,
};

export default function SidebarV2({
  user,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: SidebarV2Props) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = getNavItems(user.role, user.age_group, user.tier, user.isSolo);
  const footerItems = getFooterItems(user.role, user.tier);
  const supabase = createClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const initials = initialsOf(user.display_name || user.email);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const content = (
    <div className="flex h-full flex-col">
      {/* Logo — CcMark + display wordmark (board chrome). */}
      <div
        className="flex items-center justify-between px-4 py-4"
        style={{ borderBottom: "1px solid var(--cc-line, #2b2731)" }}
      >
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <CcMark size={26} />
          {!collapsed && (
            <span className="flex flex-col leading-none">
              <span
                className="cc-display text-[19px]"
                style={{ color: "var(--cc-ink, #f4f0ec)" }}
              >
                Cheat Code
              </span>
              <span
                className="mt-1 font-[family-name:var(--font-plex-mono)] text-[9px] font-semibold uppercase tracking-[0.4em]"
                style={{ color: "var(--cc-orange-ink, #ff7a1a)" }}
              >
                Club
              </span>
            </span>
          )}
        </Link>
        <button
          onClick={onMobileClose}
          className="lg:hidden"
          style={{ color: "var(--cc-soft, #8d8794)" }}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          // Section label → mono kicker (or a hairline when collapsed).
          if (item.sectionHeader) {
            if (collapsed) {
              return (
                <div
                  key={item.href}
                  className="mx-3 my-2"
                  style={{ borderTop: "1px solid var(--cc-line, #2b2731)" }}
                />
              );
            }
            return (
              <div key={item.href} className="px-3 pb-1 pt-4">
                <span
                  className="cc-mono"
                  style={{ color: "var(--cc-dim, #5d5865)" }}
                >
                  {item.label}
                </span>
              </div>
            );
          }

          // FTA hub — the distinct gold-accent lane (never orange).
          if (item.fta) {
            const Icon = item.icon;
            const onFta = pathname.startsWith("/fta");
            const activeFta = onFta && !item.locked;
            return (
              <div
                key={item.href}
                className="mt-3 pt-3"
                style={{ borderTop: "1px solid color-mix(in srgb, var(--cc-yellow, #facc15) 30%, transparent)" }}
              >
                <Link
                  href={item.href}
                  data-tour={"nav:" + item.href}
                  onClick={onMobileClose}
                  title={item.locked ? "Unlock FTA" : "FTA — Trading Academy"}
                  className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors ${
                    collapsed ? "justify-center" : ""
                  }`}
                  style={{
                    color: "var(--cc-yellow, #facc15)",
                    background: activeFta
                      ? "color-mix(in srgb, var(--cc-yellow, #facc15) 14%, transparent)"
                      : "transparent",
                  }}
                >
                  {activeFta && (
                    <span
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                      style={{ background: "var(--cc-yellow, #facc15)" }}
                    />
                  )}
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && (
                    <span
                      className="truncate text-[13px]"
                      style={{ fontWeight: activeFta ? 600 : 500 }}
                    >
                      {item.label}
                    </span>
                  )}
                  {!collapsed && item.locked && (
                    <Lock className="ml-auto h-3.5 w-3.5 shrink-0 opacity-80" />
                  )}
                  {!collapsed && !item.locked && item.badge && (
                    <span
                      className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9px] font-bold uppercase tracking-wider"
                      style={{
                        background: "var(--cc-yellow, #facc15)",
                        color: "var(--cc-orange-deep, #0d0b0e)",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
                {item.locked && !collapsed && (
                  <p
                    className="px-3 pt-0.5 text-[10px] leading-snug"
                    style={{ color: "color-mix(in srgb, var(--cc-yellow, #facc15) 60%, transparent)" }}
                  >
                    Unlock the traders chat, course library &amp; recordings.
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
                          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors"
                          style={{
                            color: subActive
                              ? "var(--cc-yellow, #facc15)"
                              : "color-mix(in srgb, var(--cc-yellow, #facc15) 70%, transparent)",
                            fontWeight: subActive ? 600 : 400,
                          }}
                        >
                          {SubIcon && <SubIcon className="h-3.5 w-3.5 shrink-0" />}
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
                className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors ${
                  collapsed ? "justify-center" : ""
                }`}
                style={{
                  color: active
                    ? "var(--cc-orange-ink, #ff7a1a)"
                    : "var(--cc-soft, #8d8794)",
                  background: active
                    ? "color-mix(in srgb, var(--cc-orange, #ff7a1a) 12%, transparent)"
                    : "transparent",
                }}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                    style={{ background: "var(--cc-orange, #ff7a1a)" }}
                  />
                )}
                <Icon
                  className="h-[18px] w-[18px] shrink-0"
                  style={
                    item.accent && !active
                      ? { color: "var(--cc-orange-ink, #ff7a1a)" }
                      : undefined
                  }
                />
                {!collapsed && (
                  <span
                    className="truncate"
                    style={{ fontWeight: active ? 600 : 500 }}
                  >
                    {item.label}
                  </span>
                )}
                {!collapsed && item.badge && (
                  <span
                    className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 font-[family-name:var(--font-plex-mono)] text-[9px] font-bold uppercase tracking-wider"
                    style={{
                      background: "color-mix(in srgb, var(--cc-orange, #ff7a1a) 18%, transparent)",
                      color: "var(--cc-orange-ink, #ff7a1a)",
                    }}
                  >
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
                        className="block rounded-md px-3 py-1.5 text-xs transition-colors"
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

      {/* Collapse toggle (desktop only) */}
      <div
        className="hidden px-3 py-2 lg:block"
        style={{ borderTop: "1px solid var(--cc-line, #2b2731)" }}
      >
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center rounded-md py-2 transition-colors"
          style={{ color: "var(--cc-soft, #8d8794)" }}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Footer utility cluster — Shop / Help / Settings (+ Admin). */}
      <div
        className="space-y-0.5 px-3 pb-1 pt-2"
        style={{ borderTop: "1px solid var(--cc-line, #2b2731)" }}
      >
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
              className={`flex items-center gap-3 rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                collapsed ? "justify-center" : ""
              }`}
              style={{
                color: active
                  ? "var(--cc-orange-ink, #ff7a1a)"
                  : "var(--cc-dim, #5d5865)",
                background: active
                  ? "color-mix(in srgb, var(--cc-orange, #ff7a1a) 10%, transparent)"
                  : "transparent",
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* User / Logout */}
      <div
        className="px-3 py-4"
        style={{ borderTop: "1px solid var(--cc-line, #2b2731)" }}
      >
        <div className="mb-3 flex items-center gap-3 px-3">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold"
            style={{
              background: "var(--cc-card2, #232028)",
              color: "var(--cc-ink, #f4f0ec)",
              border: "2px solid var(--cc-line, #2b2731)",
            }}
          >
            {initials}
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p
                className="truncate text-sm font-medium"
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
          )}
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
          style={{ color: "var(--cc-soft, #8d8794)" }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{loggingOut ? "Logging out..." : "Logout"}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`fixed left-0 top-0 z-30 hidden h-screen flex-col transition-all duration-300 lg:flex ${
          collapsed ? "w-[72px]" : "w-60"
        }`}
        style={{
          background: "var(--cc-bg, #141216)",
          borderRight: "1px solid var(--cc-line, #2b2731)",
        }}
      >
        {content}
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
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            />
            <m.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "tween", duration: 0.2 }}
              className="fixed left-0 top-0 z-50 h-screen w-60 lg:hidden"
              style={{
                background: "var(--cc-bg, #141216)",
                borderRight: "1px solid var(--cc-line, #2b2731)",
              }}
            >
              {content}
            </m.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
