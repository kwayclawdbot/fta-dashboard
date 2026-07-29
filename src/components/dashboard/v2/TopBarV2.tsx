"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "@/lib/motion";
import { Menu, ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import NotificationsBellV2 from "./NotificationsBellV2";
import CommandSearchV2 from "./CommandSearchV2";
import type { FamilyTier } from "@/lib/tier";
import Avatar from "@/components/Avatar";
import { BeltChipV2 } from "./kit";

/**
 * DashboardTopBar — v2. Warm-black bar; the mobile/tablet page title is a mono
 * kicker (the board's section-label voice); the belt chip is the belt-ringed
 * identity chip; command search + notifications bell are the same functional
 * components; the account dropdown is re-skinned to --cc-* tokens. All existing
 * behaviour (search, bell, settings, logout) is unchanged.
 */
interface TopBarV2Props {
  user: {
    email?: string;
    display_name?: string;
    avatar_url?: string;
    role?: string;
    age_group?: string;
    tier?: FamilyTier;
    isSolo?: boolean;
  };
  xp?: number | null;
  pageTitle: string;
  initials: string;
  onMenuClick: () => void;
}

export default function TopBarV2({
  user,
  xp = null,
  pageTitle,
  initials,
  onMenuClick,
}: TopBarV2Props) {
  const router = useRouter();
  const supabase = createClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <header
      className="sticky top-0 z-20 backdrop-blur-md"
      style={{
        background: "color-mix(in srgb, var(--cc-bg, #141216) 90%, transparent)",
        borderBottom: "1px solid var(--cc-line, #2b2731)",
      }}
    >
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Left: hamburger (tablet) + mono title (mobile/tablet). */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="hidden md:block lg:hidden"
            style={{ color: "var(--cc-soft, #8d8794)" }}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="cc-mono lg:hidden" style={{ color: "var(--cc-soft, #8d8794)" }}>
            {pageTitle}
          </span>
        </div>

        {/* Right: universal search, belt chip, notifications, avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          <CommandSearchV2 />
          <span data-tour="belt" className="inline-flex">
            <BeltChipV2 xp={xp ?? null} initials={initials} />
          </span>
          <span data-tour="bell" className="inline-flex">
            <NotificationsBellV2 />
          </span>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <Avatar
                name={user.display_name || user.email}
                avatarUrl={user.avatar_url}
                tier={user.tier}
                size="sm"
              />
              <ChevronDown
                className="hidden h-3 w-3 sm:block"
                style={{ color: "var(--cc-dim, #5d5865)" }}
              />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <m.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl shadow-lg"
                  style={{
                    background: "var(--cc-card, #1c1920)",
                    border: "1px solid var(--cc-line, #2b2731)",
                  }}
                >
                  <div
                    className="px-4 py-3"
                    style={{ borderBottom: "1px solid var(--cc-line, #2b2731)" }}
                  >
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: "var(--cc-ink, #f4f0ec)" }}
                    >
                      {user.display_name || "Trader"}
                    </p>
                    <p
                      className="truncate text-xs"
                      style={{ color: "var(--cc-dim, #5d5865)" }}
                    >
                      {user.email}
                    </p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                      style={{ color: "var(--cc-soft, #8d8794)" }}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                      style={{ color: "var(--cc-soft, #8d8794)" }}
                    >
                      <LogOut className="h-4 w-4" />
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
