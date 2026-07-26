"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, ChevronRight, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FamilyTier } from "@/lib/tier";

/**
 * FloatingKaiButton — the persistent Kai entry point (Cheat Code Club redesign,
 * R2). Kai left the primary nav when the five-item scheme landed; this Kai-blue
 * FAB is its always-reachable replacement.
 *
 * The FAB OPENS THE CONTEXTUAL KAI SHEET (owned by <KaiSheetProvider>) inline
 * instead of navigating to /kai, so members talk to Kai without leaving the page
 * they're on. The conversation lives in the same thread/usage/streaming APIs as
 * the full page (the sheet and /kai both render <KaiChatShared>), so nothing is a
 * throwaway. The FAB is the no-context entry point; contextual "Ask Kai" actions
 * and search rows call useKaiSheet().openKai({ chip, query }) directly.
 *
 * It is also COLLAPSIBLE: a small tuck control on the FAB's edge slides it away
 * to a slim edge sliver (still discoverable, tap to restore). The preference
 * persists per member (localStorage) across sessions and routes.
 *
 * Visibility rules:
 *   • paying members only — never the free tier (/kai is members-gated; a FAB
 *     there would only bounce). Kids and teens see it too now: the panel Kai is
 *     the same age-scoped, kid-strict-server-side experience they already reach
 *     from their nav, just one tap closer — not an unscoped AI.
 *   • hidden on /kai itself — you don't need a shortcut to the page you're on.
 *
 * Layout: bottom-right, above the mobile tab bar (safe-area + tab bar) on phones.
 * On surfaces that also float a Club Chat launcher (/community, /chart) it stacks
 * ABOVE that button so the two never collide. Kai-blue (#2563FF, the AI surface
 * colour) in every mode so it never competes with the volt-orange brand actions;
 * the panel itself follows the mode/register skin (club volt · family gold · kid).
 */

interface FloatingKaiButtonProps {
  role?: string;
  ageGroup?: string;
  tier?: FamilyTier;
  isSolo?: boolean;
  /** Open the contextual Kai sheet (owned by KaiSheetProvider). */
  onOpen: () => void;
}

const GENERIC_KEY = "cc:kai-fab-collapsed";

export default function FloatingKaiButton({
  tier,
  onOpen,
}: FloatingKaiButtonProps) {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const uidRef = useRef<string>("");

  // Resolve the persisted collapse preference on the client (per user id, with a
  // device-wide fallback for the first paint). Kept out of the render initializer
  // to avoid a hydration mismatch.
  useEffect(() => {
    try {
      const generic = localStorage.getItem(GENERIC_KEY);
      if (generic != null) setCollapsed(generic === "1");
    } catch {
      /* ignore */
    }
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        uidRef.current = user.id;
        const perUser = localStorage.getItem(`${GENERIC_KEY}:${user.id}`);
        if (perUser != null) setCollapsed(perUser === "1");
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const persistCollapsed = useCallback((next: boolean) => {
    try {
      const v = next ? "1" : "0";
      localStorage.setItem(GENERIC_KEY, v);
      if (uidRef.current) localStorage.setItem(`${GENERIC_KEY}:${uidRef.current}`, v);
    } catch {
      /* ignore */
    }
  }, []);

  const collapse = useCallback(() => {
    setCollapsed(true);
    persistCollapsed(true);
  }, [persistCollapsed]);
  const restore = useCallback(() => {
    setCollapsed(false);
    persistCollapsed(false);
  }, [persistCollapsed]);

  const isFree = (tier ?? "fic") === "free";
  const onKaiPage = pathname === "/kai" || pathname.startsWith("/kai/");

  // Surfaces that also float a Club Chat launcher (bottom-right). Stack Kai above
  // it so the two buttons never overlap the same corner.
  const hasClubChat =
    pathname.startsWith("/community") || pathname.startsWith("/chart");

  // Gate: never free tier, never on /kai. (Kids/teens now included — see header.)
  const gatedOut = isFree || onKaiPage;

  if (gatedOut) return null;

  // Bottom offset: clear the mobile tab bar + safe area on phones; a normal
  // offset on md+ (no tab bar). Raised further where Club Chat shares the corner.
  const bottomClass = hasClubChat
    ? "bottom-[calc(env(safe-area-inset-bottom)+9.5rem)] md:bottom-[5.75rem]"
    : "bottom-[calc(env(safe-area-inset-bottom)+5rem)] md:bottom-6";

  return (
    <>
      {collapsed ? (
        // Slim edge sliver — pinned to the right edge, still discoverable.
        <button
          type="button"
          data-tour="kai-float"
          onClick={restore}
          aria-label="Show Kai"
          title="Show Kai"
          className={`group fixed right-0 z-40 flex h-14 w-[22px] flex-col items-center justify-center gap-1 rounded-l-xl bg-kai-500 text-white shadow-[0_4px_16px_rgba(37,99,255,0.4)] ring-1 ring-white/10 transition-[width,transform] duration-200 hover:w-6 active:scale-95 ${bottomClass}`}
          style={{ marginBottom: "0" }}
        >
          <ChevronLeft className="h-3 w-3 opacity-80" strokeWidth={2.4} />
          <Bot className="h-4 w-4" strokeWidth={2.1} />
        </button>
      ) : (
        <div className={`fixed right-4 z-40 ${bottomClass}`}>
          <div className="group relative">
            <button
              type="button"
              data-tour="kai-float"
              onClick={onOpen}
              aria-label="Ask Kai"
              title="Ask Kai — your AI research co-pilot"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-kai-500 text-white shadow-[0_6px_20px_rgba(37,99,255,0.45)] ring-4 ring-[var(--paper)] transition-transform hover:scale-105 active:scale-95"
            >
              <Bot className="h-6 w-6" strokeWidth={2.1} />
              {/* Subtle teal-green "AI online" dot, per the club AI accent. */}
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-teal-400 ring-2 ring-kai-500" />
            </button>
            {/* Tuck-away control — collapses the FAB to the edge sliver. Faintly
                present on touch, full on hover. */}
            <button
              type="button"
              onClick={collapse}
              aria-label="Tuck Kai away"
              title="Tuck away"
              className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-midnight-900 text-soft opacity-60 ring-2 ring-[var(--paper)] transition-all hover:bg-midnight-800 hover:text-ink hover:opacity-100 active:scale-95 md:opacity-0 md:group-hover:opacity-100"
            >
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.4} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
