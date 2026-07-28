"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, X, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SegmentedRail } from "@/components/canvas2";
import type { SegmentedOption } from "@/components/canvas2";
import {
  VIEW_AS_ORDER,
  VIEW_AS_PERSONAS,
  type ViewAs,
} from "@/lib/view-as";

/**
 * VIEW AS — the admin settings bar control.
 *
 * Sits across the top of every admin page (AdminShell), so switching register
 * is one click from wherever the admin already is rather than a buried setting.
 * Picking a register writes the `cc_view_as` cookie via /api/admin/view-as and
 * the dashboard shell re-resolves from it server-side; NO database row is
 * touched, so the owner's real tier / role / age_group are untouched.
 *
 * The honest line under the rail is load-bearing, not decoration: this previews
 * the SHELL, not Row Level Security. An admin who forgets that will look at a
 * kid surface, see it render, and conclude it is fine — when a real kid's RLS
 * would return different rows and refuse writes this session is allowed.
 *
 * CHROME NOTE: the admin console now sits on the same warm-paper ground as the
 * rest of the app, so SegmentedRail is used with the page's OWN tokens — the
 * old private zinc/amber override is gone. The only local variable left is the
 * selected-bar offset, because `railClassName` is dropped (this bar already
 * carries its own hairline) and the 3px bar would otherwise hang off a rule
 * that is not there.
 */

const RAIL_TOKENS = {
  "--f0-seg-bar-offset": "0px",
} as React.CSSProperties;

const OPTIONS: SegmentedOption<ViewAs>[] = VIEW_AS_ORDER.map((id) => ({
  id,
  label: VIEW_AS_PERSONAS[id].label,
}));

export default function ViewAsBar({ current }: { current: ViewAs | null }) {
  const router = useRouter();
  const [view, setView] = useState<ViewAs | null>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: ViewAs | null) {
    if (busy || next === view) return;
    setBusy(true);
    setError(null);
    const prev = view;
    setView(next); // optimistic — the rail must feel like a control, not a form
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/view-as", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ view: next ?? "off" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setView(prev);
      setError("Could not switch — try again.");
    } finally {
      setBusy(false);
    }
  }

  const persona = view ? VIEW_AS_PERSONAS[view] : null;

  return (
    <div className="border-b border-sand bg-card px-4 lg:px-8">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2 pt-3">
        <span className="flex items-center gap-2 pb-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
          <Eye className="h-[14px] w-[14px] shrink-0" aria-hidden />
          View as
        </span>

        <div style={RAIL_TOKENS} className={busy ? "opacity-60" : undefined}>
          <SegmentedRail<ViewAs>
            options={OPTIONS}
            value={view}
            onChange={(id) => void choose(id)}
            ariaLabel="Preview the app as a member register"
            barClassName="bg-accent"
            activeTextClassName="text-ink"
            disabled={busy}
            railClassName=""
          />
        </div>

        {/* Off / my real account — always present, never hunted for. Quiet when
            nothing is active, lit when there is something to undo. */}
        <button
          type="button"
          onClick={() => void choose(null)}
          disabled={busy || !view}
          className={`f0-press f0-focus mb-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            view
              ? "border-transparent bg-ink text-paper"
              : "border-sand text-soft"
          }`}
        >
          <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {view ? "Back to my real account" : "My real account"}
        </button>

        {view && (
          <Link
            href="/dashboard"
            className="f0-press f0-focus mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent hover:text-accent-strong"
          >
            Open the app
            <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </Link>
        )}
      </div>

      {/* The honesty line. Layout and gating only — never data permissions. */}
      <p className="max-w-3xl pb-3 text-[11px] leading-relaxed text-soft">
        {persona ? (
          <>
            <span className="font-semibold text-ink">{persona.blurb}.</span>{" "}
          </>
        ) : null}
        Previews the shell only — nav, register, brand and tier gating. It does{" "}
        <span className="font-semibold text-ink">not</span> preview data
        permissions: row-level security still reads your real account, so you see
        your own rows and the kid chat wall and downtime window never engage. A
        surface can look correct here and behave differently for a real member.
      </p>

      {/* accent, not red — red belongs to the price ramp by colour law. */}
      {error && (
        <p role="status" className="pb-3 text-[11px] font-semibold text-accent">

          {error}
        </p>
      )}
    </div>
  );
}
