/**
 * Informational reactions (SOCIAL OBJECTS S1) — the typed, meaningful responses
 * that replace a generic like on research-shaped surfaces. Client-safe: no
 * Supabase import at module scope; callers pass a browser client in (mirrors
 * src/lib/research/social.ts).
 *
 * Backed by migration 150 (object_reactions + get_object_reactions[_batch]).
 * No XP anywhere. Reactions are visible-safe for every register (kids included).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ReactionKey =
  | "strong_point"
  | "agree"
  | "needs_evidence"
  | "missing_risk"
  | "changed_mind"
  | "saved";

export type ReactionTargetType = "research_object" | "ticker_comment" | "feed_post";

export interface ReactionDef {
  key: ReactionKey;
  glyph: string; // the spec's mark (🧠 ✓ ? ⚠ ↻ 🔖)
  label: string;
  /** token-based chip classes for the active state (both themes). */
  chip: string;
}

/** SOCIAL-OBJECTS §CROSS-CUTTING — the six informational reactions, in order. */
export const REACTIONS: ReactionDef[] = [
  { key: "strong_point", glyph: "🧠", label: "Strong point", chip: "bg-chip-amber text-gold-800" },
  { key: "agree", glyph: "✓", label: "I agree", chip: "bg-chip-green text-green-700" },
  { key: "needs_evidence", glyph: "?", label: "Needs evidence", chip: "bg-chip-sky text-sky-800" },
  { key: "missing_risk", glyph: "⚠", label: "Missing risk", chip: "bg-red-500/12 text-red-600" },
  { key: "changed_mind", glyph: "↻", label: "Changed my mind", chip: "bg-teal-500/14 text-teal-700" },
  { key: "saved", glyph: "🔖", label: "Saved", chip: "bg-purple-500/12 text-purple-600" },
];

export const REACTION_BY_KEY: Record<ReactionKey, ReactionDef> = Object.fromEntries(
  REACTIONS.map((r) => [r.key, r])
) as Record<ReactionKey, ReactionDef>;

export type ReactionCounts = Partial<Record<ReactionKey, number>>;

export interface ReactionState {
  counts: ReactionCounts;
  mine: ReactionKey[];
}

/**
 * Scale floors for displayed social counts (SOCIAL-OBJECTS guardrails). S1 works
 * at any N pre-challenge, so highlights surface at a low, honest floor (5) rather
 * than the ClubHome production floor of 50 — the spec's explicit default here.
 */
export const SOCIAL_FLOORS = {
  reactionHighlight: 5, // "N people changed their mind after reading this"
  mindChanges: 5, // stance-flip highlight on a ticker
  debateStance: 5, // ticker-debate tally becomes a "split", not raw small counts
} as const;

const EMPTY: ReactionState = { counts: {}, mine: [] };

export async function fetchReactions(
  supabase: SupabaseClient,
  targetType: ReactionTargetType,
  targetId: string
): Promise<ReactionState> {
  const { data } = await supabase.rpc("get_object_reactions", {
    p_target_type: targetType,
    p_target_id: targetId,
  });
  const raw = (data ?? null) as { counts?: ReactionCounts; mine?: ReactionKey[] } | null;
  if (!raw) return EMPTY;
  return { counts: raw.counts ?? {}, mine: raw.mine ?? [] };
}

/** Add or remove one reaction of a given type for the caller (forge-proof RLS). */
export async function toggleReaction(
  supabase: SupabaseClient,
  targetType: ReactionTargetType,
  targetId: string,
  userId: string,
  reaction: ReactionKey,
  active: boolean
): Promise<boolean> {
  if (active) {
    const { error } = await supabase
      .from("object_reactions")
      .delete()
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .eq("user_id", userId)
      .eq("reaction", reaction);
    return !error;
  }
  const { error } = await supabase
    .from("object_reactions")
    .insert({ target_type: targetType, target_id: targetId, user_id: userId, reaction });
  return !error;
}

/** Batched fetch for feeds/lists → Map<targetId, ReactionState> (no N+1). */
export async function fetchReactionsBatch(
  supabase: SupabaseClient,
  targetType: ReactionTargetType,
  ids: string[]
): Promise<Map<string, ReactionState>> {
  const out = new Map<string, ReactionState>();
  if (ids.length === 0) return out;
  const { data } = await supabase.rpc("get_object_reactions_batch", {
    p_target_type: targetType,
    p_target_ids: ids,
  });
  for (const row of (data ?? []) as { target_id: string; counts: ReactionCounts; mine: ReactionKey[] }[]) {
    out.set(row.target_id, { counts: row.counts ?? {}, mine: row.mine ?? [] });
  }
  return out;
}

export function totalReactions(counts: ReactionCounts): number {
  return REACTIONS.reduce((n, r) => n + (counts[r.key] ?? 0), 0);
}

/** The headline signal — only above the scale floor (no "3 people" moments). */
export function mindChangeLine(counts: ReactionCounts): string | null {
  const n = counts.changed_mind ?? 0;
  if (n < SOCIAL_FLOORS.reactionHighlight) return null;
  return `${n.toLocaleString()} people changed their mind after reading this`;
}
