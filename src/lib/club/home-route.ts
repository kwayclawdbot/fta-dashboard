import type { SupabaseClient } from "@supabase/supabase-js";
import { getFamilyTier } from "@/lib/tier";
import { deriveRegister, isSoloProfile, type Register } from "@/lib/register";
import type { LearningPickup } from "@/components/clubhome/ClubHomeV2";

/**
 * Home route resolution — SERVER SIDE (CONVERGENCE S2).
 *
 * The persona round-1 resolution (auth → profile → home_state → tier → register
 * → solo verdict) used to run entirely on the client before the first content
 * paint, which cost ~1.4s FCP on the Club home. This resolves the paint-critical
 * slice on the server so the Club home shell + header stream immediately; the
 * live section data still hydrates client-side via the batched GET /api/club/home.
 *
 * Only the CLUB-SOLO surface (the one S2 owns) takes the server fast-path. The
 * family / kid / free personas fall through to the existing client component
 * UNCHANGED — this file deliberately returns `kind:"client"` for them so their
 * behavior is byte-identical to before.
 */

interface HomeStateRow {
  program: "fic" | "fta" | null;
  today: {
    lesson_id: string;
    title: string;
    module_id: string;
    module_title: string;
    course_slug: string;
    course_title: string;
  } | null;
}

interface ProfileRow {
  display_name: string | null;
  family_id: string | null;
  role: string | null;
  age_group: string | null;
  track: string | null;
}

export type HomeRoute =
  | { kind: "client" }
  | { kind: "free"; firstName: string }
  | {
      kind: "club";
      firstName: string;
      register: Register;
      learning: LearningPickup | null;
      challengeExpiresAt: string | null;
    };

/**
 * Resolve where a Home request should go. Returns `kind:"client"` whenever the
 * fast-path can't be taken safely (any query fails, no session, not a solo
 * member) so the untouched client path handles it — never a wrong render.
 */
export async function resolveHomeRoute(
  supabase: SupabaseClient
): Promise<HomeRoute> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { kind: "client" };

    const [{ data: state }, { data: profile }] = await Promise.all([
      supabase.rpc("get_home_state", { p_user_id: user.id }),
      supabase
        .from("profiles")
        .select("display_name, family_id, role, age_group, track")
        .eq("id", user.id)
        .single(),
    ]);

    const prof = profile as ProfileRow | null;
    if (!prof) return { kind: "client" };

    const firstName = prof.display_name?.split(" ")[0] || "";
    const familyId = prof.family_id;
    const tier = await getFamilyTier(supabase, familyId);

    // FREE → the dedicated free home. Resolved server-side so it paints without
    // a client round trip (identical destination to the client short-circuit).
    if (tier === "free") return { kind: "free", firstName };

    // CLUB-SOLO fast-path — mirrors the client's isSolo gate exactly: a parent/
    // admin with a family_id and a COMPLETED solo household profile. Anything
    // else (families, kids, teens) falls through to the untouched client.
    const isParentRole = prof.role === "parent" || prof.role === "admin";
    if (!isParentRole || !familyId) return { kind: "client" };

    const { data: fpRow } = await supabase
      .from("family_profiles")
      .select("household, completed_at")
      .eq("family_id", familyId)
      .maybeSingle();
    if (!isSoloProfile(fpRow)) return { kind: "client" };

    // Solo Club member → server-render ClubHomeV2 with resolved props.
    const hs = state as HomeStateRow | null;
    const learning: LearningPickup | null =
      hs?.program && hs.today
        ? {
            title: hs.today.title,
            href: `/courses/${hs.today.course_slug}/${hs.today.module_id}/${hs.today.lesson_id}`,
            context: `${hs.today.module_title} · ${hs.today.course_title}`,
          }
        : null;

    // Active 5-Day Challenge pass window (best-effort; null = common case).
    let challengeExpiresAt: string | null = null;
    try {
      const { data: pass } = await supabase
        .from("enrollments")
        .select("expires_at")
        .eq("family_id", familyId)
        .eq("program", "challenge_pass")
        .eq("status", "active")
        .not("expires_at", "is", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      challengeExpiresAt = (pass?.expires_at as string | null) ?? null;
    } catch {
      /* no active pass */
    }

    return {
      kind: "club",
      firstName,
      register: deriveRegister(prof),
      learning,
      challengeExpiresAt,
    };
  } catch {
    // Any failure → the untouched client resolves it (no regression).
    return { kind: "client" };
  }
}
