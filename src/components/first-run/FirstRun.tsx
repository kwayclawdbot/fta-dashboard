"use client";

/**
 * FirstRun — the unified, per-PROFILE first-run layer that EVERY account-creation
 * path converges into (invite-code, email-first challenge, old quiz funnel, VIP
 * guest, $99 buyer, admin-created). It sequences three designed moments on a
 * user's first authenticated session, keyed on profile flags (never device
 * localStorage — that was the invite bug: a second account on a family member's
 * device got nothing):
 *
 *   1. Walkthrough — the existing AppTour (correct variant per register/tier;
 *      challenge variant for pass holders). FirstRun waits for it to finish.
 *   2. Add-to-Home-Screen — platform-aware, AFTER the tour: a real install
 *      button (captured beforeinstallprompt) on Chrome/Android/desktop, a
 *      designed instruction sheet on iOS Safari, silent skip when already
 *      installed or unsupported. Flag: profiles.install_prompted_at.
 *   3. Push pre-prompt — a branded value moment BEFORE the native permission
 *      dialog; only on accept do we call the browser API + subscribe. Kid
 *      profiles are skipped entirely. Flag: profiles.push_prompted_at.
 *
 * Legacy users (install/push flags null but the account predates the feature)
 * are gated by account age > 7d = skip silently. The tour keeps its own marker
 * (tour_completed_at), so no one who already toured is re-toured.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "@/lib/motion";
import { BellRing, Share, Plus, X, Smartphone, Download, Sparkles, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";
import { isIOS, isStandalone, pushSupported, subscribeToPush } from "@/lib/push";
import { getInstallPrompt, fireInstallPrompt } from "@/lib/installPrompt";

const LEGACY_AGE_DAYS = 7;
// Keep the older device-keyed push engine (NotificationOnboard) quiet while
// FirstRun owns the initial prompt, so a user never sees two push cards.
const K_PUSH_LAST_PROMPT = "fic-push-last-prompt";
const K_PUSH_INTENT = "fic-push-intent-pending";

interface FirstRunUser {
  display_name?: string;
  role?: string;
  isChallenge?: boolean;
  isSolo?: boolean;
}

type Phase = "idle" | "await-tour" | "install" | "push" | "done";

export default function FirstRun({ user }: { user: FirstRunUser }) {
  const supabase = createClient();
  const pathname = usePathname();
  const decidedRef = useRef(false);
  const uidRef = useRef<string | null>(null);
  const legacyRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("idle");

  const isKid = user.role === "child";
  const firstName = (user.display_name || "").split(" ")[0];

  const stamp = useCallback(
    async (col: "install_prompted_at" | "push_prompted_at") => {
      if (!uidRef.current) return;
      await supabase
        .from("profiles")
        .update({ [col]: new Date().toISOString() })
        .eq("id", uidRef.current)
        .then(undefined, () => {});
    },
    [supabase]
  );

  // ── Decide what (if anything) to show — once per session, on the dashboard. ──
  useEffect(() => {
    if (decidedRef.current) return;
    if (pathname !== "/dashboard") return; // first-run begins from the home base
    decidedRef.current = true;

    let alive = true;
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!alive || !authUser) return;
      uidRef.current = authUser.id;

      const { data: prof } = await supabase
        .from("profiles")
        .select("tour_completed_at, install_prompted_at, push_prompted_at, created_at")
        .eq("id", authUser.id)
        .single();
      if (!alive || !prof) return;

      const ageDays = prof.created_at
        ? (Date.now() - new Date(prof.created_at).getTime()) / 86_400_000
        : 0;
      legacyRef.current = ageDays > LEGACY_AGE_DAYS;

      const needTour = !prof.tour_completed_at;
      const needInstall = !prof.install_prompted_at && !legacyRef.current;
      const needPush = !prof.push_prompted_at && !legacyRef.current && !isKid;

      // If FirstRun will own the push moment, silence the legacy device-keyed
      // engine so it can't double-prompt during first-run.
      if (needPush || needInstall) {
        try {
          localStorage.setItem(K_PUSH_LAST_PROMPT, String(Date.now()));
          localStorage.removeItem(K_PUSH_INTENT);
        } catch { /* ignore */ }
      }

      if (needTour) {
        // Wait for the walkthrough to finish, then continue to install/push.
        setPhase("await-tour");
        return;
      }
      advanceToInstall();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ── After the tour finishes (event from AppTour.finish), advance. ──
  useEffect(() => {
    function onTourDone() {
      if (phase === "await-tour") advanceToInstall();
    }
    window.addEventListener("fic:tour-finished", onTourDone as EventListener);
    return () => window.removeEventListener("fic:tour-finished", onTourDone as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Manual re-entry from Settings/Help (revisit the install sheet anytime). ──
  useEffect(() => {
    async function onManualInstall() {
      if (!uidRef.current) {
        const { data: { user: u } } = await supabase.auth.getUser();
        uidRef.current = u?.id ?? null;
      }
      if (!isStandalone()) setPhase("install");
      else toast("You're already installed 🎉");
    }
    window.addEventListener("fic:firstrun-install", onManualInstall as EventListener);
    return () => window.removeEventListener("fic:firstrun-install", onManualInstall as EventListener);
  }, [supabase]);

  // Decide whether the install step has anything to show; else fall through.
  const advanceToInstall = useCallback(() => {
    (async () => {
      // Re-read the flags fresh in case the tour path changed them.
      const uid = uidRef.current;
      if (!uid) return advanceToPush();
      const { data: prof } = await supabase
        .from("profiles")
        .select("install_prompted_at")
        .eq("id", uid)
        .single();
      const alreadyDone = !!prof?.install_prompted_at || legacyRef.current;
      const installable = !isStandalone() && (isIOS() || !!getInstallPrompt());
      if (alreadyDone || !installable) {
        if (!legacyRef.current && !prof?.install_prompted_at) stamp("install_prompted_at");
        return advanceToPush();
      }
      // Small settle delay so it lands after the tour's celebration/navigation.
      setTimeout(() => setPhase("install"), 700);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, stamp]);

  const advanceToPush = useCallback(() => {
    (async () => {
      const uid = uidRef.current;
      if (!uid || isKid || legacyRef.current) { setPhase("done"); return; }
      const { data: prof } = await supabase
        .from("profiles")
        .select("push_prompted_at")
        .eq("id", uid)
        .single();
      if (prof?.push_prompted_at) { setPhase("done"); return; }

      // Only PRE-prompt when the native permission is still undecided AND the
      // platform can actually subscribe. Otherwise stamp + skip (iOS-in-Safari
      // was already guided to install; granted → self-heal covers; denied →
      // never nag).
      const canPrompt =
        pushSupported() &&
        typeof Notification !== "undefined" &&
        Notification.permission === "default";
      if (!canPrompt) { stamp("push_prompted_at"); setPhase("done"); return; }
      setTimeout(() => setPhase("push"), 500);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, stamp, isKid]);

  // ── Install handlers ──
  const iosInstall = isIOS() && !isStandalone();
  async function doInstall() {
    if (!iosInstall) {
      const outcome = await fireInstallPrompt();
      if (outcome === "accepted") toast("Installing…");
    }
    stamp("install_prompted_at");
    setPhase("idle");
    advanceToPush();
  }
  function skipInstall() {
    stamp("install_prompted_at");
    setPhase("idle");
    advanceToPush();
  }

  // ── Push handlers ──
  const [pushBusy, setPushBusy] = useState(false);
  async function enablePush() {
    const uid = uidRef.current;
    if (!uid) return;
    setPushBusy(true);
    // Resilient: whatever happens with the subscribe (blocked, no push service,
    // network hiccup), we stamp the flag so the user is never re-prompted after
    // a real attempt — Settings offers a quiet re-entry either way.
    let r: { ok: boolean; status: string } = { ok: false, status: "ready" };
    try {
      r = await subscribeToPush(supabase, uid); // requests permission in-gesture
    } catch {
      /* subscribe failed — flag still stamped below */
    }
    setPushBusy(false);
    stamp("push_prompted_at");
    setPhase("done");
    if (r.ok) toast("Notifications on");
    else if (r.status === "denied") toast("No problem — turn them on anytime in Settings");
  }
  function declinePush() {
    stamp("push_prompted_at");
    setPhase("done");
  }

  return (
    <>
      {/* ── Add-to-Home-Screen ─────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "install" && (
          <Sheet onClose={skipInstall}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-display text-lg font-bold text-midnight-50">
                {iosInstall ? "Add to your Home Screen" : "Install the app"}
              </h3>
              <CloseBtn onClick={skipInstall} />
            </div>
            <p className="text-sm text-midnight-400 mb-5">
              {iosInstall
                ? "Keep the Club one tap away — and it unlocks notifications on iPhone. Two quick taps:"
                : "Get a real app on your home screen — faster, full-screen, and ready for notifications."}
            </p>

            {iosInstall ? (
              <>
                <ol className="space-y-3">
                  <li className="flex items-center gap-3">
                    <StepDot n={1} />
                    <span className="text-sm text-midnight-100 flex items-center gap-1.5 flex-wrap">
                      Tap the
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-midnight-800 text-gold-400 font-medium">
                        <Share className="w-3.5 h-3.5" /> Share
                      </span>
                      icon in Safari
                    </span>
                  </li>
                  <li className="flex items-center gap-3">
                    <StepDot n={2} />
                    <span className="text-sm text-midnight-100 flex items-center gap-1.5 flex-wrap">
                      Choose
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-midnight-800 text-midnight-100 font-medium">
                        <Plus className="w-3.5 h-3.5" /> Add to Home Screen
                      </span>
                    </span>
                  </li>
                </ol>
                <button onClick={skipInstall} className="mt-6 w-full cta-button px-4 py-2.5 rounded-xl text-sm font-semibold">
                  Got it
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={doInstall}
                  className="flex-1 cta-button px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Install
                </button>
                <button
                  onClick={skipInstall}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-midnight-400 hover:text-midnight-200"
                >
                  Not now
                </button>
              </div>
            )}
          </Sheet>
        )}
      </AnimatePresence>

      {/* ── Push pre-prompt ────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "push" && (
          <Sheet onClose={declinePush}>
            <div className="flex items-start gap-3 mb-1">
              <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gold-400/15 text-gold-500 shrink-0">
                {user.isChallenge ? <CalendarClock className="w-5 h-5" /> : <BellRing className="w-5 h-5" />}
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-midnight-50">
                  {firstName ? `Stay in the loop, ${firstName}` : "Stay in the loop"}
                </h3>
                <p className="text-sm text-midnight-400 mt-1 leading-relaxed">
                  {user.isChallenge
                    ? "Get a reminder before each live session so you never miss a day of the challenge — and a ping when Kai spots something on your watchlist."
                    : "Let Kai ping you the moment your alerts fire, plus a heads-up before live classes. No spam — only the stuff you asked for."}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-midnight-500">
              <Sparkles className="w-3.5 h-3.5 text-gold-500" />
              You choose exactly what pings you — change it anytime in Settings.
            </div>
            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={enablePush}
                disabled={pushBusy}
                className="flex-1 cta-button px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <BellRing className="w-4 h-4" /> {pushBusy ? "Turning on…" : "Turn on notifications"}
              </button>
              <button
                onClick={declinePush}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-midnight-400 hover:text-midnight-200"
              >
                Not now
              </button>
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Shared bottom-sheet shell (D1: branded, spring-in, dismissible) ──────────
function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <m.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-midnight-900 border border-gold-400/25 p-6 shadow-2xl"
      >
        {children}
      </m.div>
    </m.div>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Close" className="text-midnight-500 hover:text-midnight-300">
      <X className="w-5 h-5" />
    </button>
  );
}

function StepDot({ n }: { n: number }) {
  return (
    <span className="grid place-items-center w-8 h-8 rounded-full bg-gold-400/15 text-gold-500 text-sm font-bold shrink-0">
      {n}
    </span>
  );
}
