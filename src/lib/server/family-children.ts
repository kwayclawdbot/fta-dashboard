/**
 * SERVER SIDE of "a parent adds a child" — the gate, and the transcript.
 *
 * Both routes (/api/family/children and /api/family/children/link) do the same
 * two things before and after their real work: prove the caller is a parent of
 * a real household, and leave a queryable record of what they did. Neither is
 * worth duplicating, and the gate in particular must never drift between the
 * two — the create route and the link route grant the SAME thing (membership of
 * your household), so they must ask the same question.
 *
 * SERVICE ROLE LIVES HERE AND IN THE ROUTES ONLY. Nothing in this file is
 * importable from a client component — it pulls next/headers via
 * @/lib/supabase/server and the service key via @/lib/supabase/admin.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isParentRole } from "@/lib/family/roles";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ParentCaller {
  id: string;
  familyId: string;
  role: string;
  displayName: string | null;
}

export type Gate =
  | { ok: true; caller: ParentCaller; admin: SupabaseClient }
  | { ok: false; error: string; status: number };

/**
 * WHO IS ASKING — read from the DATABASE, never from the request body.
 *
 * Same shape as the family-night route's gate (src/app/api/family/night/route.ts):
 * cookie session identifies the user, the profiles row decides what they are.
 * `isParentRole` is the shared predicate so admins are admitted here exactly as
 * they are on /family/members — the owner's own account is an admin, and a
 * narrow `role === 'parent'` test has locked it out of parent screens before.
 */
export async function requireParent(): Promise<Gate> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in.", status: 401 };

  const { data } = await db
    .from("profiles")
    .select("id, role, family_id, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const me = data as {
    id: string;
    role: string | null;
    family_id: string | null;
    display_name: string | null;
  } | null;

  if (!me) return { ok: false, error: "No profile on this account.", status: 403 };
  if (!isParentRole(me.role)) {
    return {
      ok: false,
      error: "Only a parent can add someone to the family.",
      status: 403,
    };
  }
  if (!me.family_id) {
    return {
      ok: false,
      error: "Finish setting up your family first, then add your children.",
      status: 403,
    };
  }

  return {
    ok: true,
    caller: {
      id: me.id,
      familyId: me.family_id,
      role: me.role as string,
      displayName: me.display_name,
    },
    admin: createAdminClient(),
  };
}

/**
 * THE TRANSCRIPT — written to family_guardrail_events (migration 192).
 *
 * That table is the household's existing audit log: `(family_id, child_id,
 * actor_id, setting, old_value, new_value, created_at)`, already readable by
 * the parents of the family and deliberately NOT by the kids, already indexed
 * on (child_id, created_at desc). `setting` is plain `text not null` with no
 * CHECK, so a new setting name is additive — no migration, no new table, and
 * the rows are queryable the same way every guardrail change is:
 *
 *   select * from family_guardrail_events
 *    where setting in ('family_member_created', 'family_member_linked')
 *    order by created_at desc;
 *
 * Best effort by contract. A parent who successfully added their child must not
 * see a failure because the log write failed — the membership is the outcome,
 * the log is the record of it. Failures are returned so the caller can decide
 * whether to say anything (today: nothing).
 */
export async function logFamilyMemberChange(
  admin: SupabaseClient,
  row: {
    familyId: string;
    childId: string;
    actorId: string;
    setting: "family_member_created" | "family_member_linked";
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown>;
  }
): Promise<boolean> {
  const { error } = await admin.from("family_guardrail_events").insert({
    family_id: row.familyId,
    child_id: row.childId,
    actor_id: row.actorId,
    setting: row.setting,
    old_value: row.oldValue,
    new_value: row.newValue,
  });
  return !error;
}
