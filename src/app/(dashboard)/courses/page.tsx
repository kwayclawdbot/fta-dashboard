export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getFamilyTierState } from "@/lib/tier";
import CourseCatalog from "@/components/learn/CourseCatalog";
import LearnWorld from "@/components/learn/LearnWorld";

/**
 * /courses — the Learn front door.
 *
 * "Kill 'courses' in the UI; keep it internally" (FIC-LEARNING-WORLD §3). The nav
 * "Learn" tab still points here, so members land in the Learning World (the
 * journey), NOT a course grid. FREE families keep the existing sampler catalog —
 * /courses is the free-allowed prefix and the sampler funnel must not change. The
 * full member catalog moves under "Explore curriculum" (/learn/catalog). No dead
 * URLs, no shell changes, no free-funnel risk.
 */
export default async function CoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tier = "member";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", user.id)
      .single();
    const state = await getFamilyTierState(supabase, profile?.family_id);
    tier = state.tier;
  }

  // Free families keep the sampler catalog; members get the journey world.
  if (tier === "free") return <CourseCatalog />;
  return <LearnWorld />;
}
