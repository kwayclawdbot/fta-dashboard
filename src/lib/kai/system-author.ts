import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * KAI — the Club's system author identity.
 *
 * WHY A REAL PROFILE ROW AND NOT A FLAG. Three constraints decided this:
 *   1. `club_circle_notes.author_id` is NOT NULL and references `profiles(id)`
 *      (migration 191). A Circle note cannot be author-less, so any Kai note
 *      needs a real profile row — there is no schema-free way around it.
 *   2. `profiles.id` references `auth.users(id)` (migration 001), so the profile
 *      in turn needs an auth user. `handle_new_user()` (001:394) creates the
 *      profile row automatically on user insert, so we create the user and then
 *      correct the profile in place.
 *   3. `feed_posts.kind` carries a CHECK constraint over
 *      ('post','activity','anchor','announcement'), and `profiles` has no
 *      `is_system` column. Adding either would be a migration. Authoring as a
 *      named identity needs neither.
 *
 * So: ZERO MIGRATIONS. The distinguishing field is the identity itself —
 * `profiles.username = 'kai'` — which every read path already selects
 * (`feed-seed.ts` embeds `username`, `circles.ts` selects it on the roster), so
 * the surfaces can tell a Kai row from a member row with no schema change.
 *
 * The account is a normal member account with no elevated rights. It is written
 * to only by the service-role cron; nobody can sign into it (no password is
 * ever set, and the address is on the internal domain the preview-demo fixtures
 * already use).
 */

/** Internal domain, same convention as scripts/seed-preview-demo.mjs. */
export const KAI_EMAIL = "kai@cheatcode.internal";
/** The handle every surface keys off. Lower-cased unique index (migration 095). */
export const KAI_USERNAME = "kai";
export const KAI_DISPLAY_NAME = "Kai";

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type DB = SupabaseClient<any, "public", any>;

/** Warm-instance memo. The id never changes once the row exists. */
let cachedId: string | null = null;

/**
 * Returns Kai's `profiles.id`, creating the identity on first use.
 *
 * Idempotent and safe to call on every cron tick: the common path is ONE
 * indexed read (`profiles.username = 'kai'`). Creation only happens once, and a
 * lost race falls back to re-reading the row rather than failing.
 *
 * Requires a SERVICE-ROLE client — `auth.admin` is unavailable otherwise.
 */
export async function ensureKaiIdentity(db: DB): Promise<string> {
  if (cachedId) return cachedId;

  const found = await readKaiProfileId(db);
  if (found) {
    cachedId = found;
    return found;
  }

  // No profile yet. Create the auth user; the on_auth_user_created trigger
  // writes the profile row, which we then correct (username/display_name/role).
  const created = await db.auth.admin.createUser({
    email: KAI_EMAIL,
    email_confirm: true,
    user_metadata: { display_name: KAI_DISPLAY_NAME, role: "coach" },
  });

  let uid = created.data?.user?.id ?? null;
  if (!uid) {
    // Already registered (a previous partial run, or a concurrent tick). Find
    // the user by address rather than treating this as a failure.
    uid = await findAuthUserId(db, KAI_EMAIL);
  }
  if (!uid) {
    throw new Error(
      `Could not resolve the Kai identity: ${created.error?.message ?? "createUser returned no user"}`
    );
  }

  // `handle_new_user` gives the row a display_name derived from the address and
  // no username (the ensure_username trigger from 095 fills one in). Both are
  // corrected here so the handle is exactly `kai`.
  const { error } = await db.from("profiles").upsert(
    {
      id: uid,
      display_name: KAI_DISPLAY_NAME,
      username: KAI_USERNAME,
      role: "coach",
      age_group: "adults",
      track: "adults",
      email: KAI_EMAIL,
      onboarding_complete: true,
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`Kai profile upsert failed: ${error.message}`);

  cachedId = uid;
  return uid;
}

/** The cheap path — one indexed read on the lower(username) unique index. */
async function readKaiProfileId(db: DB): Promise<string | null> {
  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("username", KAI_USERNAME)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Paginated lookup by address. Only reached when createUser reports a clash. */
async function findAuthUserId(db: DB, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}
