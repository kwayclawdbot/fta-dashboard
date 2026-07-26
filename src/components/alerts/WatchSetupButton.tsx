"use client";

import { useState, useCallback } from "react";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";

/**
 * WatchSetupButton — opt in / out of a Kai Daily setup's lifecycle thread
 * (Lane B UI over the Lane A /api/alerts/setups/[id]/subscribe route). Only
 * opted-in members receive that setup's waiting → confirmed → triggered story.
 */
export default function WatchSetupButton({
  setupId,
  initialSubscribed,
  onChange,
  size = "md",
}: {
  setupId: string;
  initialSubscribed: boolean;
  onChange?: (subscribed: boolean) => void;
  size?: "sm" | "md";
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [busy, setBusy] = useState(false);
  const [justChanged, setJustChanged] = useState(false);

  const toggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      const next = !subscribed;
      setBusy(true);
      // Optimistic — reverts on error.
      setSubscribed(next);
      try {
        const res = await fetch(`/api/alerts/setups/${setupId}/subscribe`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subscribe: next }),
        });
        if (!res.ok) throw new Error("failed");
        onChange?.(next);
        if (next) {
          setJustChanged(true);
          setTimeout(() => setJustChanged(false), 1400);
        }
      } catch {
        setSubscribed(!next); // revert
      } finally {
        setBusy(false);
      }
    },
    [busy, subscribed, setupId, onChange]
  );

  const pad = size === "sm" ? "px-2.5 py-1.5 text-[12px]" : "px-3 py-2 text-[13px]";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={subscribed}
      className={`inline-flex items-center gap-1.5 rounded-xl font-semibold transition active:scale-[0.98] ${pad} ${
        subscribed
          ? "border border-teal-500/40 bg-teal-500/10 text-teal-700"
          : "kai-gradient text-white shadow-soft hover:brightness-105"
      }`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : justChanged ? (
        <Check className="h-3.5 w-3.5" />
      ) : subscribed ? (
        <EyeOff className="h-3.5 w-3.5" />
      ) : (
        <Eye className="h-3.5 w-3.5" />
      )}
      {subscribed ? "Following" : "Watch this setup"}
    </button>
  );
}
