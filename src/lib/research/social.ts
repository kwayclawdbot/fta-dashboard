/**
 * Social-first layer shared types + helpers (Lane 9). Client-safe — no Supabase
 * import here; the SocialBar component and surfaces pass a browser client in.
 *
 * One vote per member per ticker (👍 Like / 👎 Not for me), read/written through
 * ticker_sentiment (forge-proof RLS) with counts served by get_ticker_social.
 * NO XP anywhere for likes (anti-spam, owner rule). Contributions ride the
 * existing community-XP cap — this layer never awards.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Vote = 1 | -1;

export interface TickerSocial {
  ticker: string;
  likes: number;
  unlikes: number;
  net: number;
  myVote: Vote | null;
  commentCount: number;
  contributors: number;
  memberTotal: number;
}

const ZERO = (ticker: string): TickerSocial => ({
  ticker,
  likes: 0,
  unlikes: 0,
  net: 0,
  myVote: null,
  commentCount: 0,
  contributors: 0,
  memberTotal: 0,
});

interface RawSocial {
  ticker: string;
  likes: number;
  unlikes: number;
  net: number;
  my_vote: number | null;
  comment_count: number;
  contributors: number;
  member_total: number;
}

function shape(raw: RawSocial | null, ticker: string): TickerSocial {
  if (!raw) return ZERO(ticker);
  return {
    ticker: raw.ticker ?? ticker,
    likes: raw.likes ?? 0,
    unlikes: raw.unlikes ?? 0,
    net: raw.net ?? 0,
    myVote: raw.my_vote === 1 ? 1 : raw.my_vote === -1 ? -1 : null,
    commentCount: raw.comment_count ?? 0,
    contributors: raw.contributors ?? 0,
    memberTotal: raw.member_total ?? 0,
  };
}

/** One round-trip social snapshot for a ticker (counts + your vote). */
export async function fetchSocial(
  supabase: SupabaseClient,
  ticker: string
): Promise<TickerSocial> {
  const { data } = await supabase.rpc("get_ticker_social", { p_ticker: ticker });
  return shape((data ?? null) as RawSocial | null, ticker);
}

/** Cast or change your vote (forge-proof: RLS forces user_id = auth.uid()). */
export async function setVote(
  supabase: SupabaseClient,
  ticker: string,
  userId: string,
  vote: Vote
): Promise<boolean> {
  const { error } = await supabase
    .from("ticker_sentiment")
    .upsert(
      { user_id: userId, ticker, vote, updated_at: new Date().toISOString() },
      { onConflict: "user_id,ticker" }
    );
  return !error;
}

/** Remove your vote entirely. */
export async function clearVote(
  supabase: SupabaseClient,
  ticker: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("ticker_sentiment")
    .delete()
    .eq("user_id", userId)
    .eq("ticker", ticker);
  return !error;
}

/**
 * Vote labels by age register. Kids/teens NEVER see bull/bear jargon; adults and
 * teens get a quiet bullish/bearish subtitle. The primary labels stay family-warm
 * for everyone ("Like" / "Not for me").
 */
export function voteLabels(ageGroup: string | null | undefined): {
  like: string;
  unlike: string;
  likeSub: string | null;
  unlikeSub: string | null;
} {
  const grownEnough = ageGroup === "adults" || ageGroup === "teens";
  return {
    like: "Like",
    unlike: "Not for me",
    likeSub: grownEnough ? "bullish" : null,
    unlikeSub: grownEnough ? "bearish" : null,
  };
}

/** "N of M members like this" — only meaningful once there are votes + members. */
export function consensusLine(s: TickerSocial): string | null {
  if (s.likes <= 0 || s.memberTotal <= 0) return null;
  return `${s.likes} of ${s.memberTotal} member${s.memberTotal === 1 ? "" : "s"} like this`;
}

/* ── typed research contributions (chip on the canonical wiki thread) ──────── */

export type ContributionType = "note" | "thesis" | "risk" | "news" | "chart" | "question";

export const CONTRIBUTION_TYPES: {
  key: ContributionType;
  label: string;
  /** lucide icon name resolved in the component. */
  icon: string;
  chip: string; // token-based chip classes (both themes)
}[] = [
  { key: "note", label: "Note", icon: "StickyNote", chip: "bg-sand text-soft" },
  { key: "thesis", label: "Thesis", icon: "Lightbulb", chip: "bg-chip-amber text-gold-800" },
  { key: "risk", label: "Risk", icon: "TriangleAlert", chip: "bg-red-500/12 text-red-600" },
  { key: "news", label: "News", icon: "Newspaper", chip: "bg-chip-sky text-sky-800" },
  { key: "chart", label: "Chart note", icon: "LineChart", chip: "bg-chip-green text-green-700" },
  { key: "question", label: "Question", icon: "HelpCircle", chip: "bg-purple-500/12 text-purple-600" },
];

export function contributionMeta(type: string | null | undefined) {
  return CONTRIBUTION_TYPES.find((t) => t.key === type) ?? CONTRIBUTION_TYPES[0];
}

/* ── community favorites strip (watchlist board) ───────────────────────────── */

export interface Favorite {
  ticker: string;
  company_name: string;
  score: number;
  net: number;
}

export async function fetchFavorites(
  supabase: SupabaseClient,
  window: "all" | "7d",
  limit = 5
): Promise<Favorite[]> {
  const { data } = await supabase.rpc("community_favorites", {
    p_window: window,
    p_limit: limit,
  });
  return (data ?? []) as Favorite[];
}
