"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Yes, view in Club Mode" — sets the SESSION-scoped club-view cookie and
 * returns to the dashboard.
 *
 * The cookie is not the authority: (dashboard)/layout.tsx re-checks it against
 * the real register (adults only), the real stored door, and the request host on
 * every render, so a hand-written cookie on a kid's browser does nothing.
 */
export default function ClubViewAccept() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function accept() {
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/experience/club-view", { method: "POST" });
    if (!res.ok) {
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <button
      onClick={accept}
      disabled={busy}
      className="f0-press f0-focus inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-3 font-display text-sm font-bold text-[color:var(--accent-on)] disabled:opacity-50"
    >
      {busy ? "One moment…" : "Yes — view in Club Mode"}
    </button>
  );
}
