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
      <div className="flex flex-wrap gap-2">
        <Link
          href="/alerts"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl kai-gradient px-4 py-2.5 text-[14px] font-bold text-white shadow-soft transition hover:brightness-105 active:scale-[0.99]"
        >
          <Eye className="h-4 w-4" /> Keep watching
        </Link>
        {ruleId && (
          <button
            onClick={mute}
            disabled={muting || muted}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sand bg-paper px-4 py-2.5 text-[13px] font-semibold text-soft transition hover:border-red-300 hover:text-red-600 disabled:opacity-70"
          >
            {muting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : muted ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
            {muted ? "Muted" : "Mute today"}
          </button>
        )}
        {ruleId && (
          <Link
            href="/alerts#watch"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sand bg-paper px-4 py-2.5 text-[13px] font-semibold text-soft transition hover:border-kai-blue hover:text-ink"
          >
            <SlidersHorizontal className="h-4 w-4" /> Edit
          </Link>
        )}
        <Link
          href={`/research/${encodeURIComponent(ticker)}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sand bg-paper px-4 py-2.5 text-[13px] font-semibold text-soft transition hover:border-gold-300 hover:text-ink"
        >
          Research {ticker}
        </Link>
      </div>
      {muted && (
        <p className="mt-2 text-[11px] text-soft/70">
          Paused. Resume this watch any time in <span className="font-semibold text-ink">My Kai Watch</span>.
        </p>
      )}
    </div>
  );
}
