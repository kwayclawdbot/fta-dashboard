/* FTA service worker — Web Push + notification click + self-healing subscriptions.
 *
 * SW_VERSION: bump this on every change so installed PWAs pick up the new
 * worker. `skipWaiting()` + `clients.claim()` make the update take over
 * immediately rather than waiting for all tabs to close.
 */
const SW_VERSION = "2026-07-22-2"; // self-heal: pushsubscriptionchange handler

// Public VAPID key — safe to embed (already shipped in the client bundle via
// NEXT_PUBLIC_VAPID_PUBLIC_KEY). Used to silently re-subscribe when the browser
// rotates the push endpoint out from under us (the "accepted but dead" bug).
const VAPID_PUBLIC_KEY =
  "BGJ_GZIcUFJH6HY9fvMkqnDcU0ZhcTCxneT5KBK-eubmvdAVhqAujVDa7eH2CfGCSO7a0jiu_UxfIkCy-oESuG4";

function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Family Trading Academy", body: event.data && event.data.text() };
  }

  const title = data.title || "Family Trading Academy";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/community" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/community";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Focus an existing tab if one is open, and route it
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client && new URL(client.url).pathname !== url) {
            client.navigate(url);
          }
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

/*
 * pushsubscriptionchange — fired by the browser when it rotates/expires the
 * push endpoint (common on iOS/Apple and after long idle). Without handling
 * this, the server's stored endpoint silently goes dead. We re-subscribe with
 * the same VAPID key and POST the fresh subscription to /api/push/resubscribe,
 * which identifies the user via the same-origin auth cookie and upserts it.
 * Combined with the client-side once/day heal, subscriptions self-maintain.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        let sub = event.newSubscription;
        if (!sub) {
          sub = await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }
        const json = sub.toJSON();
        const oldEndpoint =
          (event.oldSubscription && event.oldSubscription.endpoint) || null;
        await fetch("/api/push/resubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // send the Supabase auth cookie
          body: JSON.stringify({
            old_endpoint: oldEndpoint,
            endpoint: json.endpoint,
            p256dh: json.keys && json.keys.p256dh,
            auth: json.keys && json.keys.auth,
          }),
        });
      } catch (err) {
        // Best-effort — the once/day client heal will re-link on next open.
        console.error("[sw] pushsubscriptionchange failed:", err);
      }
    })()
  );
});
