export const dynamic = "force-dynamic";

import { getRequestClient } from "@/lib/supabase/rsc";
import { getViewerRegister } from "@/lib/server/viewer-register";
import { canSeeCourse } from "@/lib/courseVisibility";
import CourseDoor from "@/components/entitlements/CourseDoor";

/**
 * THE COURSE REGISTER GUARD — server-side, and it covers BOTH content routes
 * under this segment in one place:
 *
 *   /courses/[slug]                              (the syllabus)
 *   /courses/[slug]/[moduleId]/[lessonId]        (the lesson viewer + AI coach)
 *
 * THE DEFECT IT CLOSES: /courses filtered the catalogue by register, but neither
 * page below it checked anything. A kid who typed — or was linked —
 * /courses/fic-adult-foundations or /courses/fta-trade-ready got the entire
 * adult syllabus and every lesson in it. The catalogue was a curtain, not a door.
 *
 * A LAYOUT, NOT TWO PAGE CHECKS, because the guard is a property of the COURSE,
 * and both routes below already know the course from the same `[slug]` — putting
 * it here means the lesson viewer cannot be reached around the syllabus, and a
 * future route added under this segment inherits the door instead of forgetting
 * it. The lesson page keeps its own (tier/sampler/club-clock) gate untouched;
 * this one is purely about REGISTER.
 *
 * COST: an adult — the overwhelming majority of course traffic — never issues a
 * query here at all. The register comes from the request-scoped profile the
 * dashboard shell has already read, and the course lookup only runs for a kid
 * or a teen.
 *
 * The visibility rule itself is NOT written here: it is the single shared
 * canSeeCourse() the catalogue and /progress also call, so the three surfaces
 * cannot drift apart again.
 */
export default async function CourseRegisterGuard({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { register, role, signedIn } = await getViewerRegister();

  // Adults see the whole family library; a logged-out request is the auth
  // layer's business, not this one's.
  if (!signedIn || register === "adult") return <>{children}</>;

  const { slug } = await params;
  const supabase = await getRequestClient();
  const { data: course } = await supabase
    .from("courses")
    .select("program, modules(track)")
    .eq("slug", slug)
    .maybeSingle();

  // No such course (or it is not readable): the page's own empty state — "Course
  // Coming Soon" — is the honest answer, and it leaks nothing.
  if (!course) return <>{children}</>;

  const allowed = canSeeCourse(
    { register, role },
    {
      program: (course as { program: string | null }).program,
      tracks: ((course as { modules: { track: string | null }[] | null }).modules ?? []).map(
        (m) => m.track
      ),
    }
  );

  if (!allowed) return <CourseDoor register={register} />;

  return <>{children}</>;
}
