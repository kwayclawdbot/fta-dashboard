import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHILD_ROLE, EMAIL_RE, isAgeBand, type AgeBand } from "@/lib/family/children";
import { logFamilyMemberChange, requireParent } from "@/lib/server/family-children";

export const dynamic = "force-dynamic";

/**
 * LINK AN EXISTING ACCOUNT — the Ken-and-his-son case, made self-serve.
 *
 * WHAT WENT WRONG. A parent minted a child invite; his son ignored the link and
 * signed up through normal signup. handle_new_user() defaults role to 'parent'
 * and onboarding created him his own one-person family, so the two accounts were
 * never related and nothing in the product could relate them. Fixing it took
 * support and a hand-written UPDATE. This route is that UPDATE, with the checks
 * a human would have made written down.
 *
 * WHAT IT DOES. Moves `profiles.family_id` of the target account to the calling
 * parent's family and sets role 'child' + the chosen band. It does NOT touch the
 * target's auth user, their password, their email, their XP, their badges, or
 * their progress — the account is the same account, it simply now belongs to a
 * household.
 *
 * WHAT IT REFUSES (all five checked server-side, in this order):
 *   1. an account that doesn't exist;
 *   2. the caller themselves, or anyone already in the caller's family;
 *   3. a role that isn't 'parent' or 'child' — a coach or admin account is
 *      never somebody's kid;
 *   4. an account whose family has other people in it. "Solo" means exactly one
 *      profile in that family (or no family at all). This is the check that
 *      stops this route being a way to pull a member out of a household that is
 *      still using them;
 *   5. an account whose family is PAYING. Subscription state lives in
 *      `enrollments` (family_id, program, status — the source `family_tiers`
 *      reads) and in `families.stripe_subscription_id`. Moving a paying family's
 *      only member would silently orphan a live membership behind a family row
 *      nobody can reach, so the answer is a sentence telling them to cancel or
 *      contact support instead.
 *
 * TYPED CONFIRMATION IS ENFORCED HERE TOO, not only in the UI: `confirm` must
 * equal the target email. A destructive-shaped action whose only guard is
 * client-side isn't guarded.
 *
 * THE OLD FAMILY ROW IS LEFT ALONE. Deleting it would cascade
 * (enrollments, invites, guardrail events, watchlist — `on delete cascade`
 * throughout), and an empty families row costs nothing. It is dead, not
 * dangerous.
 */

interface Body {
  email?: string;
  band?: string;
  confirm?: string;
}

interface LinkTarget {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
  family_id: string | null;
  onboarding_complete: boolean | null;
}

type Resolution =
  | { ok: true; target: LinkTarget; memberCount: number }
  | { ok: false; error: string; status: number };

/** The five refusals, shared by the preview (GET) and the move (POST). */
async function resolveTarget(
  admin: SupabaseClient,
  callerId: string,
  callerFamilyId: string,
  email: string
): Promise<Resolution> {
  const { data } = await admin
    .from("profiles")
    .select("id, email, display_name, role, family_id, onboarding_complete")
    .ilike("email", email)
    .maybeSingle();

  const target = data as LinkTarget | null;
  if (!target) {
    return {
      ok: false,
      error:
        "No Cheat Code account uses that email. Check the spelling, or create the account for them instead.",
      status: 404,
    };
  }

  if (target.id === callerId) {
    return { ok: false, error: "That's your own account.", status: 400 };
  }

  if (target.family_id === callerFamilyId) {
    return {
      ok: false,
      error: `${target.display_name || "That account"} is already in your family.`,
      status: 409,
    };
  }

  if (target.role !== "parent" && target.role !== CHILD_ROLE) {
    return {
      ok: false,
      error: "That account is a coach or admin account and can't be moved into a family.",
      status: 409,
    };
  }

  // ── solo? ────────────────────────────────────────────────────────────────
  // No family at all counts as solo (nothing to strand). Otherwise the family
  // must contain exactly this one person.
  let memberCount = 0;
  if (target.family_id) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("family_id", target.family_id);
    memberCount = count ?? 0;

    if (memberCount > 1) {
      return {
        ok: false,
        error: `That account is already part of another household of ${memberCount}. Someone there needs to remove them first.`,
        status: 409,
      };
    }

    // ── paying? ────────────────────────────────────────────────────────────
    const { data: paid } = await admin
      .from("enrollments")
      .select("program")
      .eq("family_id", target.family_id)
      .eq("status", "active")
      .in("program", ["fic", "fta", "challenge_pass"])
      .limit(1);

    if (paid && paid.length) {
      return {
        ok: false,
        error:
          "That account has its own paid membership. Cancel it first (or email support) so you're not billed twice, then link them.",
        status: 409,
      };
    }

    const { data: fam } = await admin
      .from("families")
      .select("stripe_subscription_id")
      .eq("id", target.family_id)
      .maybeSingle();

    if ((fam as { stripe_subscription_id: string | null } | null)?.stripe_subscription_id) {
      return {
        ok: false,
        error:
          "That account has an active subscription of its own. Cancel it first (or email support), then link them.",
        status: 409,
      };
    }
  }

  return { ok: true, target, memberCount };
}

/** Preview — tells the parent who they are about to move, before they type. */
export async function GET(req: Request) {
  const email = (new URL(req.url).searchParams.get("email") || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter their email address." }, { status: 400 });
  }

  const gate = await requireParent();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const found = await resolveTarget(gate.admin, gate.caller.id, gate.caller.familyId, email);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });

  return NextResponse.json({
    ok: true,
    target: {
      display_name: found.target.display_name,
      email: found.target.email,
      role: found.target.role,
      solo: true,
    },
  });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const confirm = (body.confirm || "").trim().toLowerCase();
  const band = body.band;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter their email address." }, { status: 400 });
  }
  if (!isAgeBand(band)) {
    return NextResponse.json({ error: "Pick an age band for them." }, { status: 400 });
  }
  if (confirm !== email) {
    return NextResponse.json(
      { error: "Type their email address exactly to confirm the move." },
      { status: 400 }
    );
  }

  const gate = await requireParent();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { caller, admin } = gate;

  const found = await resolveTarget(admin, caller.id, caller.familyId, email);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });

  const target = found.target;
  const ageBand = band as AgeBand;

  // onboarding_complete is left as it was on purpose: a member who finished
  // onboarding shouldn't be pushed back through it, and one who never finished
  // still needs to. Only membership, role and band change.
  const { error: moveErr } = await admin
    .from("profiles")
    .update({
      family_id: caller.familyId,
      role: CHILD_ROLE,
      age_group: ageBand,
      track: ageBand,
    })
    .eq("id", target.id);

  if (moveErr) {
    return NextResponse.json(
      { error: "Couldn't move that account into your family. Nothing changed." },
      { status: 500 }
    );
  }

  await logFamilyMemberChange(admin, {
    familyId: caller.familyId,
    childId: target.id,
    actorId: caller.id,
    setting: "family_member_linked",
    oldValue: { family_id: target.family_id, role: target.role },
    newValue: {
      method: "linked",
      email,
      display_name: target.display_name,
      role: CHILD_ROLE,
      age_group: ageBand,
      from_family_id: target.family_id,
    },
  });

  return NextResponse.json({
    ok: true,
    child: {
      id: target.id,
      display_name: target.display_name,
      email: target.email,
      role: CHILD_ROLE,
      age_group: ageBand,
      track: ageBand,
    },
  });
}
