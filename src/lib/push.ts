import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Web Push client helpers (VAPID, no vendor).
 *
 * iOS caveat: Safari only exposes PushManager to web apps installed to the
 * Home Screen (iOS 16.4+). In-browser iOS reports "unsupported" — the UI
 * shows an "Add to Home Screen" hint instead of the enable button.
 */

export type PushStatus =
  | "unsupported"
  | "ios-needs-install"
  | "denied"
  | "subscribed"
  | "ready"; // supported + permission not denied + not yet subscribed

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS masquerades as macOS
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) {
    return isIOS() && !isStandalone() ? "ios-needs-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub && Notification.permission === "granted") return "subscribed";
  } catch {
    // fall through
  }
  return "ready";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Request permission (must be called from a user gesture), subscribe with the
 * VAPID public key, and upsert the subscription to push_subscriptions.
 */
export async function subscribeToPush(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: boolean; status: PushStatus; error?: string }> {
  const status = await getPushStatus();
  if (status === "unsupported" || status === "ios-needs-install" || status === "denied") {
    return { ok: false, status };
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!vapidKey) {
    return { ok: false, status, error: "Push keys not configured" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, status: permission === "denied" ? "denied" : "ready" };
  }

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, status: "unsupported" };
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
    });
  }

  const saved = await saveSubscription(supabase, userId, sub);
  if (!saved) {
    // Endpoint may belong to a different account from this browser (RLS blocks
    // the upsert). Re-subscribe to mint a fresh endpoint for this user.
    await sub.unsubscribe();
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
    });
    const retried = await saveSubscription(supabase, userId, sub);
    if (!retried) return { ok: false, status: "ready", error: "Could not save subscription" };
  }

  return { ok: true, status: "subscribed" };
}

async function saveSubscription(
  supabase: SupabaseClient,
  userId: string,
  sub: PushSubscription
): Promise<boolean> {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 255) : null,
    },
    { onConflict: "endpoint" }
  );
  return !error;
}

/** Unsubscribe this browser and remove its row. */
export async function unsubscribeFromPush(supabase: SupabaseClient): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    // best-effort
  }
}
