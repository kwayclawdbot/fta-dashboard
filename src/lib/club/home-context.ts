import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureClubMetricsFresh } from "@/lib/club/cache";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import { deriveRegister, type Register } from "@/lib/register";
import { siteUrl } from "@/lib/site-url";

/**
 * ClubHome shared request context — the ONE place auth / profile / tier /
 * register / the canonical snapshot ledger / the freshness read-through are
 * resolved for a home-page load.
 *
 * Each /api/club/* route delegates its body to an exported `*Core(ctx)` and the
 * batched GET /api/club/home builds this context ONCE and passes it to all nine
 * cores. Every expensive resolution is memoised (a cached promise), so:
 *   • the individual endpoints pay only for what their core touches (a pulse
 *     fetch never reads the profile; a thinking fetch never resolves tier), and
 *   • the batched endpoint resolves auth once, reads the profile once, resolves
 *     tier/register once, reads the snapshot ledger once (pulse + trending share
 *     it), and triggers the metrics read-through once — one shared round-trip
 *     footprint instead of a nine-way fan-out that re-does all of it per call.
 *
 * The cores are pure functions of this context, so the individual routes and the
 * batched route run identical code paths — behaviour cannot drift between them.
 */

export interface ClubProfileRow {
  family_id: string | null;
  role: string | null;
  age_group: string | null;
  track: string | null;
}

/** The union of columns pulse + trending read off the canonical snapshot ledger. */
export interface ClubSnapshotRow {
  ticker: string;
  rank: number | null;
  club_score: number | null;
  club_change_14d: number | null;
  participants: number | null;
  provenance: unknown;
  computed_at: string | null;
}

/** Result envelope every core returns so a wrapper can set the HTTP status and
 *  the batched assembler can treat a walled non-200 (e.g. brief/free 403) as a
 *  deliberate absence rather than an error. */
export interface CoreResult {
  /** HTTP status the individual endpoint should send (default 200). */
  status?: number;
  /** JSON body. */
  body: unknown;
}

export interface ClubCtx {
  supabase: SupabaseClient;
  user: User;
  /** Absolute origin for building share links (invite). */
  origin: string;
  /** Memoised service-role client (created on first use). */
  admin(): SupabaseClient;
  /** Memoised single profile read (family_id, role, age_group, track). */
  getProfile(): Promise<ClubProfileRow | null>;
  /** Memoised effective Club tier (folds the Club-clock lapse). */
  getTier(): Promise<FamilyTier>;
  /** Memoised viewer register (kid / teen / adult). */
  getRegister(): Promise<Register>;
  /** Memoised full snapshot ledger read (ordered by rank) — pulse + trending. */
  getSnapshots(): Promise<ClubSnapshotRow[]>;
  /** Memoised metrics read-through (non-blocking; after()-deferred refresh). */
  ensureFresh(): Promise<void>;
}

/** memoise an async factory into a cached promise (runs at most once). */
function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => (p ??= fn());
}

/**
 * Resolve the shared context for a Club home request. Returns null when there is
 * no authenticated user (the caller replies 401) — matching every individual
 * endpoint's existing `if (!user) 401` gate.
 */
export async function resolveClubCtx(
  supabase: SupabaseClient,
  req?: NextRequest
): Promise<ClubCtx | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let adminClient: SupabaseClient | null = null;
  const admin = () => (adminClient ??= createAdminClient());

  const getProfile = once<ClubProfileRow | null>(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("family_id, role, age_group, track")
      .eq("id", user.id)
      .maybeSingle();
    return (data as ClubProfileRow | null) ?? null;
  });

  const getTier = once<FamilyTier>(async () => {
    const prof = await getProfile();
    return getClubTier(supabase, prof?.family_id);
  });

  const getRegister = once<Register>(async () => {
    const prof = await getProfile();
    return deriveRegister(prof);
  });

  const getSnapshots = once<ClubSnapshotRow[]>(async () => {
    const { data } = await supabase
      .from("ticker_intel_snapshots")
      .select("ticker, rank, club_score, club_change_14d, participants, provenance, computed_at")
      .order("rank", { ascending: true });
    return (data as ClubSnapshotRow[] | null) ?? [];
  });

  const ensureFresh = once<void>(async () => {
    await ensureClubMetricsFresh();
  });

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (req ? new URL(req.url).origin : "") ||
    siteUrl();

  return {
    supabase,
    user,
    origin,
    admin,
    getProfile,
    getTier,
    getRegister,
    getSnapshots,
    ensureFresh,
  };
}
