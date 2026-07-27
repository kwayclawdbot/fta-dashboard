"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Eye, BellOff, SlidersHorizontal, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Alert-detail actions (Lane B): Keep watching · Mute today · Edit Kai Watch.
 * "Mute today" honestly pauses the underlying watch (no per-day field exists in
 * the schema, so it is an explicit pause the member can resume any time — never
 * a silent promise). Broadcast/setup events with no owning rule hide Mute+Edit.
 *
 * CANVAS REBUILD: one filled control, and it is KAI BLUE — this is a Kai surface
 * and blue is Kai's colour (the old fill was the teal→green `.kai-gradient`,
 * which put GREEN, the price colour, on a button). The secondary actions drop
 * their button chrome and read as text affordances.
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
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          href="/alerts"
          className="inline-flex items-center gap-2 rounded-full bg-kai-500 px-5 py-2.5 text-[14px] font-bold text-white transition hover:brightness-110 active:scale-[0.99]"
        >
          <Eye className="h-4 w-4" /> Keep watching
        </Link>

        {ruleId && (
          <button
            onClick={mute}
            disabled={muting || muted}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-soft transition hover:text-ink disabled:opacity-70"
          >
            {muting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : muted ? (
              <Check className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
            {muted ? "Muted" : "Mute today"}
          </button>
        )}

        {ruleId && (
          <Link
            href="/alerts#watch"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-soft transition hover:text-ink"
          >
            <SlidersHorizontal className="h-4 w-4" /> Edit this watch
          </Link>
        )}

        <Link
          href={`/research/${encodeURIComponent(ticker)}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gold-700 transition hover:text-gold-600"
        >
          Research ${ticker} →
        </Link>
      </div>

      {muted && (
        <p className="mt-3 text-[11.5px] leading-relaxed text-soft/75">
          Paused. Resume this watch any time in{" "}
          <span className="font-semibold text-ink">My Kai Watch</span>.
        </p>
      )}
    </div>
  );
}
