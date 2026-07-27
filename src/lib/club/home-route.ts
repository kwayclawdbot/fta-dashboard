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
      /**
       * Lifetime XP, for Home's closing belt strip (canvas board 01 "YOU").
       * `null` means the read did not land — NOT zero. A real zero is a real
       * White Belt at 0 XP and renders as such; null renders the honest
       * "your rank starts with your first rep" state instead.
       */
      xp: number | null;
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

    // XP joins this batch rather than adding a round trip: it depends only on
    // user.id, which is already known, so it rides alongside the two reads that
    // were already here. `xp_for_users` (migration 118) is the SECURITY DEFINER
    // grouped SUM — a client-side sum over `xp_events` is capped by PostgREST's
    // max-rows and would silently under-report a long-standing member's belt.
    const [{ data: state }, { data: profile }, xpRes] = await Promise.all([
      supabase.rpc("get_home_state", { p_user_id: user.id }),
      supabase
        .from("profiles")
        .select("display_name, family_id, role, age_group, track")
        .eq("id", user.id)
        .single(),
      // Promise.resolve(): the PostgREST builder is a thenable, not a Promise,
      // so it has no .catch of its own to hang the degradation off.
      Promise.resolve(supabase.rpc("xp_for_users", { p_user_ids: [user.id] })).catch(
        () => null
      ),
    ]);

    const prof = profile as ProfileRow | null;
    if (!prof) return { kind: "client" };

    const firstName = prof.display_name?.split(" ")[0] || "";
    const familyId = prof.family_id;

    // The solo gate needs NO query — role and family_id are already in `prof`.
    // Resolving it here lets us skip the two solo-only reads for families/kids
    // instead of fetching and discarding them.
    const isParentRole = prof.role === "parent" || prof.role === "admin";
    const needSolo = isParentRole && !!familyId;

    // PERF: these three used to be three SEQUENTIAL awaits (tier → family_profiles
    // → enrollments) on the critical path, so /dashboard cost FIVE serial Supabase
    // round trips before a single byte of HTML streamed. They all depend only on
    // familyId, which is known above — so they collapse into ONE round trip.
    // Ordering of the GATES below is unchanged; only the fetching is parallel.
    const [tier, fpRes, passRes] = await Promise.all([
      getFamilyTier(supabase, familyId),
      needSolo
        ? supabase
            .from("family_profiles")
            .select("household, completed_at")
            .eq("family_id", familyId)
            .maybeSingle()
        : Promise.resolve(null),
      needSolo
        ? supabase
            .from("enrollments")
            .select("expires_at")
            .eq("family_id", familyId)
            .eq("program", "challenge_pass")
            .eq("status", "active")
            .not("expires_at", "is", null)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle()
        : Promise.resolve(null),
    ]);

    // FREE → the dedicated free home. Resolved server-side so it paints without
    // a client round trip (identical destination to the client short-circuit).
    if (tier === "free") return { kind: "free", firstName };

    // CLUB-SOLO fast-path — mirrors the client's isSolo gate exactly: a parent/
    // admin with a family_id and a COMPLETED solo household profile. Anything
    // else (families, kids, teens) falls through to the untouched client.
    if (!needSolo) return { kind: "client" };
    if (!isSoloProfile(fpRes?.data ?? null)) return { kind: "client" };

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

    // Active 5-Day Challenge pass window — already fetched in the parallel batch
    // above (best-effort; null is the common case and a failed read is non-fatal).
    const challengeExpiresAt =
      (passRes?.data?.expires_at as string | null | undefined) ?? null;

    // A missing row is 0 XP (White Belt) — that is a real rank, not an absence.
    // Only a FAILED read is null, and only that renders the honest empty state.
    const xpRow = (
      (xpRes?.data ?? null) as { user_id: string; xp: number }[] | null
    )?.find((r) => r.user_id === user.id);
    const xp = xpRes?.error ? null : Number(xpRow?.xp ?? 0) || 0;

    return {
      kind: "club",
      firstName,
      register: deriveRegister(prof),
      learning,
      challengeExpiresAt,
      xp,
    };
  } catch {
    // Any failure → the untouched client resolves it (no regression).
    return { kind: "client" };
  }
}
