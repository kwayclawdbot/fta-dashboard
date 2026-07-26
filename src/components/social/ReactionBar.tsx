"use client";

/**
 * ReactionBar (SOCIAL OBJECTS S1) — informational reactions on research-shaped
 * objects (theses, ticker notes, thesis-tagged posts). Replaces the generic like
 * with six typed responses: 🧠 Strong point · ✓ I agree · ? Needs evidence ·
 * ⚠ Missing risk · ↻ Changed my mind · 🔖 Saved.
 *
 * Counts are shown per type; "N people changed their mind after reading this"
 * surfaces above the scale floor (5). Reactions are visible-safe for every
 * register (kids included). Optionally fetches its own snapshot, or accepts one
 * batched by a parent (feeds). No XP.
 */

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REACTIONS,
  fetchReactions,
  toggleReaction,
  mindChangeLine,
  type ReactionState,
  type ReactionKey,
  type ReactionTargetType,
} from "@/lib/social/reactions";

export default function ReactionBar({
  supabase,
  targetType,
  targetId,
  userId,
  canReact = true,
  initial,
  compact = false,
}: {
  supabase: SupabaseClient;
  targetType: ReactionTargetType;
  targetId: string;
  userId?: string | null;
  canReact?: boolean;
  /** Snapshot supplied by a batched parent (feed). When absent, self-fetches. */
  initial?: ReactionState;
  compact?: boolean;
}) {
  const [state, setState] = useState<ReactionState>(initial ?? { counts: {}, mine: [] });
  const [busy, setBusy] = useState<ReactionKey | null>(null);

  useEffect(() => {
    if (initial) {
      setState(initial);
      return;
    }
    let live = true;
    fetchReactions(supabase, targetType, targetId).then((s) => {
      if (live) setState(s);
    });
    return () => {
      live = false;
    };
  }, [supabase, targetType, targetId, initial]);

  const react = useCallback(
    async (key: ReactionKey) => {
      if (!userId || !canReact || busy) return;
      const active = state.mine.includes(key);
      setBusy(key);
      // Optimistic
      const nextMine = active ? state.mine.filter((k) => k !== key) : [...state.mine, key];
      const nextCounts = {
        ...state.counts,
        [key]: Math.max(0, (state.counts[key] ?? 0) + (active ? -1 : 1)),
      };
      setState({ counts: nextCounts, mine: nextMine });
      const ok = await toggleReaction(supabase, targetType, targetId, userId, key, active);
      if (!ok) setState(state); // rollback
      setBusy(null);
    },
    [supabase, targetType, targetId, userId, canReact, busy, state]
  );

  const highlight = mindChangeLine(state.counts);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {REACTIONS.map((r) => {
          const n = state.counts[r.key] ?? 0;
          const active = state.mine.includes(r.key);
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => react(r.key)}
              disabled={!userId || !canReact || busy === r.key}
              aria-pressed={active}
              title={r.label}
              className={`inline-flex items-center gap-1 rounded-full border ${
                compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
              } font-semibold transition-colors disabled:cursor-default ${
                active
                  ? `border-transparent ${r.chip}`
                  : "border-sand text-soft hover:bg-paper disabled:hover:bg-transparent"
              }`}
            >
              <span aria-hidden className="text-[13px] leading-none">
                {r.glyph}
              </span>
              {!compact && <span>{r.label}</span>}
              {n > 0 && <span className="tabular-nums">{n}</span>}
            </button>
          );
        })}
      </div>
      {highlight && (
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-700">
          <span aria-hidden>↻</span> {highlight}
        </p>
      )}
    </div>
  );
}
