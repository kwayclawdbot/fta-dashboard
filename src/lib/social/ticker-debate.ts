/**
 * Per-ticker debate (SOCIAL OBJECTS S1 object #3) — client helpers for the
 * three-way BULL/BEAR/UNDECIDED stance debate with top voted arguments per side
 * and one-reason capture after voting. Backed by migration 153. Kid-walled in the
 * RPCs. No XP.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChangeReasonKey } from "./stance";

export type DebateStance = "bull" | "bear" | "undecided";
export type ArgumentSide = "bull" | "bear";

export interface DebateArgAuthor {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  age_group: string | null;
}

export interface TopArgument {
  id: string;
  body: string;
  user_id: string;
  votes: number;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  age_group: string | null;
}

export interface DebateArgument {
  id: string;
  side: ArgumentSide;
  body: string;
  created_at: string;
  user_id: string;
  votes: number;
  voted: boolean;
  author: DebateArgAuthor;
}

export interface TickerDebateState {
  id: string;
  ticker: string;
  question: string;
  status: string;
  bull: number;
  bear: number;
  undecided: number;
  total: number;
  userVote: DebateStance | null;
  userReason: ChangeReasonKey | null;
  topBull: TopArgument | null;
  topBear: TopArgument | null;
}

export async function fetchTickerDebate(
  supabase: SupabaseClient,
  ticker: string
): Promise<TickerDebateState | null> {
  const { data } = await supabase.rpc("club_ticker_debate_state", { p_ticker: ticker });
  return (data ?? null) as TickerDebateState | null;
}

export async function voteTickerDebate(
  supabase: SupabaseClient,
  debateId: string,
  choice: DebateStance,
  reason?: ChangeReasonKey | null
): Promise<{ ok: boolean; reason?: string; state?: TickerDebateState }> {
  const { data, error } = await supabase.rpc("club_ticker_debate_vote", {
    p_debate_id: debateId,
    p_choice: choice,
    p_reason: reason ?? null,
  });
  if (error) return { ok: false, reason: "error" };
  return (data ?? { ok: false }) as { ok: boolean; reason?: string; state?: TickerDebateState };
}

export async function fetchDebateArguments(
  supabase: SupabaseClient,
  debateId: string
): Promise<DebateArgument[]> {
  const { data } = await supabase.rpc("get_debate_arguments", { p_debate_id: debateId });
  return (data ?? []) as DebateArgument[];
}

export async function addDebateArgument(
  supabase: SupabaseClient,
  debateId: string,
  side: ArgumentSide,
  body: string
): Promise<{ ok: boolean; reason?: string; id?: string }> {
  const { data, error } = await supabase.rpc("add_debate_argument", {
    p_debate_id: debateId,
    p_side: side,
    p_body: body,
  });
  if (error) return { ok: false, reason: "error" };
  return (data ?? { ok: false }) as { ok: boolean; reason?: string; id?: string };
}

export async function voteDebateArgument(
  supabase: SupabaseClient,
  argumentId: string
): Promise<{ ok: boolean; voted?: boolean; votes?: number }> {
  const { data, error } = await supabase.rpc("vote_debate_argument", { p_argument_id: argumentId });
  if (error) return { ok: false };
  return (data ?? { ok: false }) as { ok: boolean; voted?: boolean; votes?: number };
}
