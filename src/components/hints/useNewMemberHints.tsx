"use client";

/**
 * useNewMemberHints — instructional "how to use this" notation that auto-hides
 * for seasoned members (Lane 7A).
 *
 * A hint spot is visible while BOTH hold:
 *   1. the account is still "new" — (now − profiles.created_at) < 24h, and
 *   2. the member hasn't manually dismissed that specific spot.
 * After the window closes (or on dismissal) the full hint disappears and each
 * spot keeps a tiny "?" affordance so the help is never lost, just no longer
 * imposed. Reopening from the "?" shows the hint for the rest of the session
 * without un-dismissing it permanently.
 *
 * Signals & storage (NO migration — created_at + localStorage covers it):
 *   • the "new member" window reads profiles.created_at (cached in localStorage
 *     permanently since it never changes — one query per device, ever);
 *   • dismissals persist per-hint under `fic-hint-<key>` in localStorage.
 *
 * Compliance disclaimers (Ask Kai "educational, not advice", the watchlist
 * "prices delayed / not investment advice" line, the community disclaimer
 * footer) are NEVER wrapped in this hook — they must always be visible.
 */

import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const CREATED_AT_LS = "fic-created-at";
const hintKey = (key: string) => `fic-hint-${key}`;

// ── created_at resolution, cached across every hook instance ──────────────────
// undefined = not yet loaded; null = unknown/no session; number = epoch ms.
let cachedCreatedAt: number | null | undefined;
let inflight: Promise<number | null> | null = null;

async function resolveCreatedAt(): Promise<number | null> {
  if (cachedCreatedAt !== undefined) return cachedCreatedAt ?? null;
  // localStorage is authoritative once written — created_at is immutable.
  try {
    const ls = localStorage.getItem(CREATED_AT_LS);
    if (ls !== null) {
      cachedCreatedAt = ls === "null" ? null : Number(ls);
      return cachedCreatedAt ?? null;
    }
  } catch {
    /* ignore */
  }
  if (!inflight) {
    inflight = (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          cachedCreatedAt = null;
        } else {
          const { data } = await supabase
            .from("profiles")
            .select("created_at")
            .eq("id", user.id)
            .single();
          cachedCreatedAt = data?.created_at
            ? new Date(data.created_at).getTime()
            : null;
        }
      } catch {
        cachedCreatedAt = null;
      }
      try {
        localStorage.setItem(
          CREATED_AT_LS,
          cachedCreatedAt == null ? "null" : String(cachedCreatedAt)
        );
      } catch {
        /* ignore */
      }
      return cachedCreatedAt ?? null;
    })();
  }
  return inflight;
}

/** Whether this account is still inside the 24h "new member" window. */
export function useNewMemberWindow(): { ready: boolean; withinWindow: boolean } {
  const [state, setState] = useState({ ready: false, withinWindow: false });
  useEffect(() => {
    let mounted = true;
    resolveCreatedAt().then((ts) => {
      if (!mounted) return;
      const withinWindow = ts != null && Date.now() - ts < WINDOW_MS;
      setState({ ready: true, withinWindow });
    });
    return () => {
      mounted = false;
    };
  }, []);
  return state;
}

export interface HintSpot {
  /** Render the full instructional hint. */
  show: boolean;
  /** Render the tiny "?" reopen affordance instead of the full hint. */
  showReopen: boolean;
  /** created_at resolved — until then render neither to avoid a flash. */
  ready: boolean;
  /** Permanently dismiss this spot (survives reloads). */
  dismiss: () => void;
  /** Reopen the hint for the rest of this session. */
  reopen: () => void;
}

/**
 * One instructional spot. `show` drives the full hint; `showReopen` drives the
 * "?" button. Exactly one of them is ever true once `ready`.
 */
export function useNewMemberHints(key: string): HintSpot {
  const { ready, withinWindow } = useNewMemberWindow();
  const [dismissed, setDismissed] = useState(false);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(hintKey(key)) === "1");
    } catch {
      /* ignore */
    }
  }, [key]);

  const dismiss = () => {
    try {
      localStorage.setItem(hintKey(key), "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setReopened(false);
  };
  const reopen = () => setReopened(true);

  const show = ready && (reopened || (withinWindow && !dismissed));
  const showReopen = ready && !show;

  return { show, showReopen, ready, dismiss, reopen };
}

/** Tiny "?" affordance shown once a hint has expired or been dismissed. */
export function HintReopen({
  onClick,
  label = "How this works",
  className = "",
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1 text-[11px] font-semibold text-soft/70 hover:text-ink transition-colors ${className}`}
    >
      <HelpCircle className="h-3.5 w-3.5" />
    </button>
  );
}

/** Small dismiss (×) button for the corner of a full hint. */
export function HintDismiss({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Got it — hide this"
      aria-label="Dismiss hint"
      className={`shrink-0 rounded-md p-0.5 text-soft/60 hover:bg-paper hover:text-ink transition-colors ${className}`}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}
