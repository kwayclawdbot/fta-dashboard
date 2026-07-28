"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "@/lib/motion";
import { BellRing, Share, Plus, X, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { useSelfHealPush } from "@/lib/useSelfHealPush";
import {
  isIOS,
  isStandalone,
  pushSupported,
  subscribeToPush,
} from "@/lib/push";

/**
 * NotificationOnboard — one globally-mounted, platform-aware enrollment engine.
 *
 * It replaces "go to Settings and flip a switch" with contextual, capped,
 * one-tap enrollment, and — on installed iOS — with a fully automatic first-tap
 * grant. Also drives the SILENT self-heal via useSelfHealPush.
 *
 * PLATFORM MATRIX (permission === 'default' unless noted):
 *  ┌ Android / desktop browser → one-tap card at high-intent moments.
 *  │    click → requestPermission → subscribe → "Notifications on" toast.
 *  ├ iOS Safari, NOT installed → compact "2 steps" banner → visual sheet
 *  │    (Share → Add to Home Screen). Can't verify install from Safari, so we
 *  │    only cap + dismiss.
 *  ├ iOS INSTALLED (standalone) → NO sheet. A one-time capture-phase listener
 *  │    calls Notification.requestPermission() on the user's FIRST tap anywhere
 *  │    (satisfies Apple's gesture rule), then subscribes + toasts. Declined →
 *  │    never re-prompt (iOS burns the permission).
 *  └ permission 'denied' → render nothing (Settings shows the honest state).
 *
 * CAPS (card + banner only): max one prompt per 3 days; after 2 dismissals,
 * never again. Never shown on funnel/public pages (this only mounts inside the
 * authed DashboardShell, but we still bail on non-app routes defensively).
 */

const K_LAST_PROMPT = "fic-push-last-prompt";
const K_DISMISS = "fic-push-dismiss-count";
const K_IOS_TAPPED = "fic-push-ios-autoprompt";
const K_INTENT_PENDING = "fic-push-intent-pending"; // set by onboarding completion
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

// High-intent route(s) that themselves count as a prompt moment. Community was
// removed (audit item 5) — landing on the feed no longer auto-fires the push
// prompt; enrollment via the onboarding-completion intent flag is unchanged.
const INTENT_ROUTES: string[] = [];
// Never prompt on these even though they can render inside the shell.
const SUPPRESS_ROUTES = ["/settings", "/onboarding", "/upgrade"];

function getNum(key: string): number {
  try {
    return Number(localStorage.getItem(key) || "0");
  } catch {
    return 0;
  }
}
function setNum(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* ignore */
  }
}

