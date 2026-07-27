"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VIEW_AS_PERSONAS, type ViewAs } from "@/lib/view-as";

/**
 * The "you are not who this app thinks you are" indicator.
 *
 * While a View-as override is active the entire shell — nav, register, brand,
 * palette, tier gating — is telling the admin a story about a member who is not
 * them. Forgetting that is the obvious failure mode, and the cost of forgetting
 * is misreading a bug report or "fixing" a surface that was never broken. So
 * this is deliberately not subtle: a constant orange frame around the viewport
 * (constant in BOTH themes — volt and night are theme-invariant ramps) plus a
 * standing bar naming the active register with a one-click exit.
 *
 * It also repeats the honest caveat in short form. The shell is previewed; the
 * DATA is not — row-level security still reads the admin's real account.
 *
 * Rendered only from the dashboard layout, only when the server actually
 * honoured an override, so it can never appear for a member.
 */
export default function ViewAsIndicator({ view }: { view: ViewAs }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const persona = VIEW_AS_PERSONAS[view];

  async function exit() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      await fetch("/api/admin/view-as", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ view: "off" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Viewport frame — the ambient, unmissable half. Never intercepts input. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[70] border-2 border-volt-500"
      />

      {/* Standing bar. Sits above the phone tab bar (4rem + safe area) and drops
          to the bottom edge from md up, where no tab bar exists. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[71] flex justify-center px-3 md:bottom-3">
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-volt-500 bg-night-950 py-1.5 pl-2 pr-1.5 shadow-lg">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-volt-500 px-2 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-[0.14em] text-night-950">
            <Eye className="h-3 w-3 shrink-0" aria-hidden />
            Viewing as {persona.label}
          </span>

          <span className="hidden truncate text-[11px] text-night-200 sm:inline">
            Shell preview — your real data and permissions are unchanged
          </span>

          <button
            type="button"
            onClick={() => void exit()}
            disabled={busy}
            className="f0-press f0-focus inline-flex shrink-0 items-center gap-1 rounded-full border border-white/25 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Exit
          </button>
        </div>
      </div>
    </>
  );
}
