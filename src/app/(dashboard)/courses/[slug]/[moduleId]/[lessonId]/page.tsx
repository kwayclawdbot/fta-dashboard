export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getFamilyTier } from "@/lib/tier";
import UpsellCard from "@/components/dashboard/UpsellCard";
import LessonViewerClient from "./LessonViewerClient";

/**
 * Server guard for the lesson viewer. /courses is a free-allowed prefix (the
 * sampler), so this deep route re-enforces the sampler rule server-side: a free
 * family may open a lesson ONLY if it is one of the three free (is_free) lessons.
 * Any other lesson — reached by a deep link — renders the upsell instead, and the
 * lesson iframe is never shipped to the client. Members are unaffected.
 */
export default async function LessonViewerPage({
  params,
}: {
  params: Promise<{ slug: string; moduleId: string; lessonId: string }>;
}) {
  const { lessonId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", user.id)
      .single();
    const tier = await getFamilyTier(supabase, profile?.family_id);

    if (tier === "free") {
      // A free family may only open a real, free-flagged lesson. Unknown ids
      // (e.g. legacy mock courses) are treated as locked.
      const { data: lesson } = await supabase
        .from("lessons")
        .select("is_free")
        .eq("id", lessonId)
        .maybeSingle();
      if (!lesson?.is_free) {
        return <UpsellCard context="lesson" variant="full" />;
      }
    }
  }

  return <LessonViewerClient />;
}
