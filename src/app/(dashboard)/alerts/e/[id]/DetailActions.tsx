"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Eye, BellOff, SlidersHorizontal, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Alert-detail actions — CANVAS BOARD 19's pinned bottom bar.
 *
 * The board draws a two-cell bar across the bottom of the screen: a wide filled
 * primary ("Alert armed ✓") and a narrow outlined secondary ("Share"). This is
 * the same bar with the actions this screen actually has. It is pinned, on a
 * paper field with a hairline above it, so the primary action stays reachable
 * on a long alert rather than living at the end of a scroll.
 *
 * "Mute" honestly pauses the underlying watch (no per-day field exists in the
 * schema, so it is an explicit pause the member can resume any time — never a
 * silent promise). Broadcast/setup events with no owning rule hide Mute + Edit,
 * which is why the secondary cell is built from whatever is genuinely available
 * rather than always drawing two buttons.
 *
 * COLOUR: the filled cell is the brand accent (orange / gold / metallic per
 * mode) — brand + action, by law. No price colour anywhere on a control.
 */
export default function DetailActions({ ruleId, ticker }: { ruleId: string | null; ticker: string }) {
  const [muting, setMuting] = useState(false);
  const [muted, setMuted] = useState(false);

  const mute = useCallback(async () => {
    if (!ruleId || muting || muted) return;
    setMuting(true);
    const supabase = createClient();
    const { error } = await supabase.from("alert_rules").update({ active: false }).eq("id", ruleId);
    setMuting(false);
    if (!error) setMuted(true);
  }, [ruleId, muting, muted]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-sand bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[68ch] items-center gap-2.5 px-4 py-3 sm:px-6">
        <Link
          href="/alerts"
          className="f0-focus f0-press inline-flex flex-[1.4] items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-[13px] font-extrabold text-night-950 transition hover:brightness-105"
        >
          <Eye className="h-4 w-4" /> Keep watching
        </Link>

        {ruleId ? (
          <button
            onClick={mute}
            disabled={muting || muted}
            className="f0-focus f0-press inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-sand bg-card px-4 py-3 text-[13px] font-bold text-ink transition hover:border-accent/45 disabled:opacity-70"
          >
            {muting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : muted ? (
              <Check className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
            {muted ? "Paused" : "Mute"}
          </button>
        ) : (
          <Link
            href={`/research/${encodeURIComponent(ticker)}`}
            className="f0-focus f0-press inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-sand bg-card px-4 py-3 text-[13px] font-bold text-ink transition hover:border-accent/45"
          >
            Research
          </Link>
        )}

        {ruleId && (
          <Link
            href="/alerts#watch"
            aria-label="Edit this watch"
            title="Edit this watch"
            className="f0-focus f0-press grid h-11 w-11 shrink-0 place-items-center rounded-full border border-sand bg-card text-soft transition hover:border-accent/45 hover:text-ink"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Link>
        )}
      </div>

      {muted && (
        <p className="mx-auto w-full max-w-[68ch] px-4 pb-3 text-[11px] leading-relaxed text-soft/75 sm:px-6">
          Paused. Resume this watch any time in{" "}
          <span className="font-semibold text-ink">My watches</span>.
        </p>
      )}
    </div>
  );
}
