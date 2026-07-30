"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./SetupScreen.module.css";

/**
 * The artboard's "Alert armed ✓" footer button, wired to the ONE mutation that
 * really exists for a setup: `POST /api/alerts/setups/:id/subscribe`, which
 * writes the member's `setup_subscriptions` row.
 *
 * Armed and un-armed are both real states, so the label says which one you are
 * in rather than always claiming the flattering one. On the fixtures path
 * (`interactive={false}`) there is no session to write for, so it renders the
 * state and takes no clicks.
 */
export default function ArmAlertButton({
  setupId,
  armed,
  interactive,
}: {
  setupId: string;
  armed: boolean;
  interactive: boolean;
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState(armed);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const label = optimistic ? "Alert armed ✓" : "Arm alert";
  const className = `${styles.arm} ${optimistic ? "" : styles.armIdle} ${
    busy || pending ? styles.armBusy : ""
  }`;

  if (!interactive) {
    return (
      <div className={className} role="status">
        {label}
      </div>
    );
  }

  async function toggle() {
    if (busy) return;
    const next = !optimistic;
    setBusy(true);
    setOptimistic(next);
    try {
      const res = await fetch(`/api/alerts/setups/${setupId}/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscribe: next }),
      });
      if (!res.ok) {
        // The write failed, so the button must go back to the truth.
        setOptimistic(!next);
      } else {
        startTransition(() => router.refresh());
      }
    } catch {
      setOptimistic(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={toggle} aria-pressed={optimistic}>
      {label}
    </button>
  );
}