export default function NotificationOnboard() {
  const supabase = createClient();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false); // android/desktop one-tap
  const [showIosBanner, setShowIosBanner] = useState(false); // iOS not-installed
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const iosListenerAttached = useRef(false);

  // Resolve the signed-in user id (self-heal + subscribe both need it).
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setUserId(data.user?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [supabase]);

  // Silent self-heal — invisible, once/day, only when permission granted.
  useSelfHealPush(userId, supabase);

  const capsAllowPrompt = useCallback((): boolean => {
    if (getNum(K_DISMISS) >= 2) return false; // dismissed twice → never again
    const last = getNum(K_LAST_PROMPT);
    if (Date.now() - last < THREE_DAYS) return false; // 1 per 3 days
    return true;
  }, []);

  // ── iOS installed: attach a one-time first-tap auto-prompt ─────────────────
  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (!isIOS() || !isStandalone()) return;
    if (Notification.permission !== "default") return; // granted → heal covers; denied → never
    if (getNum(K_IOS_TAPPED) === 1) return; // already tried once this install
    if (iosListenerAttached.current) return;
    iosListenerAttached.current = true;

    const handler = () => {
      // Fire once. Mark BEFORE the async work so a rapid double-tap can't
      // double-prompt, and so a decline is never retried (iOS burns it).
      setNum(K_IOS_TAPPED, 1);
      window.removeEventListener("pointerdown", handler, true);
      window.removeEventListener("click", handler, true);
      // requestPermission must run synchronously in this gesture task —
      // subscribeToPush does its guard checks synchronously then requests.
      subscribeToPush(supabase, userId).then((r) => {
        if (r.ok) toast("Notifications on");
        // Declined/dismissed: stay silent. Settings offers a quiet re-entry.
      });
    };

    // Capture phase so we see the very first tap regardless of stopPropagation.
    window.addEventListener("pointerdown", handler, true);
    window.addEventListener("click", handler, true);
    return () => {
      window.removeEventListener("pointerdown", handler, true);
      window.removeEventListener("click", handler, true);
    };
  }, [userId, supabase]);

  // ── Card / banner decision (android+desktop, iOS-not-installed) ────────────
  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (SUPPRESS_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
      return;
    }

    const iosUninstalled = isIOS() && !isStandalone();

    // Supported browser (android/desktop) needs permission 'default' to prompt.
    const supportedDefault =
      pushSupported() && Notification.permission === "default";

    if (!iosUninstalled && !supportedDefault) return; // nothing to do

    // Is this a high-intent moment? Either an intent route, or a pending flag
    // set at onboarding completion, or a runtime 'fic:notify-intent' event.
    let intentPending = false;
    try {
      intentPending = localStorage.getItem(K_INTENT_PENDING) === "1";
    } catch {
      /* ignore */
    }
    const onIntentRoute = INTENT_ROUTES.some(
      (r) => pathname === r || pathname.startsWith(r + "/")
    );

    function maybeShow() {
      if (!capsAllowPrompt()) return;
      if (iosUninstalled) setShowIosBanner(true);
      else setShowCard(true);
      setNum(K_LAST_PROMPT, Date.now());
      try {
        localStorage.removeItem(K_INTENT_PENDING);
      } catch {
        /* ignore */
      }
    }

    if (onIntentRoute || intentPending) {
      // Small delay so the prompt lands after the page settles, not mid-nav.
      const t = setTimeout(maybeShow, 1200);
      return () => clearTimeout(t);
    }

    // Otherwise wait for an explicit runtime intent event (first RSVP, etc.).
    function onIntent() {
      maybeShow();
    }
    window.addEventListener("fic:notify-intent", onIntent);
    return () => window.removeEventListener("fic:notify-intent", onIntent);
  }, [userId, pathname, capsAllowPrompt]);

  const dismiss = useCallback(() => {
    setNum(K_DISMISS, getNum(K_DISMISS) + 1);
    setShowCard(false);
    setShowIosBanner(false);
    setShowIosSheet(false);
  }, []);

  async function enable() {
    if (!userId) return;
    setBusy(true);
    const r = await subscribeToPush(supabase, userId);
    setBusy(false);
    setShowCard(false);
    if (r.ok) {
      toast("Notifications on");
    } else if (r.status === "denied") {
      // User blocked at the browser prompt — count it and don't nag.
      setNum(K_DISMISS, 2);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Android / desktop one-tap card */}
      <AnimatePresence>
        {showCard && (
          <m.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="fixed z-[90] bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 right-4 md:right-6 left-4 md:left-auto md:w-80"
          >
            <div className="club-b-card relative p-4 shadow-[var(--shadow-lift)] backdrop-blur">
              <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="f0-focus absolute right-2.5 top-2.5 rounded text-soft transition-colors hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-start gap-3">
                <span className="grid place-items-center w-9 h-9 rounded-xl bg-gold-400/15 text-gold-500 shrink-0">
                  <BellRing className="w-4.5 h-4.5" />
                </span>
                <div className="pr-4">
                  <p className="text-sm font-semibold text-ink">
                    Turn on notifications
                  </p>
                  <p className="text-xs text-soft mt-0.5">
                    Class reminders + replies, one tap.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3.5">
                <button
                  onClick={enable}
                  disabled={busy}
                  className="f0-press f0-focus flex-1 rounded-lg bg-accent font-display font-bold tracking-[0.02em] text-[color:var(--accent-on)] px-3 py-2 text-xs disabled:opacity-50"
                >
                  {busy ? "Turning on…" : "Turn on"}
                </button>
                <button
                  onClick={dismiss}
                  className="f0-focus rounded-lg px-3 py-2 text-xs font-medium text-soft transition-colors hover:text-ink"
                >
                  Not now
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* iOS (not installed) compact guided banner */}
      <AnimatePresence>
        {showIosBanner && (
          <m.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            className="fixed z-[90] bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 left-4"
          >
            <div className="club-b-card relative flex items-center gap-3 p-3.5 shadow-[var(--shadow-lift)] backdrop-blur">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-gold-400/15 text-gold-500 shrink-0">
                <Smartphone className="w-4.5 h-4.5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">
                  Get notifications on iPhone
                </p>
                <p className="text-xs text-soft">2 steps · takes 10 seconds</p>
              </div>
              <button
                onClick={() => setShowIosSheet(true)}
                className="f0-press f0-focus shrink-0 rounded-lg bg-accent font-display font-bold tracking-[0.02em] text-[color:var(--accent-on)] px-3 py-2 text-xs"
              >
                Show me
              </button>
              <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="f0-focus shrink-0 rounded text-soft transition-colors hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* iOS visual "Add to Home Screen" sheet */}
      <AnimatePresence>
        {showIosSheet && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-scrim fixed inset-0 z-[95] flex items-end justify-center p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setShowIosSheet(false)}
          >
            <m.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl border border-sand bg-card p-6 shadow-[var(--shadow-lift)]"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display text-lg font-bold text-ink">
                  Add to Home Screen
                </h3>
                <button
                  onClick={() => setShowIosSheet(false)}
                  aria-label="Close"
                  className="f0-focus rounded text-soft transition-colors hover:text-ink"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-soft mb-5">
                Notifications on iPhone need the app on your Home Screen. Two taps:
              </p>

              <ol className="space-y-3">
                <li className="flex items-center gap-3">
                  <span className="grid place-items-center w-8 h-8 rounded-full bg-gold-400/15 text-gold-500 text-sm font-bold shrink-0">
                    1
                  </span>
                  <span className="text-sm text-ink flex items-center gap-1.5">
                    Tap the{" "}
                    <span className="inline-flex items-center gap-1 rounded-md bg-sand px-1.5 py-0.5 font-medium text-accent">
                      <Share className="w-3.5 h-3.5" /> Share
                    </span>{" "}
                    icon in Safari
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid place-items-center w-8 h-8 rounded-full bg-gold-400/15 text-gold-500 text-sm font-bold shrink-0">
                    2
                  </span>
                  <span className="text-sm text-ink flex items-center gap-1.5">
                    Choose{" "}
                    <span className="inline-flex items-center gap-1 rounded-md bg-sand px-1.5 py-0.5 font-medium text-ink">
                      <Plus className="w-3.5 h-3.5" /> Add to Home Screen
                    </span>
                  </span>
                </li>
              </ol>

              <p className="text-xs text-ink0 mt-5 leading-relaxed">
                Then open the app from your Home Screen and tap anywhere once — it
                turns notifications on by itself.
              </p>

              <button
                onClick={() => {
                  setShowIosSheet(false);
                  dismiss();
                }}
                className="f0-press f0-focus mt-5 w-full rounded-xl bg-accent font-display font-bold tracking-[0.02em] text-[color:var(--accent-on)] px-4 py-2.5 text-sm"
              >
                Got it
              </button>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
