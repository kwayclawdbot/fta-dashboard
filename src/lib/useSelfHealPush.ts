"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { healPush } from "@/lib/push";

const HEAL_KEY = "fic-push-heal-last";
const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * Mount-once silent self-heal. Runs `healPush` at most once per day per device
 * (localStorage-throttled). Completely invisible: it never prompts, never
 * renders, and only acts when Notification.permission is already 'granted'.
 *
 * This is what fixes the owner's "accepted but dead" subscription with zero
 * user action — on his next PWA open, the throttle is clear, permission is
 * granted, and healPush re-links the endpoint server-side.
 *
 * @param userId  the signed-in user's id (null while loading — no-op)
 * @param supabase a browser Supabase client
 */
export function useSelfHealPush(
  userId: string | null,
  supabase: SupabaseClient
): void {
  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined") return;

    let last = 0;
    try {
      last = Number(localStorage.getItem(HEAL_KEY) || "0");
    } catch {
      // private mode / storage blocked — heal anyway (no throttle)
    }
    if (Date.now() - last < ONE_DAY) return;

    // Fire and forget; record the attempt so we don't hammer the DB on every
    // route change within the same day.
    healPush(supabase, userId).finally(() => {
      try {
        localStorage.setItem(HEAL_KEY, String(Date.now()));
      } catch {
        // ignore
      }
    });
  }, [userId, supabase]);
}
