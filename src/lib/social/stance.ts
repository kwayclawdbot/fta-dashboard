/**
 * "Changed My Mind" (SOCIAL OBJECTS S1 signature feature) — client helpers +
 * reason taxonomy for ticker stance flips. Backed by migration 151
 * (ticker_stances + stance_events + set_ticker_stance / get_ticker_stance_summary).
 *
 * The FLOW is kid-walled (enforced in the RPC). Reading is open — flips render as
 * public "changed their mind" moments. No XP.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Stance = "bull" | "bear" | "neutral";

export type ChangeReasonKey =
  | "valuation"
  | "thesis_broken"
  | "new_evidence"
  | "risk_increased"
  | "better_opportunity";

export interface ChangeReasonDef {
  key: ChangeReasonKey;
  label: string;
}

/** SOCIAL-OBJECTS §CROSS-CUTTING — the closed reason taxonomy for a stance flip. */
export const CHANGE_REASONS: ChangeReasonDef[] = [
  { key: "valuation", label: "Valuation changed" },
  { key: "thesis_broken", label: "Thesis broke" },
  { key: "new_evidence", label: "New evidence" },
  { key: "risk_increased", label: "Risk increased" },
  { key: "better_opportunity", label: "Better opportunity" },
];

export const REASON_BY_KEY: Record<ChangeReasonKey, ChangeReasonDef> = Object.fromEntries(
  CHANGE_REASONS.map((r) => [r.key, r])
) as Record<ChangeReasonKey, ChangeReasonDef>;

export const STANCE_META: Record<Stance, { label: string; chip: string; dot: string }> = {
  bull: { label: "Bull", chip: "bg-chip-green text-green-700", dot: "bg-green-500" },
  bear: { label: "Bear", chip: "bg-red-500/12 text-red-600", dot: "bg-red-500" },
  neutral: { label: "Neutral", chip: "bg-sand text-soft", dot: "bg-soft" },
};

export interface StanceAuthor {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  age_group: string | null;
}

export interface StanceFlip extends StanceAuthor {
  id: string;
  from_stance: Stance | null;
  to_stance: Stance;
  reason: ChangeReasonKey | null;
  note: string | null;
  created_at: string;
}

export interface StanceSummary {
  my_stance: Stance | null;
  mind_changes: number;
  bull: number;
  bear: number;
  neutral: number;
  recent: StanceFlip[];
}

const EMPTY: StanceSummary = {
  my_stance: null,
  mind_changes: 0,
  bull: 0,
  bear: 0,
  neutral: 0,
  recent: [],
};

export async function fetchStanceSummary(
  supabase: SupabaseClient,
  ticker: string
): Promise<StanceSummary> {
  const { data } = await supabase.rpc("get_ticker_stance_summary", { p_ticker: ticker });
  return { ...EMPTY, ...((data ?? {}) as Partial<StanceSummary>) };
}

/**
 * Set or flip a stance. Returns { ok, stance, flipped } or an error reason
 * ('kid_walled' | 'reason_required' | ...). A genuine flip requires a reason.
 */
export async function setStance(
  supabase: SupabaseClient,
  ticker: string,
  stance: Stance,
  reason?: ChangeReasonKey | null,
  note?: string | null
): Promise<{ ok: boolean; reason?: string; flipped?: boolean; stance?: Stance }> {
  const { data, error } = await supabase.rpc("set_ticker_stance", {
    p_ticker: ticker,
    p_stance: stance,
    p_reason: reason ?? null,
    p_note: note ?? null,
  });
  if (error) return { ok: false, reason: "error" };
  return (data ?? { ok: false }) as { ok: boolean; reason?: string; flipped?: boolean; stance?: Stance };
}

/** Human phrasing for a flip moment, e.g. "flipped Bull → Bear · Thesis broke". */
export function flipLine(f: StanceFlip): string {
  const from = f.from_stance ? STANCE_META[f.from_stance].label : "—";
  const to = STANCE_META[f.to_stance].label;
  const why = f.reason ? ` · ${REASON_BY_KEY[f.reason].label}` : "";
  return `${from} → ${to}${why}`;
}
