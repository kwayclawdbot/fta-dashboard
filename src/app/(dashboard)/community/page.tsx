import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getRequestClient,
  getRequestProfile,
  getRequestUser,
} from "@/lib/supabase/rsc";
import { deriveRegister, isSoloProfile } from "@/lib/register";
import { parseExperience } from "@/lib/experience/registry";
import { resolveViewAs } from "@/lib/server/view-as";
import { getCommunityFeedSeed } from "@/lib/feed-seed";
import { listCircles, isOpen, type CircleListRow } from "@/lib/circles";
import CommunityChat from "./CommunityChat";
import ClubCommunityScreen from "./ClubCommunityScreen";

/**
 * /community — MODE-BRANCHED (owner's Aug-7 club mockup board).
 *
 * FAMILY / KID / TEEN — unchanged: the restored chat area (CommunityChat, owner
 * directive 2026-07-31) renders byte-identical to before. Kids and teens can
 * never reach the club branch: the register gate below is checked against the
 * REAL profile before any door is even read.
 *
 * CLUB (individual door) — the mockup's COMMUNITY terminal screen: the neon
 * Circle rings row, the For You / Following / Trending feed, and post cards
 * with real charts. Seeded server-side with the SAME reads the shared feed
 * uses (getCommunityFeedSeed — kid-authored rows excluded there and by RLS)
 * plus the open Circles (club_circles). This is a VISUAL branch: the data,
 * the writes and every wall are the shared feed's own.
 *
 * DOOR RESOLUTION mirrors the dashboard layout's memberDoor order exactly,
 * copied locally (the layout does not export it): admin view-as first, then
 * the stored families.door, then the completed-solo inference for a family
 * with no door stamped yet. Any failure falls back to the family chat —
 * never a wrong render.
 */
export const dynamic = "force-dynamic";

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DB = SupabaseClient<any, "public", any>;

async function resolveClubMode(supabase: DB): Promise<boolean> {
  try {
    const [user, prof] = await Promise.all([getRequestUser(), getRequestProfile()]);
    if (!user || !prof) return false;

    // Kids/teens keep the family surface regardless of any cookie or door.
    if (deriveRegister(prof) !== "adult") return false;

    // 1. Admin "view as" preview — its personas ARE doors.
    const viewAs = await resolveViewAs(prof.role);
    if (viewAs) return viewAs === "club";

    if (!prof.family_id) return false;

    // 2. The stored door (families.door, migration 215).
    const { data } = await supabase
      .from("families")
      .select("door")
      .eq("id", prof.family_id)
      .maybeSingle();
    const door = parseExperience((data as { door?: string } | null)?.door);
    if (door) return door === "club";

    // 3. No door stamped yet → the shell's solo fallback (completed profile).
    if (prof.role !== "parent" && prof.role !== "admin") return false;
    const { data: fp } = await supabase
      .from("family_profiles")
      .select("household, completed_at")
      .eq("family_id", prof.family_id)
      .maybeSingle();
    return isSoloProfile(fp ?? null);
  } catch {
    return false;
  }
}

export default async function CommunityPage() {
  const supabase = await getRequestClient();
  const club = await resolveClubMode(supabase);

  if (!club) {
    // The family chat area, exactly as restored (owner directive 2026-07-31).
    return <CommunityChat />;
  }

  const [seed, circlesRes] = await Promise.all([
    getCommunityFeedSeed(supabase).catch(() => null),
    listCircles(supabase).catch(
      () => ({ rows: [] as CircleListRow[], missingSchema: true })
    ),
  ]);

  // Soonest clock first (listCircles orders by expires_at) — closed rooms off.
  const circles = circlesRes.rows.filter((c) => isOpen(c)).slice(0, 10);

  return <ClubCommunityScreen seed={seed} circles={circles} />;
}
