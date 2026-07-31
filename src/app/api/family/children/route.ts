import { NextResponse } from "next/server";
import {
  AGE_BANDS,
  CHILD_ROLE,
  EMAIL_RE,
  MIN_PASSWORD,
  isAgeBand,
  type AgeBand,
} from "@/lib/family/children";
import { logFamilyMemberChange, requireParent } from "@/lib/server/family-children";

export const dynamic = "force-dynamic";

interface Body {
  name?: string;
  band?: string;
  email?: string;
  password?: string;
}

/**
 * ADD A CHILD — the parent creates the account, in their own family, outright.
 *
 * WHY A ROUTE. Creating an auth user is service-role work: `auth.admin.createUser`
 * cannot be reached with an anon key, and the profile write that follows sets
 * `family_id` on somebody else's row, which every RLS policy on profiles is
 * built to refuse. Both have to happen behind the service role, and the service
 * role only ever lives in a server route (src/lib/supabase/admin.ts).
 *
 * WHAT IT PRODUCES. Exactly what the funnel signup produces
 * (api/free-class/register), minus the family creation — a confirmed auth user
 * (`email_confirm: true`, so there is no confirmation mail to chase and the
 * child can sign in the moment the parent hands them the password) whose
 * profile is already attached to the PARENT'S family with role 'child' and the
 * chosen band, and `onboarding_complete: true` so they land straight in the
 * kid/teen experience instead of a wizard a child shouldn't be walking alone.
 *
 * KID SAFETY IS INHERITED, NOT RE-IMPLEMENTED. role 'child' + age_group 'kids'
 * is precisely what `viewer_is_kid()` (migration 137) reads, so every kid wall —
 * screener, saved screens, research objects, stances, circles, feed — closes
 * around this account automatically. A teen is role 'child' + age_group 'teens',
 * which those same walls correctly treat as not-a-kid. Nothing here touches
 * gating logic; it only writes the two columns the gates already read.
 *
 * EVERY INPUT IS VALIDATED SERVER-SIDE. The band is checked against the literal
 * union rather than trusted, the email against the same regex the funnel uses,
 * the password against the same minimum — and the family the child joins is the
 * CALLER'S family read from the database, never a family_id from the body.
 *
 * SEATS. There is no free-tier household size cap anywhere in this codebase —
 * see the FREE_FAMILY_MEMBER_CAP note in src/lib/family/children.ts for the full
 * investigation. This route therefore imposes none, matching the invite path.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const band = body.band;

  if (name.length < 1 || name.length > 60) {
    return NextResponse.json(
      { error: "Give your child a name to show on their account." },
      { status: 400 }
    );
  }
  if (!isAgeBand(band)) {
    return NextResponse.json(
      {
        error: `Pick an age band — ${AGE_BANDS.map((b) => `${b.label} (${b.hint})`).join(
          " or "
        )}.`,
      },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "That email doesn't look right. Most families use a parent-managed address." },
      { status: 400 }
    );
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `The starter password needs at least ${MIN_PASSWORD} characters.` },
      { status: 400 }
    );
  }

  const gate = await requireParent();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { caller, admin } = gate;

  // ── the email must be free ───────────────────────────────────────────────
  // createUser would reject a duplicate anyway, but its message ("A user with
  // this email address has already been registered") is a dead end. Catching it
  // here lets the answer be the useful one: that account exists, so LINK it
  // instead of creating a second one — which is the whole point of this lane.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error:
          "Someone already uses that email. If it's your child's own account, link it to your family instead of making a second one.",
        code: "exists",
      },
      { status: 409 }
    );
  }

  // ── create the auth user ─────────────────────────────────────────────────
  // role in user_metadata is what handle_new_user() (migration 001) reads when
  // it inserts the profile row, so the profile is born a child rather than
  // defaulting to 'parent' and being demoted a moment later — the exact wrong
  // turn that stranded the household this flow exists to fix.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name, role: CHILD_ROLE },
  });

  if (createErr || !created?.user) {
    const msg = (createErr?.message || "").toLowerCase();
    if (msg.includes("already")) {
      return NextResponse.json(
        {
          error:
            "Someone already uses that email. If it's your child's own account, link it to your family instead.",
          code: "exists",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Couldn't create that account. Try a different email." },
      { status: 500 }
    );
  }

  const childId = created.user.id;
  const ageBand = band as AgeBand;

  // ── attach it to THIS household ──────────────────────────────────────────
  // age_group and track move together, exactly as the onboarding wizard writes
  // them. onboarding_complete is true because the parent just supplied
  // everything the wizard would have asked a child for.
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      family_id: caller.familyId,
      role: CHILD_ROLE,
      age_group: ageBand,
      track: ageBand,
      display_name: name,
      email,
      onboarding_complete: true,
    })
    .eq("id", childId);

  if (profileErr) {
    // Roll the auth user back rather than leave an account that can sign in
    // but belongs to nobody — same rollback the funnel signup performs when its
    // family insert fails (api/free-class/register).
    await admin.auth.admin.deleteUser(childId);
    return NextResponse.json(
      { error: "Couldn't add them to your family. Nothing was created." },
      { status: 500 }
    );
  }

  await logFamilyMemberChange(admin, {
    familyId: caller.familyId,
    childId,
    actorId: caller.id,
    setting: "family_member_created",
    oldValue: null,
    newValue: {
      method: "created",
      email,
      display_name: name,
      role: CHILD_ROLE,
      age_group: ageBand,
    },
  });

  return NextResponse.json({
    ok: true,
    child: {
      id: childId,
      display_name: name,
      email,
      role: CHILD_ROLE,
      age_group: ageBand,
      track: ageBand,
    },
  });
}
