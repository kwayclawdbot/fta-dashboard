/**
 * Research Object v1 (SOCIAL OBJECTS S1 + MONETIZATION-GATES structured thesis) —
 * shared types + client helpers. Backed by migration 152. The object is a
 * PERSISTENT structured thesis, not a feed post. Publishing goes through the ONE
 * gated entry point (POST /api/social/research); reads use the definer RPCs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Stance } from "./stance";

export type TimeHorizon = "near" | "1yr" | "3-5yr";
export type ThesisUpdateKind = "strengthened" | "weakened" | "changed";
export type ThesisSection = "thesis" | "catalysts" | "risks" | "valuation";
export type ThesisCommentSection = "general" | ThesisSection;

export const TIME_HORIZON_META: Record<TimeHorizon, { label: string; full: string }> = {
  near: { label: "Near-term", full: "Near-term (weeks–months)" },
  "1yr": { label: "1 year", full: "About a year out" },
  "3-5yr": { label: "3–5 years", full: "Long-term (3–5 years)" },
};

export const SECTION_META: { key: ThesisSection; label: string }[] = [
  { key: "thesis", label: "Thesis" },
  { key: "catalysts", label: "Catalysts" },
  { key: "risks", label: "Risks" },
  { key: "valuation", label: "Valuation" },
];

export const UPDATE_META: Record<ThesisUpdateKind, { label: string; chip: string; dot: string }> = {
  strengthened: { label: "Strengthened", chip: "bg-chip-green text-green-700", dot: "bg-green-500" },
  weakened: { label: "Weakened", chip: "bg-red-500/12 text-red-600", dot: "bg-red-500" },
  changed: { label: "Changed", chip: "bg-chip-amber text-gold-800", dot: "bg-gold-500" },
};

export interface ThesisAuthor {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  age_group: string | null;
}

export interface ResearchObject {
  id: string;
  author_id: string;
  ticker: string;
  company_name: string | null;
  stance: Stance;
  headline: string;
  time_horizon: TimeHorizon | null;
  price_at_publish: number | null;
  thesis: string;
  catalysts: string;
  risks: string;
  valuation: string;
  status: string;
  created_at: string;
  updated_at: string;
  author?: ThesisAuthor | null;
}

export interface ThesisUpdate {
  id: string;
  object_id: string;
  author_id: string;
  kind: ThesisUpdateKind;
  body: string;
  price_at_update: number | null;
  created_at: string;
}

/** Card shape returned by get_ticker_research_objects (list on a ticker page). */
export interface ResearchObjectCard {
  id: string;
  ticker: string;
  company_name: string | null;
  stance: Stance;
  headline: string;
  time_horizon: TimeHorizon | null;
  price_at_publish: number | null;
  created_at: string;
  updated_at: string;
  author: ThesisAuthor;
  update_count: number;
}

export interface ComposeThesisInput {
  ticker: string;
  stance: Stance;
  headline: string;
  timeHorizon?: TimeHorizon | null;
  thesis?: string;
  catalysts?: string;
  risks?: string;
  valuation?: string;
}

/**
 * Publish a structured thesis through the SINGLE gated entry point. The
 * monetization-gates lane wraps this route with can(user,'research_publish').
 */
export async function publishThesis(
  input: ComposeThesisInput
): Promise<{ ok: boolean; id?: string; reason?: string }> {
  const res = await fetch("/api/social/research", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, reason: json?.reason || json?.error || "failed" };
  return { ok: true, id: json.id };
}

export async function fetchTickerTheses(
  supabase: SupabaseClient,
  ticker: string,
  limit = 10
): Promise<ResearchObjectCard[]> {
  const { data } = await supabase.rpc("get_ticker_research_objects", {
    p_ticker: ticker,
    p_limit: limit,
  });
  return (data ?? []) as ResearchObjectCard[];
}

export async function fetchResearchObject(
  supabase: SupabaseClient,
  id: string
): Promise<{ object: ResearchObject | null; updates: ThesisUpdate[] }> {
  const { data } = await supabase.rpc("get_research_object", { p_id: id });
  const raw = (data ?? null) as { object: ResearchObject | null; updates: ThesisUpdate[] } | null;
  return { object: raw?.object ?? null, updates: raw?.updates ?? [] };
}

export async function addThesisUpdate(
  supabase: SupabaseClient,
  objectId: string,
  kind: ThesisUpdateKind,
  body: string
): Promise<{ ok: boolean; reason?: string; price_at_update?: number | null }> {
  const { data, error } = await supabase.rpc("add_thesis_update", {
    p_object_id: objectId,
    p_kind: kind,
    p_body: body,
  });
  if (error) return { ok: false, reason: "error" };
  return (data ?? { ok: false }) as { ok: boolean; reason?: string; price_at_update?: number | null };
}

/** % move since publish — computed live (never stored/stale). null when unknowable. */
export function pctSincePublish(
  priceAtPublish: number | null | undefined,
  currentPrice: number | null | undefined
): number | null {
  if (!priceAtPublish || priceAtPublish <= 0 || currentPrice == null) return null;
  return ((currentPrice - priceAtPublish) / priceAtPublish) * 100;
}

export function formatPctMove(pct: number | null): string {
  if (pct == null) return "";
  const s = pct >= 0 ? "+" : "";
  return `${s}${pct.toFixed(1)}% since publish`;
}
