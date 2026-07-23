"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { XP, awardXp, hasXpForRef, getUserXp } from "@/lib/xp";
import { beltCelebrateFields } from "@/lib/belts";
import { isAllowedLessonOrigin } from "@/lib/lesson-bridge";

/**
 * Simbot XP bridge — receives MILESTONE events from the embedded Simbot
 * simulator (public/sim/index.html, iframe) and awards PLATFORM XP for the
 * few milestones we've defined. Simbot's own internal progress economy stays
 * internal; the host is the sole authority on XP amounts and de-dupes every
 * award once-per-ref so belts/leaderboards can never be farmed.
 *
 * Protocol (child sim -> this host), see window.__FTA__.emit in the sim:
 *   { type:'fta-simbot', v:1, event, payload, ts }
 *
 *   event 'ready'               payload {}                          -> onReady (host may push theme)
 *   event 'lesson_complete'     payload { id, title, stage }        -> +LESSON XP once per lesson id
 *   event 'level_up'            payload { stage, name }             -> +modest bonus once per stage
 *   event 'first_profitable_r'  payload { symbol, r, pnl }          -> +bonus once ever
 *
 * Security: the child posts with targetOrigin '*' (events carry no secrets);
 * the HOST validates event.origin against the shared lesson allowlist (which
 * trusts same-origin) before doing anything. This is a SEPARATE channel from
 * useLessonBridge — different message type, different award semantics — so the
 * curriculum lesson bridge is left completely untouched.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

// XP amounts (host-authoritative). Lesson matches the SI lesson award so a
// Simbot lesson is worth exactly what a curriculum lesson is; the internal-only
// Simbot economy contributes nothing else. Milestones are modest one-offs.
const SIMBOT_XP = {
  LESSON: XP.LESSON, // 50 — one platform award per Simbot lesson
  LEVEL_UP: 15, // modest, once per internal stage cleared
  FIRST_R: 30, // once ever — first profitable >= 1R trade
} as const;

type SimbotEvent = "ready" | "lesson_complete" | "level_up" | "first_profitable_r";

interface SimbotMessage {
  type: "fta-simbot";
  v?: number;
  event: SimbotEvent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Record<string, any>;
  ts?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSimbotMessage(d: any): d is SimbotMessage {
  return (
    d &&
    typeof d === "object" &&
    d.type === "fta-simbot" &&
    typeof d.event === "string" &&
    ["ready", "lesson_complete", "level_up", "first_profitable_r"].includes(d.event)
  );
}

/** Keep a client-supplied id safe to use inside a stored ref string. */
function safeId(v: unknown, max = 40): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, max);
}

export interface SimbotAward {
  /** Human label for the celebration toast. */
  label: string;
  xp: number;
  /** Belt-up fields when this award crossed a belt threshold, else null. */
  belt: ReturnType<typeof beltCelebrateFields>;
}

export interface SimbotBridgeOptions {
  supabase: DB;
  /** Only listen while the sim iframe is mounted. */
  enabled: boolean;
  /** Kid register -> gentler celebration copy in beltCelebrateFields. */
  isKid?: boolean;
  onReady?: () => void;
  onAward?: (award: SimbotAward) => void;
}

/**
 * Installs a window `message` listener that turns Simbot milestones into
 * platform XP. All writes are RLS-scoped to the current user and de-duped.
 */
export function useSimbotBridge(opts: SimbotBridgeOptions): void {
  const { supabase, enabled, isKid = false, onReady, onAward } = opts;

  useEffect(() => {
    if (!enabled) return;

    async function grant(
      kind: "lesson" | "bonus",
      amount: number,
      ref: string,
      label: string,
      userId: string
    ) {
      if (await hasXpForRef(supabase, userId, kind, ref)) return;
      const prevXp = await getUserXp(supabase, userId);
      await awardXp(supabase, userId, kind, amount, ref);
      const belt = beltCelebrateFields(prevXp, prevXp + amount, isKid);
      onAward?.({ label, xp: amount, belt });
    }

    async function handle(e: MessageEvent) {
      if (!isAllowedLessonOrigin(e.origin)) return;
      if (!isSimbotMessage(e.data)) return;
      const msg = e.data as SimbotMessage;

      if (msg.event === "ready") {
        onReady?.();
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      try {
        if (msg.event === "lesson_complete") {
          const id = safeId(msg.payload?.id);
          if (!id) return;
          await grant(
            "lesson",
            SIMBOT_XP.LESSON,
            `simbot-lesson-${id}`,
            "Simbot lesson complete",
            user.id
          );
        } else if (msg.event === "level_up") {
          const stage = safeId(msg.payload?.stage, 8);
          if (!stage) return;
          await grant(
            "bonus",
            SIMBOT_XP.LEVEL_UP,
            `simbot-stage-${stage}`,
            "Simbot stage cleared",
            user.id
          );
        } else if (msg.event === "first_profitable_r") {
          await grant(
            "bonus",
            SIMBOT_XP.FIRST_R,
            "simbot-first-r",
            "First 1R winner",
            user.id
          );
        }
      } catch (err) {
        console.warn("[simbotBridge] handler error:", err);
      }
    }

    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isKid, supabase]);
}
