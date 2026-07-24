import type { SupabaseClient } from "@supabase/supabase-js";
import type { FamilyTier } from "@/lib/tier";
import type { BadgeRow } from "@/lib/badges";

/**
 * Public member profile — the safe, kid-minimized shape returned by the
 * `public_profile(username)` SECURITY DEFINER RPC (migration 095). The server
 * decides what a viewer may see; the client never receives a minor's family
 * name, role, email, or exact join date.
 */

export interface PublicProfileBadge {
  slug: string;
  title: string;
  subtitle: string | null;
  sort: number;
  awarded_at: string | null;
}

export interface ProfileLikedTicker {
  ticker: string;
  company_name: string | null;
  liked_at: string | null;
}
export interface ProfileCommunityPick {
  ticker: string;
  company_name: string | null;
  headline: string | null;
  snapshot_price: number | null;
  current_price: number | null;
  pct_since: number | null;
  created_at: string | null;
}

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  age_group: "kids" | "teens" | "adults";
  tier: FamilyTier;
  xp: number;
  badges: PublicProfileBadge[];
  member_since: string;
  is_minor: boolean;
  // Community footprint (public for everyone incl. kids — already-public actions).
  liked_tickers: ProfileLikedTicker[];
  community_picks: ProfileCommunityPick[];
  contributions: number;
  // Adults only — absent for minors (server-enforced).
  family_name?: string | null;
  role_kind?: "parent" | "member";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, "public", any>;

/** Fetch a public profile by username. Returns null when the handle is unknown. */
export async function getPublicProfile(
  supabase: DB,
  username: string
): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("public_profile", {
    p_username: username,
  });
  if (error || !data) return null;
  return data as PublicProfile;
}

/**
 * Merge the earned credentials from the RPC with the full set of professional
 * titles so the case can render locked placeholders too. `defs` comes from the
 * public-readable `badges` table.
 */
export function mergeBadgeRows(
  defs: Array<{ slug: string; title: string; subtitle: string | null; sort: number }>,
  earned: PublicProfileBadge[]
): BadgeRow[] {
  const earnedAt = new Map<string, string | null>();
  for (const b of earned) earnedAt.set(b.slug, b.awarded_at);
  return defs
    .map((d) => ({
      slug: d.slug,
      title: d.title,
      subtitle: d.subtitle,
      sort: d.sort,
      awarded: earnedAt.has(d.slug),
      awarded_at: earnedAt.get(d.slug) ?? null,
    }))
    .sort((a, b) => a.sort - b.sort);
}
