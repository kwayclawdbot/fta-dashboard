export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getFamilyTier } from "@/lib/tier";
import UpsellCard from "@/components/dashboard/UpsellCard";
import TrendOrTrapGame from "@/components/games/TrendOrTrapGame";

/**
 * Trend or Trap is a member game. /games is a free-allowed prefix (the hub +
 * Candle Battle), so this deeper route enforces the tier check server-side — a
 * free deep link never receives the game, only the upsell.
 */
export default async function TrendOrTrapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tier: string = "fic";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", user.id)
      .single();
    tier = await getFamilyTier(supabase, profile?.family_id);
  }

  if (tier === "free") {
    return <UpsellCard context="trend-or-trap" variant="full" />;
  }
  return <TrendOrTrapGame />;
}
