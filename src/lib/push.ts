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

/**
 * Human-readable device label parsed from a User-Agent string, e.g.
 * "iPhone · Safari", "Mac · Chrome", "Android · Chrome". Used for the Settings
 * device list and stored on the subscription row (device_label). Best-effort —
 * falls back to "This device".
 */
export function parseDeviceLabel(ua: string | null | undefined): string {
  if (!ua) return "This device";
  let os = "Device";
  if (/iphone/i.test(ua)) os = "iPhone";
  else if (/ipad/i.test(ua)) os = "iPad";
  else if (/macintosh|mac os x/i.test(ua)) os = "Mac";
  else if (/android/i.test(ua)) os = "Android";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "";
  // Order matters: Edge/Chrome UA strings also contain "Safari".
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/crios|chrome/i.test(ua)) browser = "Chrome";
  else if (/fxios|firefox/i.test(ua)) browser = "Firefox";
  else if (/version\/[\d.]+.*safari/i.test(ua) || /safari/i.test(ua)) browser = "Safari";

  return browser ? `${os} · ${browser}` : os;
}

/** A stable-ish per-install key for localStorage throttling (not for identity). */
export function deviceKey(): string {
  if (typeof navigator === "undefined") return "unknown";
  return parseDeviceLabel(navigator.userAgent);
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
  // Guard checks are SYNCHRONOUS so that Notification.requestPermission() below
  // runs inside the same user-gesture task. iOS Safari rejects the prompt if an
  // await (e.g. an async getPushStatus) breaks the gesture chain first.
  if (!pushSupported()) {
    return {
      ok: false,
      status: isIOS() && !isStandalone() ? "ios-needs-install" : "unsupported",
    };
  }
  if (Notification.permission === "denied") {
    return { ok: false, status: "denied" };
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!vapidKey) {
    return { ok: false, status: "ready", error: "Push keys not configured" };
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

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: ua ? ua.slice(0, 255) : null,
      device_label: parseDeviceLabel(ua),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  return !error;
}

/**
 * SILENT self-heal — the core of "the owner never has to re-enable push".
 *
 * Mounted globally (DashboardShell) and throttled to once/day/device via
 * localStorage. Does NOTHING visible and NEVER prompts for permission. It only
 * runs when permission is ALREADY granted. Steps:
 *   1. Read the browser's live PushSubscription.
 *   2. If there is none, re-subscribe with the VAPID key (permission is
 *      already granted, so this is silent) and upsert it.
 *   3. If there is one, compare its endpoint to what the server has for THIS
 *      user + this device. If it's missing server-side (the exact "accepted
 *      but dead" bug — a row that Apple later rotated away from), or the row
 *      is stale, upsert it and bump last_seen_at.
 *   4. Delete this user's OTHER dead endpoints for the same device_label so a
 *      rotated device doesn't accumulate ghost rows.
 *
 * Returns a small result for tests/telemetry; callers ignore it in prod.
 */
export async function healPush(
  supabase: SupabaseClient,
  userId: string
): Promise<{ healed: boolean; reason: string }> {
  if (!pushSupported() || Notification.permission !== "granted") {
    return { healed: false, reason: "no-permission" };
  }
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!vapidKey) return { healed: false, reason: "no-vapid" };

  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) reg = (await registerServiceWorker()) ?? undefined;
    if (!reg) return { healed: false, reason: "no-registration" };
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();

    // (2) No live browser subscription → re-subscribe silently.
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });
      await saveSubscription(supabase, userId, sub);
      await pruneOtherDeviceEndpoints(supabase, userId, sub.endpoint);
      return { healed: true, reason: "resubscribed-missing" };
    }

    // (3) Live subscription exists — is it stored server-side for this user?
    const { data: existing } = await supabase
      .from("push_subscriptions")
      .select("id, last_seen_at")
      .eq("user_id", userId)
      .eq("endpoint", sub.endpoint)
      .maybeSingle();

    if (!existing) {
      // Endpoint drifted from what the server has (or was pruned as a 410) —
      // this is the owner's "accepted but dead" case. Re-store it.
      await saveSubscription(supabase, userId, sub);
      await pruneOtherDeviceEndpoints(supabase, userId, sub.endpoint);
      return { healed: true, reason: "reupserted-drift" };
    }

    // Row present — just bump liveness so the 60-day sweep never reaps an
    // actively-open device.
    await supabase
      .from("push_subscriptions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", existing.id);
    return { healed: false, reason: "already-live" };
  } catch {
    return { healed: false, reason: "error" };
  }
}

/**
 * Remove this user's dead endpoints for the same device (same device_label)
 * that are NOT the current live endpoint — cleans up rotated Apple/FCM
 * endpoints so Settings shows one row per real device.
 */
async function pruneOtherDeviceEndpoints(
  supabase: SupabaseClient,
  userId: string,
  keepEndpoint: string
): Promise<void> {
  try {
    const label = parseDeviceLabel(
      typeof navigator !== "undefined" ? navigator.userAgent : null
    );
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("device_label", label)
      .neq("endpoint", keepEndpoint);
  } catch {
    // best-effort
  }
}

export interface DeviceRow {
  id: string;
  endpoint: string;
  device_label: string | null;
  user_agent: string | null;
  last_seen_at: string | null;
  created_at: string;
  is_this_device: boolean;
}

/** List the user's subscribed devices (for Settings), flagging the current one. */
export async function listDevices(
  supabase: SupabaseClient,
  userId: string
): Promise<DeviceRow[]> {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, device_label, user_agent, last_seen_at, created_at")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false });
  if (!data) return [];

  let thisEndpoint: string | null = null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    thisEndpoint = sub?.endpoint ?? null;
  } catch {
    // ignore
  }

  return data.map((d) => ({
    id: d.id as string,
    endpoint: d.endpoint as string,
    device_label:
      (d.device_label as string | null) ?? parseDeviceLabel(d.user_agent as string | null),
    user_agent: d.user_agent as string | null,
    last_seen_at: d.last_seen_at as string | null,
    created_at: d.created_at as string,
    is_this_device: thisEndpoint != null && d.endpoint === thisEndpoint,
  }));
}

/** Remove one device row by id. If it's the current browser, also unsubscribe. */
export async function removeDevice(
  supabase: SupabaseClient,
  id: string,
  endpoint: string
): Promise<void> {
  await supabase.from("push_subscriptions").delete().eq("id", id);
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub && sub.endpoint === endpoint) await sub.unsubscribe();
  } catch {
    // best-effort
  }
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
