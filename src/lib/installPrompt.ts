"use client";

/**
 * Early capture of the Chrome/Android `beforeinstallprompt` event.
 *
 * The event fires soon after load — long before the FirstRun install step runs
 * (it comes after the walkthrough). We stash it at module import time (this
 * module is pulled in by DashboardShell, part of the first dashboard render) so
 * the install step can offer a REAL install button later. iOS Safari never fires
 * this — the FirstRun install step shows the Add-to-Home-Screen sheet there
 * instead. Where no event was captured and it isn't iOS, the step skips silently.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferred: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep it from showing Chrome's mini-infobar; we drive it
    deferred = e as BeforeInstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
  });
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferred;
}

/** Fire the captured native install prompt. Returns 'accepted' | 'dismissed' |
 *  'unavailable'. Consumes the event either way (it's single-use). */
export async function fireInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const e = deferred;
  if (!e) return "unavailable";
  deferred = null;
  try {
    await e.prompt();
    const choice = await e.userChoice;
    return choice.outcome;
  } catch {
    return "dismissed";
  }
}
