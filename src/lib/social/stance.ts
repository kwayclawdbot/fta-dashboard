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

/* ══════════════════════════════════════════════════════════════════════════
   STANCE_META — the shared chip vocabulary for bull / bear / neutral.

   COLOUR LAW REPAIR (canvas v2, lane L2). This map used to hand out
   `bg-chip-green text-green-700` for bull and `bg-red-500/12 text-red-600` for
   bear: the PRICE ramp, on a COMMUNITY control. A green "Bull" chip sitting a
   row above an actual +2.4% made a member's opinion and the market's move the
   same colour — the precise collision the law exists to prevent, and it was
   re-rendered on four shipped surfaces at once (ChangedMyMind,
   ResearchObjectCard, ResearchObjectCompose, ThesisObjectClient).

   The ramp is now the community one: lime, via the canonical `text-sentiment` /
   `bg-sentiment-soft` tokens (never a `dark:` variant — the tokens flip
   themselves).

   Because lime is ONE colour, hue cannot carry direction here, and it must not
   try to. So the vocabulary splits the two jobs the old map conflated:

     · POSITION-TAKEN vs NOT is carried by COLOUR. Bull and bear are both lime:
       the member came off the fence. Neutral is sand: they did not.
     · DIRECTION is carried by the LABEL and by `mark` (▲ ▼ —), a shape that
       survives greyscale, colour-blindness and a 10px chip. Strip every colour
       from this file and bull still reads as bull.

   `dot` stays for callers that want a bare status pip; it follows the same rule
   (lime = engaged, soft = neutral) and is never the only direction cue.
   ══════════════════════════════════════════════════════════════════════════ */
export const STANCE_META: Record<
  Stance,
  { label: string; chip: string; dot: string; mark: string }
> = {
  bull: {
    label: "Bull",
    chip: "bg-sentiment-soft text-sentiment",
    dot: "bg-sentiment-fill",
    mark: "▲",
  },
  bear: {
    label: "Bear",
    chip: "bg-sentiment-soft text-sentiment",
    dot: "bg-sentiment-fill",
    mark: "▼",
  },
  neutral: {
    label: "Neutral",
    chip: "bg-sand text-soft",
    dot: "bg-soft",
    mark: "—",
  },
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

/* ══════════════════════════════════════════════════════════════════════════
   CHANGED MY MIND — the club-wide destination (canvas v2, Club Screens 03).

   get_ticker_stance_summary answers "who flipped on NVDA". The destination asks
   the club-wide question, so it reads get_changed_minds (migration 190), which
   folds the RESPECT tally and the caller's own respect into every row — the
   surface renders a respect control on each entry and an N+1 across a feed is
   what the batch aggregates exist to prevent.
   ══════════════════════════════════════════════════════════════════════════ */

/** A flip rendered on the club-wide destination: the moment plus its respect. */
export interface ChangedMindEntry extends StanceFlip {
  ticker: string;
  respect_count: number;
  my_respect: boolean;
}

export interface ChangedMindsFeed {
  /** Every flip ever recorded, club-wide. */
  total_flips: number;
  /** DISTINCT members who have flipped at least once. */
  members: number;
  /** DISTINCT tickers a flip has happened on. */
  tickers: number;
  items: ChangedMindEntry[];
}

export const EMPTY_CHANGED_MINDS: ChangedMindsFeed = {
  total_flips: 0,
  members: 0,
  tickers: 0,
  items: [],
};

export async function fetchChangedMinds(
  supabase: SupabaseClient,
  limit = 30
): Promise<ChangedMindsFeed> {
  const { data } = await supabase.rpc("get_changed_minds", { p_limit: limit });
  return { ...EMPTY_CHANGED_MINDS, ...((data ?? {}) as Partial<ChangedMindsFeed>) };
}

/**
 * RESPECT on a stance flip. Rides the existing object_reactions machinery
 * (migration 150) — the same table, the same forge-proof RLS (`user_id =
 * auth.uid()` on insert, own-row delete) — with 'respect' and the 'stance_event'
 * target added by migration 190. Returns true when the write landed, so the
 * caller can roll an optimistic toggle back rather than lie about persistence.
 */
export async function toggleRespect(
  supabase: SupabaseClient,
  stanceEventId: string,
  userId: string,
  active: boolean
): Promise<boolean> {
  if (active) {
    const { error } = await supabase
      .from("object_reactions")
      .delete()
      .eq("target_type", "stance_event")
      .eq("target_id", stanceEventId)
      .eq("user_id", userId)
      .eq("reaction", "respect");
    return !error;
  }
  const { error } = await supabase.from("object_reactions").insert({
    target_type: "stance_event",
    target_id: stanceEventId,
    user_id: userId,
    reaction: "respect",
  });
  return !error;
}
