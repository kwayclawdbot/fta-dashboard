"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, Smartphone, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
} from "@/lib/push";

/**
 * "Enable push notifications" control — used in the bell dropdown footer and
 * on the Settings page. Never auto-prompts: permission is only requested from
 * the button click.
 */
export default function EnablePushButton({ compact = false }: { compact?: boolean }) {
  const supabase = createClient();
  const [status, setStatus] = useState<PushStatus | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getPushStatus().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleEnable() {
    setBusy(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    const result = await subscribeToPush(supabase, user.id);
    setStatus(result.status);
    if (!result.ok && result.error) setError(result.error);
    setBusy(false);
  }

  async function handleDisable() {
    setBusy(true);
    await unsubscribeFromPush(supabase);
    refresh();
    setBusy(false);
  }

  if (status === "loading") return null;

  if (status === "ios-needs-install") {
    return (
      <div className="flex items-start gap-2 text-xs text-midnight-400">
        <Smartphone className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gold-600" />
        <span>
          On iPhone, tap <span className="font-medium text-midnight-300">Share</span> →{" "}
          <span className="font-medium text-midnight-300">Add to Home Screen</span>, then open
          the app to get notifications.
        </span>
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <p className="text-xs text-midnight-500">
        Push notifications aren&apos;t supported in this browser.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex items-start gap-2 text-xs text-midnight-400">
        <BellOff className="w-3.5 h-3.5 mt-0.5 shrink-0 text-midnight-500" />
        <span>
          Notifications are blocked for this site. To turn them on, allow notifications in your
          browser settings and come back.
        </span>
      </div>
    );
  }

  if (status === "subscribed") {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600">
          <Check className="w-3.5 h-3.5" />
          Push notifications on
        </span>
        {!compact && (
          <button
            onClick={handleDisable}
            disabled={busy}
            className="text-xs text-midnight-500 hover:text-midnight-300 transition-colors disabled:opacity-50"
          >
            Turn off
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleEnable}
        disabled={busy}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gold-400/40 bg-gold-400/10 text-gold-700 text-xs font-semibold hover:bg-gold-400/20 transition-colors disabled:opacity-50"
      >
        <BellRing className="w-3.5 h-3.5" />
        {busy ? "Enabling..." : "Enable push notifications"}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
