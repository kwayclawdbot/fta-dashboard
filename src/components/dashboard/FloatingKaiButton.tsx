"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot } from "lucide-react";
import type { FamilyTier } from "@/lib/tier";

/**
 * FloatingKaiButton — the persistent Kai entry point (Cheat Code Club redesign,
 * R2). Kai left the primary nav when the five-item scheme landed; this Kai-blue
 * FAB is its always-reachable replacement for ADULT members.
 *
 * Visibility rules:
 *   • adults only — parent / admin, or a solo (individual) owner. Kids get an
 *     age-aware Kai inside their own nav; teens keep Ask Kai as a nav row. No
 *     FAB for minors, so this surface never pushes an unscoped AI at them.
 *   • never on free tier — /kai is members-gated; a FAB there would only bounce.
 *   • hidden on /kai itself — you don't need a shortcut to the page you're on.
 *
 * Layout: bottom-right, above the mobile tab bar (4rem + safe-area) on phones,
 * a normal bottom-right offset on desktop. Kai-blue (#2563FF, the AI surface
 * colour) so it never competes with the volt-orange brand actions.
 */

interface FloatingKaiButtonProps {
  role?: string;
  ageGroup?: string;
  tier?: FamilyTier;
  isSolo?: boolean;
}

export default function FloatingKaiButton({
  role,
  ageGroup,
  tier,
  isSolo,
}: FloatingKaiButtonProps) {
  const pathname = usePathname();

  const isKid = role === "child" && ageGroup === "kids";
  const isChild = role === "child";
  const isAdult = role === "parent" || role === "admin" || !!isSolo;
  const isFree = (tier ?? "fic") === "free";

  // Adults only, paying members only, and not while already on the Kai page.
  if (isKid || isChild || !isAdult || isFree) return null;
  if (pathname === "/kai" || pathname.startsWith("/kai/")) return null;

  return (
    <Link
      href="/kai"
      data-tour="kai-float"
      aria-label="Ask Kai"
      title="Ask Kai — your AI research co-pilot"
      className="group fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-kai-500 text-white shadow-[0_6px_20px_rgba(37,99,255,0.45)] ring-4 ring-[var(--paper)] transition-transform hover:scale-105 active:scale-95"
      style={{
        // Clear the mobile tab bar (4rem) + iOS safe area on phones; md+ has no
        // tab bar so it sits at a normal bottom offset.
        bottom: "calc(env(safe-area-inset-bottom) + 5rem)",
      }}
    >
      <Bot className="h-6 w-6" strokeWidth={2.1} />
      {/* Subtle teal-green "AI online" dot, per the club AI accent. */}
      <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-teal-400 ring-2 ring-kai-500" />
    </Link>
  );
}
