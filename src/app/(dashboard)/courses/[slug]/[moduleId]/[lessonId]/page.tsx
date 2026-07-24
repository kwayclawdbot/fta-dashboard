export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getFamilyTierState } from "@/lib/tier";
import UpsellCard from "@/components/dashboard/UpsellCard";
import LessonViewerClient from "./LessonViewerClient";

/**
 * Server guard for the lesson viewer. /courses is a free-allowed prefix (the
 * sampler), so this deep route re-enforces the sampler rule server-side: a free
 * family may open a lesson ONLY if it is one of the three free (is_free) lessons.
 * Any other lesson — reached by a deep link — renders the upsell instead, and the
 * lesson iframe is never shipped to the client. Members are unaffected.
 *
 * FTA Club clock (migration 127): a `clubLapsed` FTA family keeps its FTA-program
 * lessons for life (academy access is forever) but every fic/foundations lesson
 * gates exactly like the free sampler (is_free only) — the "keep FTA, drop Club"
 * split, enforced on the actual content route.
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
    const { tier, clubLapsed } = await getFamilyTierState(
      supabase,
      profile?.family_id
    );

    // Free families, and lapsed-Club FTA families, both hit the sampler gate.
    if (tier === "free" || clubLapsed) {
      const { data: lesson } = await supabase
        .from("lessons")
        .select("is_free, module_id")
        .eq("id", lessonId)
        .maybeSingle();

      // Resolve the lesson's program (module → course) so a lapsed FTA member
      // keeps FTA-program lessons while fic/foundations gate like free.
      let program: string | null = null;
      if (clubLapsed && lesson?.module_id) {
        const { data: mod } = await supabase
          .from("modules")
          .select("course_id")
          .eq("id", lesson.module_id)
          .maybeSingle();
        if (mod?.course_id) {
          const { data: course } = await supabase
            .from("courses")
            .select("program")
            .eq("id", mod.course_id)
            .maybeSingle();
          program = course?.program ?? null;
        }
      }

      // FTA academy lessons stay open for a lapsed FTA member (lifetime access).
      // Everyone else (free family, or a lapsed member on a fic/foundations
      // lesson) may only open a real, free-flagged sampler lesson. Unknown ids
      // (e.g. legacy mock courses) are treated as locked.
      const ftaPreserved = clubLapsed && tier !== "free" && program === "fta";
      if (!ftaPreserved && !lesson?.is_free) {
        return <UpsellCard context="lesson" variant="full" />;
      }
    }
  }

  return <LessonViewerClient />;
}
